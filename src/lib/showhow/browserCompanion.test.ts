import { describe, expect, it, vi } from "vitest";
import { BrowserCompanionCapture } from "./browserCompanion";

function makeCapture(url = "https://app.example.test/settings?tab=profile") {
	const sendStep = vi.fn(async () => undefined);
	const captureScreenshot = vi.fn(async () => "pre-action-png");
	const capture = new BrowserCompanionCapture({
		sendStep,
		captureScreenshot,
		now: () => 1_700_000_004_000,
		getUrl: () => url,
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
			label: "Navigate to /settings",
			cx: 0,
			cy: 0,
			redacted: false,
			screenshot: null,
		});
	});

	it("keeps URL query and fragment secrets out of navigation labels", async () => {
		const { capture, sendStep } = makeCapture(
			"https://app.example/oauth/callback?code=secret-code#access_token=secret-token",
		);

		await capture.captureNavigation();

		expect(sendStep).toHaveBeenCalledWith(
			expect.objectContaining({ label: "Navigate to /oauth/callback" }),
		);
		expect(JSON.stringify(sendStep.mock.calls)).not.toContain("secret");
	});

	it("masks token-like pathname segments in navigation labels", async () => {
		const cases: Array<[string, string]> = [
			["https://app.example/reset/3f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c", "Navigate to /reset/…"],
			[
				"https://app.example/invite/0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e/accept",
				"Navigate to /invite/…/accept",
			],
			[
				"https://app.example/auth/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abc123",
				"Navigate to /auth/…",
			],
		];
		for (const [url, label] of cases) {
			const { capture, sendStep } = makeCapture(url);
			await capture.captureNavigation();
			expect(sendStep).toHaveBeenCalledWith(expect.objectContaining({ label }));
		}
	});

	it("keeps ordinary pathname segments readable in navigation labels", async () => {
		const { capture, sendStep } = makeCapture(
			"https://app.example/selenium/web/verified-final-spa",
		);

		await capture.captureNavigation();

		expect(sendStep).toHaveBeenCalledWith(
			expect.objectContaining({ label: "Navigate to /selenium/web/verified-final-spa" }),
		);
	});
});
