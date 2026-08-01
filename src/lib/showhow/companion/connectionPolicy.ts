export interface CompanionPairingConfig {
	endpoint: string;
	token: string;
}

export interface CompanionSocket {
	readyState: number;
	send(message: string): void;
	close(): void;
	addEventListener(
		type: "open" | "error" | "close" | "message",
		listener: (event?: { data: unknown }) => void,
	): void;
}

export interface CompanionConnectionOptions {
	readConfig: () => Promise<CompanionPairingConfig>;
	createSocket: (endpoint: string) => CompanionSocket;
	setPaired: (paired: boolean) => Promise<void>;
	schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
	cancel: (timer: ReturnType<typeof setTimeout>) => void;
}

const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 10_000;

interface PendingMessage {
	message: string;
	resolve: () => void;
}

/**
 * Owns the companion's one localhost socket. Any failed connection clears the
 * persisted status immediately and retries with bounded exponential backoff.
 */
export class CompanionConnection {
	private socket: CompanionSocket | null = null;
	private connecting: Promise<void> | null = null;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private retryDelayMs = INITIAL_RETRY_DELAY_MS;
	private readonly pendingMessages: PendingMessage[] = [];

	constructor(private readonly options: CompanionConnectionOptions) {}

	async connect(): Promise<void> {
		if (this.socket) return;
		if (this.connecting) return this.connecting;
		const connecting = this.startConnection();
		this.connecting = connecting;
		try {
			await connecting;
		} finally {
			if (this.connecting === connecting) {
				this.connecting = null;
			}
		}
	}

	private async startConnection(): Promise<void> {
		const pairing = await this.options.readConfig();
		if (!pairing.token) {
			await this.options.setPaired(false);
			return;
		}
		await this.options.setPaired(false);
		const socket = this.options.createSocket(pairing.endpoint);
		this.socket = socket;
		socket.addEventListener("open", () => {
			if (this.socket !== socket) return;
			this.retryDelayMs = INITIAL_RETRY_DELAY_MS;
			socket.send(JSON.stringify({ v: 1, type: "hello", role: "companion", token: pairing.token }));
			this.flushPendingMessages(socket);
		});
		socket.addEventListener("message", (event) => {
			try {
				const message = JSON.parse(String(event?.data)) as { type?: string };
				if (message.type === "paired") {
					void this.options.setPaired(true);
				} else if (message.type === "error") {
					this.handleDisconnect(socket);
				}
			} catch {
				this.handleDisconnect(socket);
			}
		});
		socket.addEventListener("error", () => this.handleDisconnect(socket));
		socket.addEventListener("close", () => this.handleDisconnect(socket));
	}

	async reconnect(): Promise<void> {
		this.cancelRetry();
		const socket = this.socket;
		this.socket = null;
		socket?.close();
		this.retryDelayMs = INITIAL_RETRY_DELAY_MS;
		await this.options.setPaired(false);
		await this.connect();
	}

	async send(message: string): Promise<void> {
		await this.connect();
		if (this.socket?.readyState === 1) {
			this.socket.send(message);
			return;
		}
		if (!this.socket) return;
		await new Promise<void>((resolve) => {
			this.pendingMessages.push({ message, resolve });
		});
	}

	private handleDisconnect(socket: CompanionSocket): void {
		if (this.socket !== socket) return;
		this.socket = null;
		socket.close();
		void this.options.setPaired(false);
		this.scheduleRetry();
	}

	private scheduleRetry(): void {
		if (this.retryTimer) return;
		const delayMs = this.retryDelayMs;
		this.retryDelayMs = Math.min(MAX_RETRY_DELAY_MS, this.retryDelayMs * 2);
		this.retryTimer = this.options.schedule(() => {
			this.retryTimer = null;
			void this.connect();
		}, delayMs);
	}

	private cancelRetry(): void {
		if (!this.retryTimer) return;
		this.options.cancel(this.retryTimer);
		this.retryTimer = null;
	}

	private flushPendingMessages(socket: CompanionSocket): void {
		while (this.pendingMessages.length > 0) {
			const pending = this.pendingMessages.shift();
			if (!pending) return;
			socket.send(pending.message);
			pending.resolve();
		}
	}
}
