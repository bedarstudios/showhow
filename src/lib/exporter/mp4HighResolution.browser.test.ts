import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from "mediabunny";
import { expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import { calculateMp4ExportSettings } from "./mp4ExportSettings";
import {
	createNativeTextVideo,
	renderTextReference,
	scoreText,
	TEXT_HEIGHT,
	TEXT_WIDTH,
	textCanvas,
	textCrop,
} from "./mp4TextFixture";
import { VideoExporter } from "./videoExporter";

declare module "vitest/browser" {
	interface BrowserCommands {
		recordMp4Quality(name: string, png: string): Promise<void>;
		recordMp4ReviewMeasurement(name: string, measurement: string): Promise<void>;
	}
}

function assertReadable(score: ReturnType<typeof scoreText>) {
	// Every sampled known character must remain identifiable, retaining at least
	// half its input glyph contrast. Background-only similarity cannot pass.
	expect(score.correct).toBe(score.total);
	expect(score.minimumContrastRatio).toBeGreaterThanOrEqual(0.5);
}

it("recognizes every glyph in the exact unencoded reference control", async () => {
	for (const frame of [6, 18]) {
		const reference = renderTextReference(frame);
		const blurred = textCanvas();
		try {
			const score = scoreText(reference, frame);
			const matchedRows = scoreText(reference, frame, undefined, "matched");
			const context = blurred.getContext("2d")!;
			context.filter = "blur(8px)";
			context.drawImage(reference, 0, 0);
			const negative = scoreText(blurred, frame);
			console.log("MP4_ORACLE_CONTROL", JSON.stringify({ frame, score, matchedRows, negative }));
			if (import.meta.env.VITE_MP4_REVIEW_EVIDENCE === "1")
				await commands.recordMp4ReviewMeasurement(
					`oracle-${frame}`,
					JSON.stringify({ frame, score, matchedRows, negative }),
				);
			assertReadable(score);
			expect(score.minimumContrastRatio).toBe(1);
			expect(score.mismatches).toEqual([]);
			expect(() => assertReadable(negative)).toThrow();
		} finally {
			reference.width = reference.height = 1;
			blurred.width = blurred.height = 1;
		}
	}
});

it("preserves native 4K source-quality text through motion and rejects blurred text", async ({
	task,
}) => {
	// Generate only the 24 frames exercised by this acceptance test. Keeping an
	// unused one-second tail makes software-only Linux runners time out.
	const fixture = await createNativeTextVideo(24);
	const url = URL.createObjectURL(fixture);
	const settings = calculateMp4ExportSettings({
		quality: "source",
		sourceWidth: TEXT_WIDTH,
		sourceHeight: TEXT_HEIGHT,
		aspectRatioValue: 16 / 9,
	});
	const fixtureSha256 = Array.from(
		new Uint8Array(await crypto.subtle.digest("SHA-256", await fixture.arrayBuffer())),
		(byte) => byte.toString(16).padStart(2, "0"),
	).join("");
	const diagnostic = import.meta.env.VITE_MP4_QUALITY_DIAGNOSTIC === "1";
	// The 80 Mbps diagnostic produced 5,238,219 bytes, exceeding our 5 MB
	// resource cap. 64 Mbps leaves a predicted 16% margin if size scales;
	// this is a higher-budget control, not an assumed lossless reference.
	const controlBitrate = 64_000_000;
	const scored: ReturnType<typeof scoreText>[] = [];
	let previousEncoder: Omit<VideoEncoderConfig, "bitrate"> | undefined;
	const configure = vi.spyOn(VideoEncoder.prototype, "configure");
	let input: Input | undefined;
	try {
		for (const bitrate of diagnostic ? [settings.bitrate, controlBitrate] : [settings.bitrate]) {
			const configurationStart = configure.mock.calls.length;
			const result = await new VideoExporter({
				videoUrl: url,
				...settings,
				bitrate,
				frameRate: 60,
				trimRegions: [],
				wallpaper: "#141414",
				zoomRegions: [],
				showShadow: false,
				shadowIntensity: 0,
				showBlur: false,
				padding: 2,
				cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			}).export();
			expect(result.success, result.error).toBe(true);
			expect(result.blob!.size).toBeLessThan(5_000_000);
			const configurations = configure.mock.calls
				.slice(configurationStart)
				.map(([config]) => ({ ...config }));
			expect(configurations).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						width: TEXT_WIDTH,
						height: TEXT_HEIGHT,
						bitrate,
						framerate: 60,
					}),
				]),
			);
			const { bitrate: configuredBitrate, ...encoderIdentity } = configurations.at(-1)!;
			expect(configuredBitrate).toBe(bitrate);
			if (previousEncoder) expect(encoderIdentity).toEqual(previousEncoder);
			previousEncoder = encoderIdentity;
			input = new Input({ source: new BlobSource(result.blob!), formats: ALL_FORMATS });
			const video = (await input.getPrimaryVideoTrack())!;
			expect(video.displayWidth).toBe(TEXT_WIDTH);
			expect(video.displayHeight).toBe(TEXT_HEIGHT);
			expect(video.codec).toBe("avc");
			expect(await input.computeDuration()).toBeCloseTo(0.4, 2);
			const packets = await video.computePacketStats();
			expect(packets.averagePacketRate).toBeCloseTo(60, 0);
			expect(packets.packetCount).toBe(24);
			const sink = new VideoSampleSink(video);
			for (const frame of [6, 18]) {
				const sample = (await sink.getSample(frame / 60))!;
				const decoded = textCanvas();
				const blurred = textCanvas();
				try {
					sample.draw(decoded.getContext("2d")!, 0, 0);
					const blurContext = blurred.getContext("2d")!;
					blurContext.filter = "blur(8px)";
					blurContext.drawImage(decoded, 0, 0);
					let referenceCrop = "";
					const evidence = import.meta.env.VITE_MP4_REVIEW_EVIDENCE === "1";
					const positive = scoreText(
						decoded,
						frame,
						evidence
							? (canvas) => {
									referenceCrop = textCrop(canvas, frame);
								}
							: undefined,
					);
					const negative = scoreText(blurred, frame);
					const matchedRows = scoreText(decoded, frame, undefined, "matched");
					const historicalFirstRow = scoreText(decoded, frame, undefined, "first");
					if (evidence) {
						for (const [name, png] of bitrate !== settings.bitrate
							? [["control", textCrop(decoded, frame)]]
							: [
									["reference", referenceCrop],
									["decoded", textCrop(decoded, frame)],
									["blurred", textCrop(blurred, frame)],
								]) {
							await commands.recordMp4Quality(`${name}-${frame}`, png);
						}
					}
					const measurement = JSON.stringify({
						userAgent: navigator.userAgent,
						frame,
						sampleTimestamp: sample.timestamp,
						fixtureSha256,
						fixtureBytes: fixture.size,
						outputBytes: result.blob!.size,
						duration: await input.computeDuration(),
						width: video.displayWidth,
						height: video.displayHeight,
						codec: video.codec,
						packets,
						bitrate,
						configurations,
						positive,
						negative,
						matchedRows,
						historicalFirstRow,
					});
					console.log("MP4_4K_QUALITY", measurement);
					if (evidence)
						await commands.recordMp4ReviewMeasurement(`quality-${bitrate}-${frame}`, measurement);
					scored.push(import.meta.env.VITE_MP4_QUALITY_NEGATIVE === "1" ? negative : positive);
					expect(() => assertReadable(negative)).toThrow();
				} finally {
					sample.close();
					decoded.width = decoded.height = blurred.width = blurred.height = 1;
				}
			}
			input.dispose();
			input = undefined;
		}
		// Collect both times and (in diagnostic mode) both budgets before asserting.
		// The criteria remain unchanged, so a diagnostic can still fail honestly.
		for (const score of scored) {
			task.meta.mp4Assertion = "glyph-equality";
			task.meta.mp4GlyphScore = score.correct;
			assertReadable(score);
		}
	} finally {
		configure.mockRestore();
		input?.dispose();
		URL.revokeObjectURL(url);
	}
}, 180_000);
