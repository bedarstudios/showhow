import { describe, expect, it, vi } from "vitest";
import { deferMutableClick } from "./deferredClick";

describe("deferMutableClick", () => {
	it("captures an unchecked checkbox before replaying one default click", async () => {
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		const capture = vi.fn(async () => expect(checkbox.checked).toBe(false));
		const event = new MouseEvent("click", { bubbles: true, cancelable: true });
		const change = vi.fn();
		checkbox.addEventListener("change", change);
		checkbox.addEventListener("click", () =>
			checkbox.dispatchEvent(new Event("change", { bubbles: true })),
		);

		await deferMutableClick(event, checkbox, capture);

		expect(event.defaultPrevented).toBe(true);
		expect(capture).toHaveBeenCalledTimes(1);
		expect(checkbox.checked).toBe(true);
		expect(change).toHaveBeenCalledTimes(1);
	});

	it("replays the default click even when the capture never settles", async () => {
		vi.useFakeTimers();
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		const capture = vi.fn(() => new Promise<void>(() => {}));
		const event = new MouseEvent("click", { bubbles: true, cancelable: true });

		const deferred = deferMutableClick(event, checkbox, capture);
		expect(checkbox.checked).toBe(false);
		await vi.advanceTimersByTimeAsync(1500);
		await deferred;

		expect(checkbox.checked).toBe(true);
		vi.useRealTimers();
	});

	it("replays the default click when the capture rejects", async () => {
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		const event = new MouseEvent("click", { bubbles: true, cancelable: true });

		await deferMutableClick(event, checkbox, async () => {
			throw new Error("transport down");
		});

		expect(checkbox.checked).toBe(true);
	});
});
