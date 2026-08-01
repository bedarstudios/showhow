/* global chrome */
// biome-ignore-all lint/correctness/noUndeclaredVariables: Chrome provides this extension API.

import type { CompanionStep } from "../browserCompanion";
import { CompanionConnection } from "./connectionPolicy";
import { createCompanionMessageListener } from "./messageHandler";

interface PairingConfig {
	endpoint: string;
	token: string;
}

async function config(): Promise<PairingConfig> {
	const values = await chrome.storage.local.get(["endpoint", "token"]);
	return {
		endpoint: typeof values.endpoint === "string" ? values.endpoint : "ws://127.0.0.1:8765",
		token: typeof values.token === "string" ? values.token : "",
	};
}

const connection = new CompanionConnection({
	readConfig: config,
	createSocket: (endpoint) => new WebSocket(endpoint),
	setPaired: async (paired) => chrome.storage.local.set({ paired }),
	schedule: (callback, delayMs) => setTimeout(callback, delayMs),
	cancel: clearTimeout,
});

async function sendStep(step: CompanionStep): Promise<void> {
	await connection.send(JSON.stringify({ v: 1, type: "step", ...step }));
}

const handleMessage = createCompanionMessageListener({
	captureVisibleTab: () => chrome.tabs.captureVisibleTab(undefined, { format: "png" }),
	sendStep: (step) => sendStep(step as CompanionStep),
	reconnect: () => connection.reconnect(),
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) =>
	handleMessage(message, sendResponse),
);

void connection.connect();
