import { describe, expect, it, vi } from "vitest";
import { installPageNavigationBridge, SHOWHOW_NAVIGATION_EVENT } from "./pageNavigationBridge";

describe("installPageNavigationBridge", () => {
	it("propagates page-world pushState, replaceState, and popstate", () => {
		const listener = vi.fn();
		window.addEventListener(SHOWHOW_NAVIGATION_EVENT, listener);
		installPageNavigationBridge(window);

		history.pushState({}, "", "/page-push");
		history.replaceState({}, "", "/page-replace");
		window.dispatchEvent(new PopStateEvent("popstate"));

		expect(listener).toHaveBeenCalledTimes(3);
		window.removeEventListener(SHOWHOW_NAVIGATION_EVENT, listener);
	});
});
