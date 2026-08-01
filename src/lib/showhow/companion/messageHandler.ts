export interface CompanionMessageHandlerOptions {
	captureVisibleTab: () => Promise<string>;
	sendStep: (step: unknown) => Promise<void>;
	reconnect: () => Promise<void>;
}

export type CompanionMessageResponse = { screenshot: string | null } | { ok: boolean };

export type CompanionMessageListener = (
	message: unknown,
	sendResponse: (response: CompanionMessageResponse) => void,
) => true | undefined;

/**
 * MV3 callbacks must return true before asynchronous work begins; otherwise
 * Chrome closes the message port while the service worker awaits it.
 */
export function createCompanionMessageListener(
	options: CompanionMessageHandlerOptions,
): CompanionMessageListener {
	return (message, sendResponse) => {
		if (!message || typeof message !== "object" || !("type" in message)) return undefined;
		if (message.type === "showhow:capture-visible-tab") {
			void options.captureVisibleTab().then(
				(screenshot) => sendResponse({ screenshot }),
				() => sendResponse({ screenshot: null }),
			);
			return true;
		}
		if (message.type === "showhow:step" && "step" in message) {
			void options.sendStep(message.step).then(
				() => sendResponse({ ok: true }),
				() => sendResponse({ ok: false }),
			);
			return true;
		}
		if (message.type === "showhow:reconnect") {
			void options.reconnect().then(
				() => sendResponse({ ok: true }),
				() => sendResponse({ ok: false }),
			);
			return true;
		}
		return undefined;
	};
}
