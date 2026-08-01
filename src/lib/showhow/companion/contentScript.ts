/* global chrome */
// biome-ignore-all lint/correctness/noUndeclaredVariables: Chrome provides this extension API.

import { BrowserCompanionCapture, type CompanionStep } from "../browserCompanion";
import { deferMutableClick, isReplayingClick } from "./deferredClick";
import { SHOWHOW_NAVIGATION_EVENT } from "./pageNavigationBridge";

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

document.addEventListener(
	"click",
	(event) => {
		if (!(event instanceof MouseEvent) || !(event.target instanceof HTMLElement)) return;
		const target = event.target.closest<HTMLInputElement>(
			'input[type="checkbox"], input[type="radio"]',
		);
		if (target) {
			if (isReplayingClick(target)) return;
			void deferMutableClick(event, target, () => capture.captureClick(event));
			return;
		}
		void capture.captureClick(event);
	},
	true,
);
document.addEventListener("input", (event) => void capture.captureInput(event, "input"), true);
document.addEventListener("change", (event) => void capture.captureInput(event, "change"), true);

window.addEventListener(SHOWHOW_NAVIGATION_EVENT, (event) => {
	if (event.target === window && "detail" in event && event.detail === null) {
		void capture.captureNavigation();
	}
});
