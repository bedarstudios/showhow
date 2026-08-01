import { mkdtemp, readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { BRIDGE_PROTOCOL_VERSION, type IngestedBrowserStep } from "./bridgeProtocol";
import { type BrowserStepRecord, ShowhowBridgeServer } from "./bridgeServer";
import { persistBrowserSteps } from "./bundle";

function nextFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const srv = new WebSocketServer({ host: "127.0.0.1", port: 0 }, () => {
			const address = srv.address();
			const port = typeof address === "object" && address ? address.port : 0;
			srv.close(() => resolve(port));
		});
		srv.on("error", reject);
	});
}

interface Client {
	ws: WebSocket;
	recv: (timeoutMs?: number) => Promise<unknown>;
}

function openClient(port: number): Promise<Client> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(`ws://127.0.0.1:${port}`);
		const messages: unknown[] = [];
		const waiters: Array<(m: unknown) => void> = [];
		ws.on("message", (data) => {
			const msg = JSON.parse(data.toString());
			const waiter = waiters.shift();
			if (waiter) waiter(msg);
			else messages.push(msg);
		});
		ws.once("open", () =>
			resolve({
				ws,
				recv: (timeoutMs = 2000) => {
					const pending = messages.shift();
					if (pending !== undefined) return Promise.resolve(pending);
					return new Promise((resolve2, reject2) => {
						const timer = setTimeout(() => reject2(new Error("recv timeout")), timeoutMs);
						waiters.push((m) => {
							clearTimeout(timer);
							resolve2(m);
						});
					});
				},
			}),
		);
		ws.once("error", reject);
	});
}

function send(ws: WebSocket, payload: unknown): void {
	const message =
		typeof payload === "object" && payload !== null && "type" in payload && payload.type === "hello"
			? { ...payload, token: "test-token" }
			: payload;
	ws.send(JSON.stringify(message));
}

function waitForClose(ws: WebSocket, timeoutMs = 2000): Promise<number> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("close timeout")), timeoutMs);
		ws.once("close", (code) => {
			clearTimeout(timer);
			resolve(code);
		});
	});
}

describe("ShowhowBridgeServer pairing and handshake", () => {
	it("rejects a companion with an invalid pairing token", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "secret" });
		await server.start({ host: "127.0.0.1", port });

		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion", token: "wrong" });
		const error = await client.recv();
		expect(error).toEqual({ v: 1, type: "error", message: expect.stringContaining("token") });
		await waitForClose(client.ws);
		expect(server.isCompanionConnected()).toBe(false);

		await server.stop();
	});

	it("accepts an explicit versioned pairing and acks with paired", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });

		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion" });
		const ack = await client.recv();
		expect(ack).toEqual({ v: 1, type: "paired" });

		client.ws.close();
		await server.stop();
	});

	it("sends the recording-start epoch handshake when a recording is active", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });

		const recordingStartMs = 1_700_000_000_000;
		server.setRecordingEpoch(recordingStartMs);

		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion" });
		await client.recv(); // paired
		const epoch = await client.recv();
		expect(epoch).toEqual({ v: 1, type: "epoch", recordingStartMs });

		client.ws.close();
		await server.stop();
	});

	it("retriggers the epoch handshake when the recording start is reset", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });

		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion" });
		await client.recv(); // paired

		server.setRecordingEpoch(1_700_000_000_000);
		const first = await client.recv();
		expect(first).toEqual({ v: 1, type: "epoch", recordingStartMs: 1_700_000_000_000 });

		server.setRecordingEpoch(1_700_000_005_000);
		const second = await client.recv();
		expect(second).toEqual({ v: 1, type: "epoch", recordingStartMs: 1_700_000_005_000 });

		client.ws.close();
		await server.stop();
	});
});

describe("ShowhowBridgeServer malformed and unsupported-version rejection", () => {
	it("rejects a malformed message without crashing the server", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });

		const client = await openClient(port);
		client.ws.send("{not json");
		const err = await client.recv();
		expect(err).toEqual({ v: 1, type: "error", message: expect.stringContaining("malformed") });
		await waitForClose(client.ws);

		// Server survives: a fresh client can still pair.
		const client2 = await openClient(port);
		send(client2.ws, { v: 1, type: "hello", role: "companion" });
		const ack = await client2.recv();
		expect(ack).toEqual({ v: 1, type: "paired" });
		client2.ws.close();
		await server.stop();
	});

	it("rejects an unsupported protocol version without crashing", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });

		const client = await openClient(port);
		send(client.ws, { v: 99, type: "hello", role: "companion" });
		const err = await client.recv();
		expect(err).toEqual({ v: 1, type: "error", message: expect.stringContaining("version") });
		await waitForClose(client.ws);
		await server.stop();
	});
});

describe("ShowhowBridgeServer step ingestion and timestamp conversion", () => {
	it("converts event timestamps to recording-relative milliseconds", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });

		const recordingStartMs = 1_700_000_000_000;
		server.setRecordingEpoch(recordingStartMs);

		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion" });
		await client.recv(); // paired
		await client.recv(); // epoch

		send(client.ws, {
			v: 1,
			type: "step",
			ts: recordingStartMs + 4_000,
			label: "Click Save",
			cx: 0.3,
			cy: 0.4,
			redacted: false,
			screenshot: null,
		});

		const drained = await server.drainSteps();
		expect(drained).toHaveLength(1);
		expect(drained[0]).toEqual({
			tier: "browser",
			ts: 4_000,
			label: "Click Save",
			coords: { cx: 0.3, cy: 0.4 },
			redaction: false,
			screenshot: null,
		});

		client.ws.close();
		await server.stop();
	});

	it("clears buffered steps when the recording epoch is cleared", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });

		const recordingStartMs = 1_700_000_000_000;
		server.setRecordingEpoch(recordingStartMs);
		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion" });
		await client.recv();
		await client.recv();
		send(client.ws, {
			v: 1,
			type: "step",
			ts: recordingStartMs + 500,
			label: "stale",
			cx: 0.5,
			cy: 0.5,
			redacted: false,
			screenshot: null,
		});

		await new Promise((resolve) => setTimeout(resolve, 25));
		server.clearRecordingEpoch();
		server.setRecordingEpoch(recordingStartMs + 10_000);
		send(client.ws, {
			v: 1,
			type: "step",
			ts: recordingStartMs + 10_500,
			label: "fresh",
			cx: 0.5,
			cy: 0.5,
			redacted: false,
			screenshot: null,
		});
		await new Promise((resolve) => setTimeout(resolve, 25));
		expect(await server.drainSteps()).toMatchObject([{ label: "fresh", ts: 500 }]);

		client.ws.close();
		await server.stop();
	});

	it("clamps a step that precedes the epoch to zero", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });
		server.setRecordingEpoch(1_700_000_000_000);

		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion" });
		await client.recv();
		await client.recv();
		send(client.ws, {
			v: 1,
			type: "step",
			ts: 1_700_000_000_000 - 250,
			label: "early",
			cx: 0,
			cy: 0,
			redacted: false,
			screenshot: null,
		});

		const drained = await server.drainSteps();
		expect(drained[0]?.ts).toBe(0);

		client.ws.close();
		await server.stop();
	});

	it("ignores steps that arrive before pairing", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });

		const client = await openClient(port);
		send(client.ws, {
			v: 1,
			type: "step",
			ts: 1,
			label: "x",
			cx: 0,
			cy: 0,
			redacted: false,
			screenshot: null,
		});
		await waitForClose(client.ws);
		expect(await server.drainSteps()).toEqual([]);
		await server.stop();
	});
});

describe("ShowhowBridgeServer disconnect semantics", () => {
	it("marks browser steps unavailable on mid-recording disconnect and preserves drained steps", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });
		server.setRecordingEpoch(1_700_000_000_000);

		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion" });
		await client.recv();
		await client.recv();
		send(client.ws, {
			v: 1,
			type: "step",
			ts: 1_700_000_000_000 + 1_000,
			label: "one",
			cx: 0.1,
			cy: 0.1,
			redacted: false,
			screenshot: null,
		});
		// Give the server a beat to ingest before disconnecting.
		await new Promise((r) => setTimeout(r, 50));
		client.ws.close();
		await server.waitForDisconnect(2000);

		expect(server.isCompanionConnected()).toBe(false);
		expect(server.browserStepsAvailable()).toBe(false);
		// Steps ingested before the disconnect are still drained (preserved).
		const drained = await server.drainSteps();
		expect(drained).toHaveLength(1);
		await server.stop();
	});

	it("permits desktop fallback after disconnect: a new companion can re-pair", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });
		server.setRecordingEpoch(1_700_000_000_000);

		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion" });
		await client.recv();
		client.ws.close();
		await server.waitForDisconnect(2000);
		expect(server.browserStepsAvailable()).toBe(false);
		expect(server.hadMidRecordingDisconnect()).toBe(true);

		// Re-pair works (desktop fallback / reconnection permitted).
		const client2 = await openClient(port);
		send(client2.ws, { v: 1, type: "hello", role: "companion" });
		const ack = await client2.recv();
		expect(ack).toEqual({ v: 1, type: "paired" });
		client2.ws.close();
		await server.stop();
	});

	it("does not flag a disconnect when no recording epoch is active", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });

		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion" });
		await client.recv();
		client.ws.close();
		await server.waitForDisconnect(2000);
		expect(server.hadMidRecordingDisconnect()).toBe(false);
		await server.stop();
	});

	it("resets the mid-recording disconnect flag when a new recording starts", async () => {
		const port = await nextFreePort();
		const server = new ShowhowBridgeServer({ pairingToken: "test-token" });
		await server.start({ host: "127.0.0.1", port });
		server.setRecordingEpoch(1_700_000_000_000);

		const client = await openClient(port);
		send(client.ws, { v: 1, type: "hello", role: "companion" });
		await client.recv();
		client.ws.close();
		await server.waitForDisconnect(2000);
		expect(server.hadMidRecordingDisconnect()).toBe(true);

		server.setRecordingEpoch(1_700_000_010_000);
		expect(server.hadMidRecordingDisconnect()).toBe(false);
		await server.stop();
	});
});

describe("persistBrowserSteps bundle integration", () => {
	it("writes browser-tier steps with relative ts and screenshots into the bundle", async () => {
		const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "showhow-bridge-"));
		const bundleDir = path.join(tmpRoot, "2026-recording");
		const steps: BrowserStepRecord[] = [
			{
				tier: "browser",
				ts: 1_000,
				label: "Click Upload",
				coords: { cx: 0.5, cy: 0.5 },
				redaction: false,
				screenshot: "data:image/png;base64,iVBORw0KGgo=",
			} satisfies IngestedBrowserStep & { screenshot: string },
		];
		await persistBrowserSteps(bundleDir, steps);

		const files = await readdir(path.join(bundleDir, "screenshots"));
		expect(files).toContain("step-01.png");
		const pngBytes = await readFile(path.join(bundleDir, "screenshots", "step-01.png"));
		// base64 "iVBORw0KGgo=" decodes to the PNG magic bytes.
		expect(pngBytes.subarray(0, 8)).toEqual(
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		);

		const stepsJson = JSON.parse(await readFile(path.join(bundleDir, "steps.json"), "utf-8"));
		expect(stepsJson).toEqual([
			{
				label: "Click Upload",
				ts: 1_000,
				coords: { cx: 0.5, cy: 0.5 },
				tier: "browser",
				redaction: false,
				screenshot: "step-01.png",
			},
		]);
		const stepsMd = await readFile(path.join(bundleDir, "steps.md"), "utf-8");
		expect(stepsMd).toContain("1. [0:01] Click Upload");
	});

	it("writes a null-screenshot step without a screenshot file", async () => {
		const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "showhow-bridge-"));
		const bundleDir = path.join(tmpRoot, "2026-recording");
		const steps: BrowserStepRecord[] = [
			{
				tier: "browser",
				ts: 2_000,
				label: "No screenshot",
				coords: { cx: 0.2, cy: 0.3 },
				redaction: true,
				screenshot: null,
			},
		];
		await persistBrowserSteps(bundleDir, steps);
		const stepsJson = JSON.parse(await readFile(path.join(bundleDir, "steps.json"), "utf-8"));
		expect(stepsJson[0].screenshot).toBe("");
		expect(stepsJson[0].redaction).toBe(true);
	});
});

// Compile-time assertion that the wire version constant is exported.
const _v: number = BRIDGE_PROTOCOL_VERSION;
void _v;
