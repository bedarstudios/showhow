import { describe, expect, it, vi } from "vitest";
import { BrowserCompanionCapture } from "./browserCompanion";

function makeCapture() {
	const sendStep = vi.fn(async () => undefined);
	const captureScreenshot = vi.fn(async () => "pre-action-png");
	const capture = new BrowserCompanionCapture({
		sendStep,
		captureScreenshot,
		now: () => 1_700_000_004_000,
		getUrl: () => "https://app.example.test/settings?tab=profile",
	});
	return { capture, sendStep, captureScreenshot };
}

describe("BrowserCompanionCapture", () => {
	it("streams the accessibility name and a pre-action screenshot for a meaningful click", async () => {
		const { capture, captureScreenshot, sendStep } = makeCapture();
		document.body.innerHTML = '<button aria-label="Save profile">Save</button>';
		const button = document.querySelector("button")!;

		await capture.captureClick({ target: button, clientX: 50, clientY: 25, view: window });

		expect(captureScreenshot).toHaveBeenCalledBefore(sendStep);
		expect(sendStep).toHaveBeenCalledWith({
			ts: 1_700_000_004_000,
			label: "Click Save profile",
			cx: 50 / window.innerWidth,
			cy: 25 / window.innerHeight,
			redacted: false,
			screenshot: "pre-action-png",
		});
	});

	it("redacts typed values before streaming them from the page", async () => {
		const { capture, captureScreenshot, sendStep } = makeCapture();
		document.body.innerHTML =
			'<label>Account password <input type="password" value="hunter2" /></label>';
		const input = document.querySelector("input")!;

		await capture.captureInput({ target: input, clientX: 10, clientY: 20, view: window });

		expect(sendStep).toHaveBeenCalledWith(
			expect.objectContaining({ label: "Type Account password", redacted: true }),
		);
		expect(captureScreenshot).not.toHaveBeenCalled();
		expect(JSON.stringify(sendStep.mock.calls)).not.toContain("hunter2");
	});

	it("ignores clicks without a meaningful browser action", async () => {
		const { capture, sendStep, captureScreenshot } = makeCapture();
		document.body.innerHTML = "<div><span>Decorative text</span></div>";

		await capture.captureClick({
			target: document.querySelector("span")!,
			clientX: 10,
			clientY: 20,
			view: window,
		});

		expect(captureScreenshot).not.toHaveBeenCalled();
		expect(sendStep).not.toHaveBeenCalled();
	});

	it("streams SPA navigation without a screenshot", async () => {
		const { capture, sendStep, captureScreenshot } = makeCapture();

		await capture.captureNavigation();

		expect(captureScreenshot).not.toHaveBeenCalled();
		expect(sendStep).toHaveBeenCalledWith({
			ts: 1_700_000_004_000,
			label: "Navigate to /settings?tab=profile",
			cx: 0,
			cy: 0,
			redacted: false,
			screenshot: null,
		});
	});
});
