import { describe, expect, it } from "vitest";
import { resolveCursorAccessPreflight } from "./cursorAccessPreflight";

describe("resolveCursorAccessPreflight", () => {
	it("does not degrade when accessibility is granted on macOS editable-overlay", () => {
		const result = resolveCursorAccessPreflight({
			platform: "darwin",
			cursorCaptureMode: "editable-overlay",
			accessCheckSucceeded: true,
			accessGranted: true,
		});
		expect(result.degradedToSystemCursor).toBe(false);
		expect(result.stepCaptureReason).toBeUndefined();
	});

	it("degrades to system cursor with accessibility-denied reason when access is denied", () => {
		const result = resolveCursorAccessPreflight({
			platform: "darwin",
			cursorCaptureMode: "editable-overlay",
			accessCheckSucceeded: true,
			accessGranted: false,
		});
		expect(result.degradedToSystemCursor).toBe(true);
		expect(result.stepCaptureReason).toBe("accessibility-denied");
	});

	it("degrades to system cursor with accessibility-denied reason when the preflight check itself fails", () => {
		const result = resolveCursorAccessPreflight({
			platform: "darwin",
			cursorCaptureMode: "editable-overlay",
			accessCheckSucceeded: false,
			accessGranted: false,
		});
		expect(result.degradedToSystemCursor).toBe(true);
		expect(result.stepCaptureReason).toBe("accessibility-denied");
	});

	it("does not degrade on macOS when cursor mode is already system", () => {
		const result = resolveCursorAccessPreflight({
			platform: "darwin",
			cursorCaptureMode: "system",
			accessCheckSucceeded: true,
			accessGranted: false,
		});
		expect(result.degradedToSystemCursor).toBe(false);
		expect(result.stepCaptureReason).toBeUndefined();
	});

	it("does not degrade on non-darwin platforms regardless of cursor mode", () => {
		for (const platform of ["win32", "linux"] as const) {
			const result = resolveCursorAccessPreflight({
				platform,
				cursorCaptureMode: "editable-overlay",
				accessCheckSucceeded: true,
				accessGranted: false,
			});
			expect(result.degradedToSystemCursor).toBe(false);
			expect(result.stepCaptureReason).toBeUndefined();
		}
	});
});
