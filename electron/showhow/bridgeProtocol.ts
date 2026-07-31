/**
 * Showhow desktop bridge -- v1 wire contract (pure, transport-free).
 *
 * The companion browser extension pairs with the desktop app over a localhost
 * WebSocket. This module owns the JSON wire-protocol contract: parsing and
 * validating inbound client messages, serializing outbound server messages,
 * and converting event timestamps to recording-relative milliseconds.
 *
 * It is deliberately transport-free so the contract can be unit-tested without
 * a network. The {@link ShowhowBridgeServer} (see `bridgeServer.ts`) wires
 * this contract to a `ws` WebSocket server bound strictly to 127.0.0.1.
 *
 * Contract (JSON text frames):
 *
 * Client -> Server:
 *   { "v": 1, "type": "hello", "role": "companion" }
 *   { "v": 1, "type": "step", "ts": <epochMs>, "label": <string>,
 *     "cx": <0..1>, "cy": <0..1>, "redacted": <bool>, "screenshot": <base64|null> }
 *
 * Server -> Client:
 *   { "v": 1, "type": "paired" }
 *   { "v": 1, "type": "epoch", "recordingStartMs": <epochMs> }
 *   { "v": 1, "type": "bye" }
 *   { "v": 1, "type": "error", "message": <string> }
 *
 * Malformed or unsupported-version messages are rejected without crashing the
 * server: the parser returns `{ ok: false, error }` and the server sends an
 * `error` message then closes the connection.
 */

export const BRIDGE_PROTOCOL_VERSION = 1;

/** A browser step ingested from the companion, with recording-relative `ts`. */
export interface IngestedBrowserStep {
	tier: "browser";
	/** Recording-relative integer milliseconds (clamped to >= 0). */
	ts: number;
	label: string;
	coords: { cx: number; cy: number };
	redaction: boolean;
	/** Base64-encoded PNG screenshot of the pre-action page state, or null. */
	screenshot: string | null;
}

export interface HelloMessage {
	v: typeof BRIDGE_PROTOCOL_VERSION;
	type: "hello";
	role: "companion";
}

export interface StepMessage {
	v: typeof BRIDGE_PROTOCOL_VERSION;
	type: "step";
	/** Wall-clock epoch milliseconds at the action. */
	ts: number;
	label: string;
	/** Viewport-relative x in [0, 1]. */
	cx: number;
	/** Viewport-relative y in [0, 1]. */
	cy: number;
	redacted: boolean;
	screenshot: string | null;
}

export type ClientMessage = HelloMessage | StepMessage;

export interface PairedMessage {
	v: typeof BRIDGE_PROTOCOL_VERSION;
	type: "paired";
}

export interface EpochMessage {
	v: typeof BRIDGE_PROTOCOL_VERSION;
	type: "epoch";
	recordingStartMs: number;
}

export interface ByeMessage {
	v: typeof BRIDGE_PROTOCOL_VERSION;
	type: "bye";
}

export interface ErrorMessage {
	v: typeof BRIDGE_PROTOCOL_VERSION;
	type: "error";
	message: string;
}

export type ServerMessage = PairedMessage | EpochMessage | ByeMessage | ErrorMessage;

export type ParseResult = { ok: true; message: ClientMessage } | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function inUnitRange(value: number): boolean {
	return value >= 0 && value <= 1;
}

/**
 * Parse and validate an inbound client text frame. Never throws: malformed
 * JSON, unsupported protocol versions, and structurally invalid messages all
 * return `{ ok: false, error }`. The caller sends an `error` message and
 * closes the connection on a failure result.
 */
export function parseClientMessage(raw: string): ParseResult {
	let payload: unknown;
	try {
		payload = JSON.parse(raw);
	} catch {
		return { ok: false, error: "malformed message" };
	}
	if (!isObject(payload)) {
		return { ok: false, error: "malformed message" };
	}
	if (payload.v !== BRIDGE_PROTOCOL_VERSION) {
		return { ok: false, error: "unsupported protocol version" };
	}
	const type = payload.type;
	if (type === "hello") {
		if (payload.role !== "companion") {
			return { ok: false, error: "hello requires role 'companion'" };
		}
		return { ok: true, message: { v: BRIDGE_PROTOCOL_VERSION, type: "hello", role: "companion" } };
	}
	if (type === "step") {
		if (!isFiniteNumber(payload.ts)) {
			return { ok: false, error: "step requires a finite numeric ts" };
		}
		if (typeof payload.label !== "string" || payload.label.length === 0) {
			return { ok: false, error: "step requires a non-empty label" };
		}
		if (!isFiniteNumber(payload.cx) || !isFiniteNumber(payload.cy)) {
			return { ok: false, error: "step requires numeric cx and cy" };
		}
		if (!inUnitRange(payload.cx) || !inUnitRange(payload.cy)) {
			return { ok: false, error: "step cx/cy must be within [0, 1]" };
		}
		if (typeof payload.redacted !== "boolean") {
			return { ok: false, error: "step requires a boolean redacted flag" };
		}
		if (payload.screenshot !== null && typeof payload.screenshot !== "string") {
			return { ok: false, error: "step screenshot must be a string or null" };
		}
		return {
			ok: true,
			message: {
				v: BRIDGE_PROTOCOL_VERSION,
				type: "step",
				ts: payload.ts,
				label: payload.label,
				cx: payload.cx,
				cy: payload.cy,
				redacted: payload.redacted,
				screenshot: payload.screenshot,
			},
		};
	}
	return { ok: false, error: "unknown message type" };
}

/**
 * Convert a wall-clock epoch step timestamp to recording-relative integer
 * milliseconds, clamped to >= 0 so a step that precedes the recording-start
 * epoch never produces a negative timestamp chip.
 */
export function convertStepToRelative(stepEpochMs: number, recordingStartMs: number): number {
	return Math.max(0, Math.floor(stepEpochMs - recordingStartMs));
}

/** Serialize an outbound server message to a JSON text frame. */
export function serializeServerMessage(message: ServerMessage): string {
	return JSON.stringify(message);
}
