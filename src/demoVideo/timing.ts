import type { DemoStep, DemoTimeline } from "./types";

const FPS = 30 as const;
const TITLE_AND_OUTRO_MS = 2600;
const MIN_STEP_DURATION_MS = 2500;
const MAX_STEP_DURATION_MS = 6000;
const STEP_DURATION_PER_CHARACTER_MS = 55;

function durationMsToFrames(durationMs: number): number {
	return Math.round((durationMs / 1000) * FPS);
}

export function stepDurationMs(label: string): number {
	return Math.min(
		MAX_STEP_DURATION_MS,
		Math.max(MIN_STEP_DURATION_MS, label.length * STEP_DURATION_PER_CHARACTER_MS),
	);
}

export function computeTimeline(steps: DemoStep[]): DemoTimeline {
	if (steps.length === 0) {
		throw new Error("computeTimeline requires at least one step");
	}

	const titleFrames = durationMsToFrames(TITLE_AND_OUTRO_MS);
	const stepFrames = steps.map((step) => durationMsToFrames(stepDurationMs(step.label)));
	const outroFrames = durationMsToFrames(TITLE_AND_OUTRO_MS);
	const totalFrames =
		titleFrames +
		stepFrames.reduce((frameCount, stepFrameCount) => frameCount + stepFrameCount, 0) +
		outroFrames;

	return {
		fps: FPS,
		titleFrames,
		stepFrames,
		outroFrames,
		totalFrames,
	};
}
