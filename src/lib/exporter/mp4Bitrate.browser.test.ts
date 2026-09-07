import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import { expect, it } from "vitest";
import scrollingTextUrl from "../../../tests/fixtures/mp4-scrolling-text.mp4?url";
import { calculateMp4ExportSettings } from "./mp4ExportSettings";
import { VideoExporter } from "./videoExporter";

it("reduces scrolling UI bytes against a paired legacy encoder control", async () => {
	const settings = calculateMp4ExportSettings({
		quality: "good",
		sourceWidth: 1920,
		sourceHeight: 1080,
		aspectRatioValue: 16 / 9,
	});
	const outputs: number[] = [];
	for (const bitrate of [20_000_000, settings.bitrate]) {
		const result = await new VideoExporter({
			videoUrl: scrollingTextUrl,
			...settings,
			bitrate,
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
			expect(result.blob!.size).toBeLessThan(5_000_000);
			outputs.push(result.blob!.size);
		} finally {
			input.dispose();
		}
	}
	// Pair both budgets on this encoder, not a byte limit from another platform.
	// The original absolute Mac acceptance remains in artifacts/67.
	console.log(
		"MP4_PAIRED_SIZE",
		JSON.stringify({
			userAgent: navigator.userAgent,
			legacyBytes: outputs[0],
			computedBytes: outputs[1],
			bitrate: settings.bitrate,
		}),
	);
	expect(outputs[1]).toBeLessThan(outputs[0]);
	expect(settings.bitrate).toBeLessThan(20_000_000);
});
