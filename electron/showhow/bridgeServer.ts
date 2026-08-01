import { timingSafeEqual } from "node:crypto";
import { type WebSocket, WebSocketServer } from "ws";
import {
	BRIDGE_PROTOCOL_VERSION,
	convertStepToRelative,
	type IngestedBrowserStep,
	parseClientMessage,
	type ServerMessage,
	serializeServerMessage,
} from "./bridgeProtocol";

export { type BrowserStepRecord } from "./bundle";

export interface BridgeServerOptions {
	/** Bind host. Production binds strictly to "127.0.0.1"; never all interfaces. */
	host: "127.0.0.1" | "localhost";
	/** TCP port. 0 picks a free port. */
	port?: number;
}

/**
 * Showhow desktop bridge server.
 *
 * Hosts the localhost WebSocket the companion browser extension pairs with.
 * Owns the single paired companion connection, the recording-start epoch, and
 * the buffer of ingested browser-tier steps. The wire contract lives in
 * `bridgeProtocol.ts`; this module wires it to a `ws` server bound strictly
 * to 127.0.0.1 so the bridge is never reachable from the network or cloud.
 *
 * Failure model: a malformed or unsupported-version message is rejected with
 * an `error` frame and the offending connection is closed, but the server
 * survives for the next pairing. A mid-recording disconnect marks browser
 * steps unavailable (so the doc engine falls back to the desktop tier) while
 * preserving any steps ingested before the disconnect and never touching the
 * recording video.
 */
export class ShowhowBridgeServer {
	private readonly pairingToken: string;
	private server: WebSocketServer | null = null;
	private companion: WebSocket | null = null;
	private recordingStartMs: number | null = null;
	private readonly ingested: IngestedBrowserStep[] = [];
	private connected = false;
	private disconnectDuringRecording = false;

	constructor(options: { pairingToken: string }) {
		this.pairingToken = options.pairingToken;
	}

	async start(options: BridgeServerOptions): Promise<void> {
		if (this.server) return;
		const host = options.host === "localhost" ? "127.0.0.1" : options.host;
		const server = new WebSocketServer({ host, port: options.port ?? 0 });
		await new Promise<void>((resolve, reject) => {
			server.once("listening", () => resolve());
			server.once("error", reject);
		});
		server.on("connection", (ws) => this.handleConnection(ws));
		this.server = server;
	}

	async stop(): Promise<void> {
		const server = this.server;
		if (!server) return;
		this.server = null;
		if (this.companion) {
			this.send(this.companion, { v: BRIDGE_PROTOCOL_VERSION, type: "bye" });
			this.companion.close();
			this.companion = null;
			this.connected = false;
		}
		this.ingested.splice(0, this.ingested.length);
		await new Promise<void>((resolve) => {
			server.close(() => resolve());
		});
	}

	/** Bound port (0 before start). */
	get port(): number {
		const address = this.server?.address();
		return typeof address === "object" && address ? address.port : 0;
	}

	isCompanionConnected(): boolean {
		return this.connected;
	}

	/**
	 * Set or retrigger the recording-start epoch. Sends the `epoch` handshake
	 * to the paired companion immediately (and to the next companion on
	 * pairing). Recording start must (re)trigger this so every step carries an
	 * offset from the active recording's start.
	 */
	setRecordingEpoch(recordingStartMs: number): void {
		this.recordingStartMs = recordingStartMs;
		this.disconnectDuringRecording = false;
		if (this.companion) {
			this.send(this.companion, {
				v: BRIDGE_PROTOCOL_VERSION,
				type: "epoch",
				recordingStartMs,
			});
		}
	}

	/** Clear the recording epoch (e.g. when not recording). */
	clearRecordingEpoch(): void {
		this.recordingStartMs = null;
		this.disconnectDuringRecording = false;
		this.ingested.splice(0, this.ingested.length);
	}

	hasRecordingEpoch(): boolean {
		return this.recordingStartMs !== null;
	}

	/**
	 * True when the companion disconnected while a recording epoch was active.
	 * Lets the bundle mark semantic browser steps unavailable (and fall back to
	 * the desktop tier) without losing video. Reset by the next
	 * {@link setRecordingEpoch} or {@link clearRecordingEpoch}.
	 */
	hadMidRecordingDisconnect(): boolean {
		return this.disconnectDuringRecording;
	}

	/**
	 * Drain the ingested browser-tier steps. Returns the steps collected since
	 * the last drain and clears the buffer. Steps ingested before a disconnect
	 * are preserved here so the caller can persist them at bundle time. Polls
	 * briefly so an in-flight step frame that was just sent has time to land.
	 */
	async drainSteps(): Promise<IngestedBrowserStep[]> {
		const deadline = Date.now() + 500;
		while (this.ingested.length === 0 && Date.now() < deadline) {
			await new Promise((r) => setImmediate(r));
		}
		const drained = this.ingested.splice(0, this.ingested.length);
		return drained;
	}

	/**
	 * Whether browser-tier steps are available for the current recording. False
	 * after a mid-recording disconnect so the doc engine falls back to the
	 * desktop tier and the bundle marks step capture unavailable.
	 */
	browserStepsAvailable(): boolean {
		return this.connected;
	}

	/** Resolve when the companion disconnects, or reject after timeoutMs. */
	waitForDisconnect(timeoutMs: number): Promise<void> {
		if (!this.connected) return Promise.resolve();
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("disconnect timeout")), timeoutMs);
			const onDisconnect = () => {
				clearTimeout(timer);
				resolve();
			};
			this.onceDisconnect = onDisconnect;
		});
	}

	private onceDisconnect: (() => void) | null = null;

	private handleConnection(ws: WebSocket): void {
		// Only one companion at a time. Reject extras politely.
		if (this.companion && this.companion.readyState === ws.OPEN) {
			this.send(ws, {
				v: BRIDGE_PROTOCOL_VERSION,
				type: "error",
				message: "companion already paired",
			});
			ws.close();
			return;
		}
		ws.on("message", (data) => this.handleMessage(ws, data.toString()));
		ws.on("close", () => this.handleDisconnect(ws));
		ws.on("error", () => {
			// Swallow per-socket errors; the close event follows and handles cleanup.
		});
	}

	private handleMessage(ws: WebSocket, raw: string): void {
		const parsed = parseClientMessage(raw);
		if (!parsed.ok) {
			this.send(ws, { v: BRIDGE_PROTOCOL_VERSION, type: "error", message: parsed.error });
			ws.close();
			return;
		}
		const message = parsed.message;
		if (message.type === "hello") {
			if (!this.tokensEqual(message.token, this.pairingToken)) {
				this.send(ws, {
					v: BRIDGE_PROTOCOL_VERSION,
					type: "error",
					message: "invalid pairing token",
				});
				ws.close();
				return;
			}
			// Pair this connection as the companion.
			this.companion = ws;
			this.connected = true;
			this.send(ws, { v: BRIDGE_PROTOCOL_VERSION, type: "paired" });
			if (this.recordingStartMs !== null) {
				this.send(ws, {
					v: BRIDGE_PROTOCOL_VERSION,
					type: "epoch",
					recordingStartMs: this.recordingStartMs,
				});
			}
			return;
		}
		if (message.type === "step") {
			// Steps are only accepted from the paired companion.
			if (ws !== this.companion) {
				this.send(ws, { v: BRIDGE_PROTOCOL_VERSION, type: "error", message: "not paired" });
				ws.close();
				return;
			}
			if (this.recordingStartMs === null) {
				// No active recording epoch: drop the step (no recording to attach to).
				return;
			}
			this.ingested.push({
				tier: "browser",
				ts: convertStepToRelative(message.ts, this.recordingStartMs),
				label: message.label,
				coords: { cx: message.cx, cy: message.cy },
				redaction: message.redacted,
				screenshot: message.screenshot,
			});
			return;
		}
		if (message.type === "ping") {
			if (ws !== this.companion) {
				this.send(ws, { v: BRIDGE_PROTOCOL_VERSION, type: "error", message: "not paired" });
				ws.close();
			}
			return;
		}
	}

	private handleDisconnect(ws: WebSocket): void {
		if (ws === this.companion) {
			this.companion = null;
			this.connected = false;
			if (this.recordingStartMs !== null) {
				this.disconnectDuringRecording = true;
			}
			if (this.onceDisconnect) {
				const cb = this.onceDisconnect;
				this.onceDisconnect = null;
				cb();
			}
		}
	}

	private send(ws: WebSocket, message: ServerMessage): void {
		if (ws.readyState === ws.OPEN) {
			ws.send(serializeServerMessage(message));
		}
	}

	private tokensEqual(left: string, right: string): boolean {
		const leftBytes = Buffer.from(left);
		const rightBytes = Buffer.from(right);
		return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
	}
}
