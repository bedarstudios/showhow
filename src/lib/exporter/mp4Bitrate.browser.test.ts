import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import { expect, it } from "vitest";
import scrollingTextUrl from "../../../tests/fixtures/mp4-scrolling-text.mp4?url";
import { calculateMp4ExportSettings } from "./mp4ExportSettings";
import { VideoExporter } from "./videoExporter";

it("bounds scrolling UI export size while preserving video and audio streams", async () => {
	const settings = calculateMp4ExportSettings({
		quality: "good",
		sourceWidth: 1920,
		sourceHeight: 1080,
		aspectRatioValue: 16 / 9,
	});
	const result = await new VideoExporter({
		videoUrl: scrollingTextUrl,
		...settings,
		frameRate: 60,
		wallpaper: "#182030",
		zoomRegions: [],
		showShadow: false,
		shadowIntensity: 0,
		showBlur: false,
		padding: 2,
		cropRegion: { x: 0, y: 0, width: 1, height: 1 },
	}).export();
	expect(result.success, result.error).toBe(true);
	expect(result.blob).toBeInstanceOf(Blob);
	const input = new Input({ source: new BlobSource(result.blob!), formats: ALL_FORMATS });
	try {
		const video = await input.getPrimaryVideoTrack();
		const audio = await input.getPrimaryAudioTrack();
		const duration = await input.computeDuration();
		expect(video?.displayWidth).toBe(1920);
		expect(video?.displayHeight).toBe(1080);
		expect(video?.codec).toBe("avc");
		expect(audio?.codec).toBe("aac");
		expect(duration).toBeGreaterThanOrEqual(2.98);
		expect(duration).toBeLessThan(3.1);
		expect(await video?.canDecode()).toBe(true);
		// ceil(1.5 * worst measured 4Mbps bytes/sec), with 50% variance margin.
		// See artifacts/67/benchmark-results.md and measurements.jsonl.
		expect(result.blob!.size / duration).toBeLessThanOrEqual(779_446);
	} finally {
		input.dispose();
	}
});
