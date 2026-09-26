import type { DemoStep, DemoTimeline } from "./types";

const FPS = 30 as const;
const _TITLE_AND_OUTRO_MS = 2600;
const _MIN_STEP_DURATION_MS = 2500;
const _MAX_STEP_DURATION_MS = 6000;
const _STEP_DURATION_PER_CHARACTER_MS = 55;

export function stepDurationMs(_label: string): number {
	return 0;
}

export function computeTimeline(_steps: DemoStep[]): DemoTimeline {
	return {
		fps: FPS,
		titleFrames: 0,
		stepFrames: [],
		outroFrames: 0,
		totalFrames: 0,
	};
}
