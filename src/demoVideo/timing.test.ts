import { describe, expect, it } from "vitest";

import { computeTimeline, stepDurationMs } from "./timing";
import type { DemoStep } from "./types";

function makeStep(label: string, ts: number): DemoStep {
	return {
		label,
		ts,
		screenshotPath: `/shots/${ts}.png`,
		click: ts % 2 === 0 ? { cx: ts + 10, cy: ts + 20 } : null,
	};
}

function deriveStepStarts(titleFrames: number, stepFrames: number[]): number[] {
	let currentFrame = titleFrames;
	return stepFrames.map((frames) => {
		const startFrame = currentFrame;
		currentFrame += frames;
		return startFrame;
	});
}

describe("demo video timing", () => {
	it("bounds label durations and rounds frame counts deterministically", () => {
		expect(stepDurationMs("short")).toBe(2500);
		expect(Math.round((stepDurationMs("short") / 1000) * 30)).toBe(75);

		const eightyCharacters = "a".repeat(80);
		expect(stepDurationMs(eightyCharacters)).toBe(4400);
		expect(Math.round((stepDurationMs(eightyCharacters) / 1000) * 30)).toBe(132);

		const twoHundredCharacters = "b".repeat(200);
		expect(stepDurationMs(twoHundredCharacters)).toBe(6000);
		expect(Math.round((stepDurationMs(twoHundredCharacters) / 1000) * 30)).toBe(180);

		const fortySevenCharacters = "c".repeat(47);
		expect(stepDurationMs(fortySevenCharacters)).toBe(2585);
		expect(Math.round((stepDurationMs(fortySevenCharacters) / 1000) * 30)).toBe(78);
	});

	it("computes ordered frame durations and total frames for multiple steps", () => {
		const steps = [makeStep("short", 100), makeStep("x".repeat(80), 200)];

		expect(computeTimeline(steps)).toEqual({
			fps: 30,
			titleFrames: 78,
			stepFrames: [75, 132],
			outroFrames: 78,
			totalFrames: 363,
		});
	});

	it("derives contiguous positions from the returned frame durations", () => {
		const timeline = computeTimeline([
			makeStep("short", 100),
			makeStep("y".repeat(47), 200),
			makeStep("z".repeat(200), 300),
		]);

		expect(deriveStepStarts(timeline.titleFrames, timeline.stepFrames)).toEqual([78, 153, 231]);
		expect(timeline.totalFrames).toBe(489);
	});

	it("throws for empty input with an actionable error", () => {
		expect(() => computeTimeline([])).toThrow(/at least one step/i);
	});

	it("is repeatable and does not mutate the input steps", () => {
		const steps = [
			makeStep("short", 10),
			makeStep("mid".repeat(20), 20),
			makeStep("long".repeat(60), 30),
		];
		const original = structuredClone(steps);

		const first = computeTimeline(steps);
		const second = computeTimeline(steps);

		expect(first).toEqual(second);
		expect(steps).toEqual(original);
		expect(first.stepFrames).toEqual([75, 99, 180]);
	});
});
