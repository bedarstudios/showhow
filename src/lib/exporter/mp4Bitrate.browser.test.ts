import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import { expect, it } from "vitest";
import { commands } from "vitest/browser";
import scrollingTextUrl from "../../../tests/fixtures/mp4-scrolling-text.mp4?url";
import { calculateMp4ExportSettings } from "./mp4ExportSettings";
import { VideoExporter } from "./videoExporter";

it("reduces scrolling UI bytes against a paired legacy encoder control", async ({ task }) => {
	const settings = calculateMp4ExportSettings({
		quality: "good",
		sourceWidth: 1920,
		sourceHeight: 1080,
		aspectRatioValue: 16 / 9,
	});
	const outputs: number[] = [];
	const metadata: unknown[] = [];
	const audioCodecs: Array<"aac" | "opus"> = [];
	// Keep the same 3s input; render its first 24 frames on both encoders.
	// Linux SwiftShader measured ~1s/rendered frame. Native resolution/fps,
	// budgets and actual-byte comparison remain unchanged.
	const renderedDuration = 0.4;
	for (const bitrate of [20_000_000, settings.bitrate]) {
		const result = await new VideoExporter({
			videoUrl: scrollingTextUrl,
			...settings,
			bitrate,
			frameRate: 60,
			trimRegions: [{ id: "bounded-test-tail", startMs: 400, endMs: 3000 }],
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
			const audioCodec = audio?.codec;
			expect(["aac", "opus"]).toContain(audioCodec);
			if (audioCodec !== "aac" && audioCodec !== "opus") {
				throw new Error(`Expected an AAC or Opus audio track, received ${audioCodec}`);
			}
			audioCodecs.push(audioCodec);
			expect(await video!.computeDuration()).toBeCloseTo(renderedDuration, 2);
			const packets = await video!.computePacketStats();
			expect(packets.averagePacketRate).toBeCloseTo(60, 0);
			expect(packets.packetCount).toBe(24);
			// Preserve audio and bound the existing encoder padding explicitly;
			// historical 3s acceptance measured 93ms extra container duration.
			expect(duration).toBeGreaterThanOrEqual(renderedDuration - 0.02);
			expect(duration).toBeLessThan(renderedDuration + 0.1);
			expect(await video?.canDecode()).toBe(true);
			expect(result.blob!.size).toBeLessThan(5_000_000);
			outputs.push(result.blob!.size);
			metadata.push({
				bitrate,
				bytes: result.blob!.size,
				videoDuration: await video!.computeDuration(),
				duration,
				width: video!.displayWidth,
				height: video!.displayHeight,
				codec: video!.codec,
				audioCodec,
				packets,
			});
		} finally {
			input.dispose();
		}
	}
	expect(audioCodecs[1]).toBe(audioCodecs[0]);
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
	if (import.meta.env.VITE_MP4_REVIEW_EVIDENCE === "1") {
		await commands.recordMp4ReviewMeasurement(
			"paired",
			JSON.stringify({ bitrate: settings.bitrate, outputs: metadata }),
		);
	}
	task.meta.mp4Assertion = "paired-byte-reduction";
	expect(outputs[1]).toBeLessThan(outputs[0]);
	expect(settings.bitrate).toBeLessThan(20_000_000);
});
