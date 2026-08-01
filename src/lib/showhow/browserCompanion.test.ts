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
		vi.useFakeTimers();
		const { capture, captureScreenshot, sendStep } = makeCapture();
		document.body.innerHTML =
			'<label>Account password <input type="password" value="hunter2" /></label>';
		const input = document.querySelector("input")!;

		await capture.captureInput({ target: input, clientX: 10, clientY: 20, view: window });
		await vi.advanceTimersByTimeAsync(300);

		expect(sendStep).toHaveBeenCalledWith(
			expect.objectContaining({ label: "Type Account password", redacted: true }),
		);
		expect(captureScreenshot).not.toHaveBeenCalled();
		expect(JSON.stringify(sendStep.mock.calls)).not.toContain("hunter2");
		vi.useRealTimers();
	});

	it("coalesces a typing session into one redacted semantic step", async () => {
		vi.useFakeTimers();
		const { capture, sendStep } = makeCapture();
		document.body.innerHTML = '<label>Text input <input value="a" /></label>';
		const input = document.querySelector("input")!;

		await capture.captureInput({ target: input, view: window });
		await capture.captureInput({ target: input, view: window });
		await vi.advanceTimersByTimeAsync(299);
		expect(sendStep).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		expect(sendStep).toHaveBeenCalledTimes(1);
		expect(sendStep).toHaveBeenCalledWith(
			expect.objectContaining({ label: "Type Text input", redacted: true }),
		);
		vi.useRealTimers();
	});

	it("does not classify checkbox changes as typed input", async () => {
		const { capture, sendStep } = makeCapture();
		document.body.innerHTML = '<label>Default checkbox <input type="checkbox" /></label>';

		await capture.captureInput({ target: document.querySelector("input")!, view: window });

		expect(sendStep).not.toHaveBeenCalled();
	});

	it("ignores a text-field change after its input session already emitted", async () => {
		vi.useFakeTimers();
		const { capture, sendStep } = makeCapture();
		document.body.innerHTML = "<label>Text input <input /></label>";
		const input = document.querySelector("input")!;

		await capture.captureInput({ target: input, view: window }, "input");
		await vi.advanceTimersByTimeAsync(300);
		await capture.captureInput({ target: input, view: window }, "change");
		await vi.advanceTimersByTimeAsync(300);

		expect(sendStep).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it("filters a cross-realm text-field change by local element metadata", async () => {
		vi.useFakeTimers();
		const { capture, sendStep } = makeCapture();
		document.body.innerHTML = "<label>Text input <input /></label>";
		const input = document.querySelector("input")!;
		const originalInputConstructor = globalThis.HTMLInputElement;
		vi.stubGlobal("HTMLInputElement", class {});

		await capture.captureInput({ target: input, view: window }, "input");
		await vi.advanceTimersByTimeAsync(300);
		await capture.captureInput({ target: input, view: window }, "change");
		await vi.advanceTimersByTimeAsync(300);

		expect(sendStep).toHaveBeenCalledTimes(1);
		vi.stubGlobal("HTMLInputElement", originalInputConstructor);
		vi.useRealTimers();
	});

	it("captures a select changed without an input event", async () => {
		vi.useFakeTimers();
		const { capture, sendStep } = makeCapture();
		document.body.innerHTML = "<label>Plan <select><option>Free</option></select></label>";

		await capture.captureInput(
			{ target: document.querySelector("select")!, view: window },
			"change",
		);
		await vi.advanceTimersByTimeAsync(300);

		expect(sendStep).toHaveBeenCalledWith(
			expect.objectContaining({ label: "Type Plan", redacted: true }),
		);
		vi.useRealTimers();
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
