import { describe, expect, it, vi } from "vitest";
import type { BrowserStepRecord } from "./bundle";
import { applyCompanionStepCapture, resolveCompanionStepCapture } from "./companionStepCapture";

describe("resolveCompanionStepCapture", () => {
	it("returns null when browser steps were ingested (available path owns persistence)", () => {
		const result = resolveCompanionStepCapture({
			ingestedStepCount: 1,
			isCompanionConnected: false,
			hadMidRecordingDisconnect: false,
			companionExpected: false,
		});
		expect(result).toBeNull();
	});

	it("returns companion-disconnected when the companion disconnected mid-recording with no steps", () => {
		const result = resolveCompanionStepCapture({
			ingestedStepCount: 0,
			isCompanionConnected: false,
			hadMidRecordingDisconnect: true,
			companionExpected: false,
		});
		expect(result).not.toBeNull();
		expect(result?.status).toBe("unavailable");
		expect(result?.reason).toBe("companion-disconnected");
		expect(result?.message).toMatch(/disconnected/i);
	});

	it("returns companion-unpaired when a browser recording never paired a companion", () => {
		const result = resolveCompanionStepCapture({
			ingestedStepCount: 0,
			isCompanionConnected: false,
			hadMidRecordingDisconnect: false,
			companionExpected: true,
		});
		expect(result).not.toBeNull();
		expect(result?.status).toBe("unavailable");
		expect(result?.reason).toBe("companion-unpaired");
		expect(result?.message).toMatch(/not paired|unpaired/i);
	});

	it("returns null for a desktop recording where the companion was never expected", () => {
		const result = resolveCompanionStepCapture({
			ingestedStepCount: 0,
			isCompanionConnected: false,
			hadMidRecordingDisconnect: false,
			companionExpected: false,
		});
		expect(result).toBeNull();
	});

	it("returns null when the companion is still connected but sent no steps", () => {
		const result = resolveCompanionStepCapture({
			ingestedStepCount: 0,
			isCompanionConnected: true,
			hadMidRecordingDisconnect: false,
			companionExpected: true,
		});
		expect(result).toBeNull();
	});

	it("prefers companion-disconnected over companion-unpaired when both signals are present", () => {
		const result = resolveCompanionStepCapture({
			ingestedStepCount: 0,
			isCompanionConnected: false,
			hadMidRecordingDisconnect: true,
			companionExpected: true,
		});
		expect(result?.reason).toBe("companion-disconnected");
	});
});

describe("applyCompanionStepCapture persistence", () => {
	const baseStep = (label: string): BrowserStepRecord => ({
		tier: "browser",
		ts: 1_000,
		label,
		coords: { cx: 0.5, cy: 0.5 },
		redaction: false,
		screenshot: null,
	});

	it("persists browser steps and marks available when steps were ingested", async () => {
		const persistSteps = vi.fn().mockResolvedValue(undefined);
		const markStepCapture = vi.fn().mockResolvedValue(undefined);
		await applyCompanionStepCapture({
			browserSteps: [baseStep("click")],
			bundleSource: "browser",
			bundleAlreadyAvailable: false,
			isCompanionConnected: true,
			hadMidRecordingDisconnect: false,
			persistSteps,
			markStepCapture,
		});
		expect(persistSteps).toHaveBeenCalledTimes(1);
		expect(markStepCapture).toHaveBeenCalledWith({ status: "available" });
	});

	it("marks unavailable (no companion reason) when browser step persistence fails", async () => {
		const persistSteps = vi.fn().mockRejectedValue(new Error("disk full"));
		const markStepCapture = vi.fn().mockResolvedValue(undefined);
		await applyCompanionStepCapture({
			browserSteps: [baseStep("click")],
			bundleSource: "browser",
			bundleAlreadyAvailable: false,
			isCompanionConnected: true,
			hadMidRecordingDisconnect: false,
			persistSteps,
			markStepCapture,
		});
		expect(markStepCapture).toHaveBeenCalledWith(
			expect.objectContaining({ status: "unavailable" }),
		);
		const mark = markStepCapture.mock.calls[0]![0];
		expect(mark.reason).toBeUndefined();
	});

	it("persists a companion-disconnected reason when the companion disconnected with no steps", async () => {
		const persistSteps = vi.fn().mockResolvedValue(undefined);
		const markStepCapture = vi.fn().mockResolvedValue(undefined);
		await applyCompanionStepCapture({
			browserSteps: [],
			bundleSource: "desktop",
			bundleAlreadyAvailable: false,
			isCompanionConnected: false,
			hadMidRecordingDisconnect: true,
			persistSteps,
			markStepCapture,
		});
		expect(persistSteps).not.toHaveBeenCalled();
		expect(markStepCapture).toHaveBeenCalledWith({
			status: "unavailable",
			reason: "companion-disconnected",
			message: expect.any(String),
		});
	});

	it("persists a companion-unpaired reason for a browser recording that never paired", async () => {
		const persistSteps = vi.fn().mockResolvedValue(undefined);
		const markStepCapture = vi.fn().mockResolvedValue(undefined);
		await applyCompanionStepCapture({
			browserSteps: [],
			bundleSource: "browser",
			bundleAlreadyAvailable: false,
			isCompanionConnected: false,
			hadMidRecordingDisconnect: false,
			persistSteps,
			markStepCapture,
		});
		expect(markStepCapture).toHaveBeenCalledWith({
			status: "unavailable",
			reason: "companion-unpaired",
			message: expect.any(String),
		});
	});

	it("does not mark a desktop recording as companion-unpaired (no mislabeling)", async () => {
		const persistSteps = vi.fn().mockResolvedValue(undefined);
		const markStepCapture = vi.fn().mockResolvedValue(undefined);
		await applyCompanionStepCapture({
			browserSteps: [],
			bundleSource: "desktop",
			bundleAlreadyAvailable: false,
			isCompanionConnected: false,
			hadMidRecordingDisconnect: false,
			persistSteps,
			markStepCapture,
		});
		expect(markStepCapture).not.toHaveBeenCalled();
	});

	it("does not override an already-available bundle with a companion degradation reason", async () => {
		const persistSteps = vi.fn().mockResolvedValue(undefined);
		const markStepCapture = vi.fn().mockResolvedValue(undefined);
		await applyCompanionStepCapture({
			browserSteps: [],
			bundleSource: "browser",
			bundleAlreadyAvailable: true,
			isCompanionConnected: false,
			hadMidRecordingDisconnect: true,
			persistSteps,
			markStepCapture,
		});
		expect(markStepCapture).not.toHaveBeenCalled();
	});
});
