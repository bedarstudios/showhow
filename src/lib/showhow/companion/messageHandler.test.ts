import { describe, expect, it, vi } from "vitest";
import { CompanionConnection } from "./connectionPolicy";
import { createCompanionMessageListener } from "./messageHandler";

class FakeSocket {
	readyState = 0;
	readonly sent: string[] = [];
	private readonly listeners = new Map<string, Array<(event?: { data: unknown }) => void>>();

	addEventListener(type: string, listener: (event?: { data: unknown }) => void): void {
		const existing = this.listeners.get(type) ?? [];
		existing.push(listener);
		this.listeners.set(type, existing);
	}

	send(message: string): void {
		this.sent.push(message);
	}

	close(): void {
		// The integration fake has no teardown behavior.
	}

	emit(type: string, data?: unknown): void {
		for (const listener of this.listeners.get(type) ?? []) listener({ data });
	}

	hasListener(type: string): boolean {
		return (this.listeners.get(type) ?? []).length > 0;
	}
}

describe("createCompanionMessageListener", () => {
	it("keeps the response port open until captureVisibleTab resolves", async () => {
		let resolveCapture: ((value: string) => void) | undefined;
		const capture = new Promise<string>((resolve) => {
			resolveCapture = resolve;
		});
		const sendResponse = vi.fn();
		const listener = createCompanionMessageListener({
			captureVisibleTab: () => capture,
			sendStep: async () => undefined,
			reconnect: async () => undefined,
		});

		expect(listener({ type: "showhow:capture-visible-tab" }, sendResponse)).toBe(true);
		expect(sendResponse).not.toHaveBeenCalled();
		resolveCapture?.("data:image/png;base64,abc");
		await vi.waitFor(() => {
			expect(sendResponse).toHaveBeenCalledWith({ screenshot: "data:image/png;base64,abc" });
		});
	});

	it("responds to step delivery after the queued send completes", async () => {
		let resolveStep: (() => void) | undefined;
		const delivery = new Promise<void>((resolve) => {
			resolveStep = resolve;
		});
		const sendResponse = vi.fn();
		const listener = createCompanionMessageListener({
			captureVisibleTab: async () => "",
			sendStep: async () => delivery,
			reconnect: async () => undefined,
		});

		expect(listener({ type: "showhow:step", step: { label: "Click Save" } }, sendResponse)).toBe(
			true,
		);
		resolveStep?.();
		await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));
	});

	it("delivers a worker-wake step through the connecting socket before acknowledging Chrome", async () => {
		const socket = new FakeSocket();
		const connection = new CompanionConnection({
			readConfig: async () => ({ endpoint: "ws://127.0.0.1:8765", token: "token" }),
			createSocket: () => socket,
			setPaired: async () => undefined,
			schedule: (callback, delayMs) => setTimeout(callback, delayMs),
			cancel: clearTimeout,
		});
		const listener = createCompanionMessageListener({
			captureVisibleTab: async () => "",
			sendStep: (step) => connection.send(JSON.stringify(step)),
			reconnect: async () => undefined,
		});
		const sendResponse = vi.fn();

		expect(listener({ type: "showhow:step", step: { label: "Click Save" } }, sendResponse)).toBe(
			true,
		);
		await vi.waitFor(() => expect(socket.hasListener("open")).toBe(true));
		expect(socket.sent).toEqual([]);
		socket.readyState = 1;
		socket.emit("open");
		socket.emit("message", '{"v":1,"type":"paired"}');

		await vi.waitFor(() => expect(socket.sent).toContain('{"label":"Click Save"}'));
		await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));
	});
});
