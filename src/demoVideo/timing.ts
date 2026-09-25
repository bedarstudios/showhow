import type { DemoStep, DemoTimeline } from "./types";

export function stepDurationMs(_label: string): number {
	return 0;
}

export function computeTimeline(_steps: DemoStep[]): DemoTimeline {
	return {
		fps: 30,
		titleFrames: 0,
		stepFrames: [],
		outroFrames: 0,
		totalFrames: 0,
	};
}
