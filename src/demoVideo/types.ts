export interface DemoStep {
	label: string;
	ts: number;
	screenshotPath: string;
	click: {
		cx: number;
		cy: number;
	} | null;
}

export interface DemoTimeline {
	fps: 30;
	titleFrames: number;
	stepFrames: number[];
	outroFrames: number;
	totalFrames: number;
}
