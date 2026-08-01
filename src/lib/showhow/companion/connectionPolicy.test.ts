import { describe, expect, it, vi } from "vitest";
import { CompanionConnection } from "./connectionPolicy";

class FakeSocket {
	readyState = 0;
	readonly sent: string[] = [];
	closed = false;
	private readonly listeners = new Map<string, Array<() => void>>();

	addEventListener(type: string, listener: () => void): void {
		const existing = this.listeners.get(type) ?? [];
		existing.push(listener);
		this.listeners.set(type, existing);
	}

	send(message: string): void {
		this.sent.push(message);
	}

	close(): void {
		this.closed = true;
	}

	emit(type: string): void {
		for (const listener of this.listeners.get(type) ?? []) listener();
	}
}

describe("CompanionConnection", () => {
	it("clears stale paired state and reconnects once after a pre-open socket error", async () => {
		vi.useFakeTimers();
		const sockets: FakeSocket[] = [];
		const setPaired = vi.fn(async () => undefined);
		const connection = new CompanionConnection({
			readConfig: async () => ({ endpoint: "ws://127.0.0.1:8765", token: "new-token" }),
			createSocket: () => {
				const socket = new FakeSocket();
				sockets.push(socket);
				return socket;
			},
			setPaired,
			schedule: (callback, delayMs) => setTimeout(callback, delayMs),
			cancel: clearTimeout,
		});

		await connection.connect();
		sockets[0]!.emit("error");

		expect(setPaired).toHaveBeenLastCalledWith(false);
		expect(sockets[0]!.closed).toBe(true);
		await vi.advanceTimersByTimeAsync(499);
		expect(sockets).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(sockets).toHaveLength(2);
		vi.useRealTimers();
	});

	it("queues a browser step until its freshly created socket opens", async () => {
		const sockets: FakeSocket[] = [];
		const connection = new CompanionConnection({
			readConfig: async () => ({ endpoint: "ws://127.0.0.1:8765", token: "token" }),
			createSocket: () => {
				const socket = new FakeSocket();
				sockets.push(socket);
				return socket;
			},
			setPaired: async () => undefined,
			schedule: (callback, delayMs) => setTimeout(callback, delayMs),
			cancel: clearTimeout,
		});

		const pending = connection.send('{"type":"step"}');
		await vi.waitFor(() => expect(sockets).toHaveLength(1));
		expect(sockets[0]!.sent).toEqual([]);

		sockets[0]!.readyState = 1;
		sockets[0]!.emit("open");
		await pending;

		expect(sockets[0]!.sent).toContain('{"type":"step"}');
	});

	it("shares one connecting socket when worker startup races the first browser step", async () => {
		const sockets: FakeSocket[] = [];
		let resolveConfig: ((value: { endpoint: string; token: string }) => void) | undefined;
		const config = new Promise<{ endpoint: string; token: string }>((resolve) => {
			resolveConfig = resolve;
		});
		const connection = new CompanionConnection({
			readConfig: async () => config,
			createSocket: () => {
				const socket = new FakeSocket();
				sockets.push(socket);
				return socket;
			},
			setPaired: async () => undefined,
			schedule: (callback, delayMs) => setTimeout(callback, delayMs),
			cancel: clearTimeout,
		});

		void connection.connect();
		const pendingStep = connection.send('{"type":"step"}');
		resolveConfig?.({ endpoint: "ws://127.0.0.1:8765", token: "token" });

		await vi.waitFor(() => expect(sockets.length).toBeGreaterThan(0));
		expect(sockets).toHaveLength(1);
		sockets[0]!.readyState = 1;
		sockets[0]!.emit("open");
		await pendingStep;
		expect(sockets[0]!.sent).toContain('{"type":"step"}');
	});

	it("keeps the worker-owned pairing socket active after the popup closes", async () => {
		vi.useFakeTimers();
		const socket = new FakeSocket();
		const connection = new CompanionConnection({
			readConfig: async () => ({ endpoint: "ws://127.0.0.1:8765", token: "token" }),
			createSocket: () => socket,
			setPaired: async () => undefined,
			schedule: (callback, delayMs) => setTimeout(callback, delayMs),
			cancel: clearTimeout,
		});

		await connection.connect();
		socket.readyState = 1;
		socket.emit("open");
		await vi.advanceTimersByTimeAsync(20_000);

		expect(socket.closed).toBe(false);
		expect(socket.sent).toContain('{"v":1,"type":"ping"}');
		vi.useRealTimers();
	});

	it("bounds repeated reconnect attempts and does not double-schedule error plus close", async () => {
		vi.useFakeTimers();
		const sockets: FakeSocket[] = [];
		const delays: number[] = [];
		const connection = new CompanionConnection({
			readConfig: async () => ({ endpoint: "ws://127.0.0.1:8765", token: "token" }),
			createSocket: () => {
				const socket = new FakeSocket();
				sockets.push(socket);
				return socket;
			},
			setPaired: async () => undefined,
			schedule: (callback, delayMs) => {
				delays.push(delayMs);
				return setTimeout(callback, delayMs);
			},
			cancel: clearTimeout,
		});

		await connection.connect();
		sockets[0]!.emit("error");
		sockets[0]!.emit("close");

		expect(delays).toEqual([500]);
		for (let i = 0; i < 6; i += 1) {
			await vi.advanceTimersByTimeAsync(delays.at(-1)!);
			sockets.at(-1)!.emit("close");
		}
		expect(Math.max(...delays)).toBe(10_000);
		vi.useRealTimers();
	});
});
