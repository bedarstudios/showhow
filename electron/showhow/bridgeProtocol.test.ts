import { describe, expect, it } from "vitest";
import {
	BRIDGE_PROTOCOL_VERSION,
	type ClientMessage,
	convertStepToRelative,
	type IngestedBrowserStep,
	parseClientMessage,
	serializeServerMessage,
} from "./bridgeProtocol";

describe("bridgeProtocol parseClientMessage", () => {
	it("accepts a versioned companion hello", () => {
		const raw = JSON.stringify({ v: 1, type: "hello", role: "companion" });
		const result = parseClientMessage(raw);
		expect(result).toEqual({ ok: true, message: { v: 1, type: "hello", role: "companion" } });
	});

	it("accepts a well-formed step message", () => {
		const raw = JSON.stringify({
			v: 1,
			type: "step",
			ts: 1_700_000_000_000,
			label: "Click Submit",
			cx: 0.5,
			cy: 0.25,
			redacted: false,
			screenshot: null,
		});
		const result = parseClientMessage(raw);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.message.type).toBe("step");
			if (result.message.type === "step") {
				expect(result.message.ts).toBe(1_700_000_000_000);
				expect(result.message.label).toBe("Click Submit");
				expect(result.message.redacted).toBe(false);
				expect(result.message.screenshot).toBeNull();
			}
		}
	});

	it("accepts a step message with a base64 screenshot", () => {
		const raw = JSON.stringify({
			v: 1,
			type: "step",
			ts: 1_700_000_000_500,
			label: "Type name",
			cx: 0.1,
			cy: 0.2,
			redacted: true,
			screenshot: "iVBORw0KGgo=",
		});
		const result = parseClientMessage(raw);
		expect(result.ok).toBe(true);
		if (result.ok && result.message.type === "step") {
			expect(result.message.redacted).toBe(true);
			expect(result.message.screenshot).toBe("iVBORw0KGgo=");
		}
	});

	it("rejects malformed JSON without throwing", () => {
		const result = parseClientMessage("{not json");
		expect(result).toEqual({ ok: false, error: expect.stringContaining("malformed") });
	});

	it("rejects an unsupported protocol version without throwing", () => {
		const raw = JSON.stringify({ v: 2, type: "hello", role: "companion" });
		const result = parseClientMessage(raw);
		expect(result).toEqual({ ok: false, error: expect.stringContaining("version") });
	});

	it("rejects a missing protocol version", () => {
		const raw = JSON.stringify({ type: "hello", role: "companion" });
		const result = parseClientMessage(raw);
		expect(result.ok).toBe(false);
	});

	it("rejects an unknown message type", () => {
		const raw = JSON.stringify({ v: 1, type: "frobnicate" });
		const result = parseClientMessage(raw);
		expect(result).toEqual({ ok: false, error: expect.stringContaining("type") });
	});

	it("rejects a hello with the wrong role", () => {
		const raw = JSON.stringify({ v: 1, type: "hello", role: "extension" });
		const result = parseClientMessage(raw);
		expect(result.ok).toBe(false);
	});

	it("rejects a step with a non-numeric ts", () => {
		const raw = JSON.stringify({
			v: 1,
			type: "step",
			ts: "soon",
			label: "x",
			cx: 0,
			cy: 0,
			redacted: false,
			screenshot: null,
		});
		const result = parseClientMessage(raw);
		expect(result.ok).toBe(false);
	});

	it("rejects a step with out-of-range viewport coords", () => {
		const raw = JSON.stringify({
			v: 1,
			type: "step",
			ts: 1,
			label: "x",
			cx: 1.5,
			cy: 0.5,
			redacted: false,
			screenshot: null,
		});
		const result = parseClientMessage(raw);
		expect(result.ok).toBe(false);
	});

	it("rejects a non-object top-level payload", () => {
		expect(parseClientMessage("null").ok).toBe(false);
		expect(parseClientMessage("[]").ok).toBe(false);
		expect(parseClientMessage("42").ok).toBe(false);
	});
});

describe("bridgeProtocol convertStepToRelative", () => {
	it("converts an epoch step ts to recording-relative milliseconds", () => {
		expect(convertStepToRelative(1_700_000_005_000, 1_700_000_000_000)).toBe(5_000);
	});

	it("clamps a step that precedes the recording epoch to zero", () => {
		expect(convertStepToRelative(1_700_000_000_000 - 250, 1_700_000_000_000)).toBe(0);
	});

	it("rounds to integer milliseconds", () => {
		expect(convertStepToRelative(1_700_000_000_999.7, 1_700_000_000_000)).toBe(999);
	});
});

describe("bridgeProtocol serializeServerMessage", () => {
	it("serializes a paired message", () => {
		const msg = serializeServerMessage({ v: BRIDGE_PROTOCOL_VERSION, type: "paired" });
		expect(JSON.parse(msg)).toEqual({ v: 1, type: "paired" });
	});

	it("serializes an epoch handshake with the recording-start epoch", () => {
		const msg = serializeServerMessage({
			v: BRIDGE_PROTOCOL_VERSION,
			type: "epoch",
			recordingStartMs: 1_700_000_000_000,
		});
		expect(JSON.parse(msg)).toEqual({ v: 1, type: "epoch", recordingStartMs: 1_700_000_000_000 });
	});

	it("serializes an error message", () => {
		const msg = serializeServerMessage({
			v: BRIDGE_PROTOCOL_VERSION,
			type: "error",
			message: "unsupported protocol version",
		});
		expect(JSON.parse(msg)).toEqual({
			v: 1,
			type: "error",
			message: "unsupported protocol version",
		});
	});
});

describe("bridgeProtocol IngestedBrowserStep", () => {
	it("a parsed step message maps to a relative-ts browser step", () => {
		const raw = JSON.stringify({
			v: 1,
			type: "step",
			ts: 1_700_000_004_000,
			label: "Click Save",
			cx: 0.3,
			cy: 0.4,
			redacted: false,
			screenshot: "abc",
		});
		const parsed = parseClientMessage(raw);
		expect(parsed.ok).toBe(true);
		const recordingStartMs = 1_700_000_000_000;
		const step: IngestedBrowserStep | undefined =
			parsed.ok && parsed.message.type === "step"
				? {
						tier: "browser",
						ts: convertStepToRelative(parsed.message.ts, recordingStartMs),
						label: parsed.message.label,
						coords: { cx: parsed.message.cx, cy: parsed.message.cy },
						redaction: parsed.message.redacted,
						screenshot: parsed.message.screenshot,
					}
				: undefined;
		expect(step).toEqual({
			tier: "browser",
			ts: 4_000,
			label: "Click Save",
			coords: { cx: 0.3, cy: 0.4 },
			redaction: false,
			screenshot: "abc",
		});
	});
});

// Compile-time assertion that the ClientMessage union is exported as expected.
const _typeCheck = (m: ClientMessage) => m;
void _typeCheck;
