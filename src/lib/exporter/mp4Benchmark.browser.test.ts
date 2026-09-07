import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import { expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import { calculateMp4ExportSettings } from "./mp4ExportSettings";
import { VideoExporter } from "./videoExporter";

declare module "vitest/browser" {
	interface BrowserCommands {
		recordMp4Measurement(name: string, measurement: string, frame: string): Promise<void>;
	}
}

async function readableFrame(blob: Blob) {
	const video = document.createElement("video");
	const url = URL.createObjectURL(blob);
	try {
		video.src = url;
		await new Promise<void>((resolve, reject) => {
			video.onloadedmetadata = () => resolve();
			video.onerror = () => reject(new Error("Evidence video failed to load"));
		});
		video.currentTime = 1;
		await new Promise<void>((resolve) => {
			video.onseeked = () => resolve();
		});
		const canvas = document.createElement("canvas");
		canvas.width = 1000;
		canvas.height = 300;
		canvas.getContext("2d")!.drawImage(video, 0, 0);
		return canvas.toDataURL("image/png").split(",")[1];
	} finally {
		video.removeAttribute("src");
		video.load();
		URL.revokeObjectURL(url);
	}
}

// Deliberately opt-in: disk/time-bounded investigative evidence, not routine CI.
it.skipIf(import.meta.env.VITE_MP4_BENCHMARK !== "1")(
	"measures real MP4 exports at unchanged and candidate bitrate budgets",
	async () => {
		console.log("MP4_BENCHMARK_START");
		const batchStart = performance.now();
		let totalBytes = 0;
		const smoke = import.meta.env.VITE_MP4_BENCHMARK_SMOKE === "1";
		for (const fixture of smoke ? ["static"] : ["static", "scroll", "motion"]) {
			const settings = calculateMp4ExportSettings({
				quality: "good",
				sourceWidth: 1920,
				sourceHeight: 1080,
				aspectRatioValue: 16 / 9,
			});
			const sizes: number[] = [];
			for (const bitrate of smoke ? [settings.bitrate] : [settings.bitrate, 2_000_000, 4_000_000]) {
				expect(performance.now() - batchStart).toBeLessThan(180_000);
				console.log(`MP4_BENCHMARK_EXPORT_START ${fixture} ${bitrate}`);
				const start = performance.now();
				const exporter = new VideoExporter({
					videoUrl: `/artifacts/67/fixtures/${fixture}.mp4`,
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
				});
				// Padding intentionally defeats the MP4 source-copy fast path.
				const encoderConfig = vi.spyOn(VideoEncoder.prototype, "configure");
				const result = await exporter.export();
				const configurations = encoderConfig.mock.calls.map(([config]) => ({ ...config }));
				encoderConfig.mockRestore();
				expect(result.success, result.error).toBe(true);
				expect(result.blob).toBeInstanceOf(Blob);
				const blob = result.blob!;
				totalBytes += blob.size;
				expect(totalBytes).toBeLessThan(30_000_000);
				const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
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
					const measurement = JSON.stringify({
						fixture,
						bitrate,
						configurations,
						bytes: blob.size,
						seconds: (performance.now() - start) / 1000,
						duration,
						width: video?.displayWidth,
						height: video?.displayHeight,
						audio: audio?.codec,
					});
					await commands.recordMp4Measurement(
						`${fixture}-${bitrate}`,
						measurement,
						await readableFrame(blob),
					);
				} finally {
					input.dispose();
				}
				sizes.push(blob.size);
			}
			if (!smoke) {
				expect(sizes[1]).toBeLessThanOrEqual(sizes[2]);
				expect(sizes[2]).toBeLessThanOrEqual(sizes[0]);
			}
		}
	},
	180_000,
);
