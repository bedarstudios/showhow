/* global chrome */
// biome-ignore-all lint/correctness/noUndeclaredVariables: Chrome provides this extension API.

import { BrowserCompanionCapture, type CompanionStep } from "../browserCompanion";

const capture = new BrowserCompanionCapture({
	sendStep: async (step: CompanionStep) => {
		await chrome.runtime.sendMessage({ type: "showhow:step", step });
	},
	captureScreenshot: async () => {
		const response = (await chrome.runtime.sendMessage({
			type: "showhow:capture-visible-tab",
		})) as {
			screenshot?: string | null;
		};
		return response.screenshot ?? null;
	},
	now: () => Date.now(),
	getUrl: () => window.location.href,
});

document.addEventListener("click", (event) => void capture.captureClick(event), true);
document.addEventListener("input", (event) => void capture.captureInput(event), true);
document.addEventListener("change", (event) => void capture.captureInput(event), true);

const notifyNavigation = () => void capture.captureNavigation();
for (const method of ["pushState", "replaceState"] as const) {
	const original = history[method];
	history[method] = function (...args: Parameters<History[typeof method]>) {
		const result = original.apply(this, args);
		notifyNavigation();
		return result;
	};
}
window.addEventListener("popstate", notifyNavigation);
