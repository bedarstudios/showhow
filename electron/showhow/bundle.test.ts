import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatTimestamp } from "@/lib/showhow/transcriptFormat";
import {
	buildMeta,
	buildSteps,
	bundleDirName,
	type ClickInput,
	createRecordingBundle,
	type FrameExtractor,
	formatStepTimestamp,
	parseTranscript,
	persistBrowserSteps,
	type RegenerateDocArtifactsResult,
	regenerateDocArtifacts,
	renderStepsMarkdown,
	type Step,
	serializeStepsJson,
	type TranscriptSegment,
	updateWorkflowDocument,
	type WriteDocArtifactsSeam,
} from "./bundle";

describe("bundleDirName", () => {
	it("formats createdAt as YYYY-MM-DD_HHMMSS-recording in local time", () => {
		// 2026-07-11 16:42:07 local
		const ts = new Date(2026, 6, 11, 16, 42, 7).getTime();
		expect(bundleDirName(ts)).toBe("2026-07-11_164207-recording");
	});

	it("zero-pads single-digit fields", () => {
		const ts = new Date(2026, 0, 5, 9, 3, 1).getTime();
		expect(bundleDirName(ts)).toBe("2026-01-05_090301-recording");
	});
});

describe("buildMeta", () => {
	it("builds the phase-1 meta contract", () => {
		const createdAt = new Date(2026, 6, 11, 16, 42, 7).getTime();
		const meta = buildMeta({
			createdAt,
			durationMs: 12_500,
			hasWebcam: false,
			hasCursorTelemetry: true,
		});
		expect(meta).toEqual({
			schemaVersion: 1,
			title: "Recording 2026-07-11 16:42",
			source: "desktop",
			createdAt,
			durationMs: 12_500,
			video: "video.webm",
			cursorTelemetry: "video.webm.cursor.json",
			transcript: "transcript.txt",
			steps: null,
		});
	});

	it("includes webcam and omits cursorTelemetry when absent", () => {
		const createdAt = new Date(2026, 6, 11, 16, 42, 7).getTime();
		const meta = buildMeta({ createdAt, hasWebcam: true, hasCursorTelemetry: false });
		expect(meta.webcam).toBe("webcam.webm");
		expect(meta.cursorTelemetry).toBeUndefined();
		expect(meta.durationMs).toBeUndefined();
	});
});

describe("createRecordingBundle", () => {
	it("extracts a marked step frame for every click in cursor telemetry", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-"));
		const screenVideoPath = path.join(work, "rec-clicks.mp4");
		await writeFile(screenVideoPath, "fake-mp4");
		await writeFile(
			`${screenVideoPath}.cursor.json`,
			JSON.stringify({
				samples: [
					{ timeMs: 1_250, cx: 0.25, cy: 0.5, interactionType: "click" },
					{ timeMs: 2_000, cx: 0.5, cy: 0.5, interactionType: "move" },
					{ timeMs: 3_500, cx: 0.75, cy: 0.2, interactionType: "click" },
				],
			}),
		);
		const frames: Parameters<FrameExtractor>[0][] = [];
		const extractFrames: FrameExtractor = async (input) => {
			frames.push(input);
		};

		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: Date.now(),
			recordingsRoot: path.join(work, "Recordings"),
			extractFrames,
		});

		expect(frames).toEqual([
			{
				videoPath: result.screenVideoPath,
				screenshotsDir: path.join(result.bundleDir, "screenshots"),
				clicks: [
					{ timeMs: 1_250, cx: 0.25, cy: 0.5, outputPath: "step-01.png" },
					{ timeMs: 3_500, cx: 0.75, cy: 0.2, outputPath: "step-02.png" },
				],
			},
		]);
	});

	it("keeps the video and records transcript-only degradation when frame extraction fails", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-"));
		const screenVideoPath = path.join(work, "rec-click.mp4");
		await writeFile(screenVideoPath, "fake-mp4");
		await writeFile(
			`${screenVideoPath}.cursor.json`,
			JSON.stringify({
				samples: [{ timeMs: 100, cx: 0.5, cy: 0.5, interactionType: "click" }],
			}),
		);

		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: Date.now(),
			recordingsRoot: path.join(work, "Recordings"),
			extractFrames: async () => {
				throw new Error("ffmpeg is unavailable");
			},
		});

		expect(await readFile(result.screenVideoPath, "utf-8")).toBe("fake-mp4");
		const meta = JSON.parse(await readFile(path.join(result.bundleDir, "meta.json"), "utf-8"));
		expect(meta.stepCapture).toEqual({
			status: "unavailable",
			message:
				"Desktop click frames could not be extracted; this bundle has a transcript-only doc.",
		});
	});

	it("moves artifacts into the bundle folder and writes meta.json", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec-123.webm");
		await writeFile(screenVideoPath, "fake-webm");
		await writeFile(`${screenVideoPath}.cursor.json`, JSON.stringify({ samples: [] }));

		const createdAt = new Date(2026, 6, 11, 16, 42, 7).getTime();
		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt,
			durationMs: 9000,
			recordingsRoot: root,
		});

		const dir = path.join(root, "2026-07-11_164207-recording");
		expect(result.bundleDir).toBe(dir);
		expect(result.screenVideoPath).toBe(path.join(dir, "video.webm"));
		expect(await readFile(result.screenVideoPath, "utf-8")).toBe("fake-webm");
		// telemetry keeps the <videoPath>.cursor.json convention
		expect((await stat(path.join(dir, "video.webm.cursor.json"))).isFile()).toBe(true);
		expect((await stat(path.join(dir, "screenshots"))).isDirectory()).toBe(true);
		const meta = JSON.parse(await readFile(path.join(dir, "meta.json"), "utf-8"));
		expect(meta.video).toBe("video.webm");
		expect(meta.durationMs).toBe(9000);
		// originals are gone (moved, not copied)
		await expect(stat(screenVideoPath)).rejects.toThrow();
	});

	it("tolerates a missing cursor.json and no webcam", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec-456.webm");
		await writeFile(screenVideoPath, "fake-webm");

		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: Date.now(),
			recordingsRoot: root,
		});

		expect(result.webcamVideoPath).toBeUndefined();
		const meta = JSON.parse(await readFile(path.join(result.bundleDir, "meta.json"), "utf-8"));
		expect(meta.cursorTelemetry).toBeUndefined();
	});

	it("preserves an MP4 screen recording's container extension", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "native-recording.mp4");
		await writeFile(screenVideoPath, "fake-mp4");

		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: Date.now(),
			recordingsRoot: root,
		});

		expect(path.basename(result.screenVideoPath)).toBe("video.mp4");
		const meta = JSON.parse(await readFile(path.join(result.bundleDir, "meta.json"), "utf-8"));
		expect(meta.video).toBe("video.mp4");
	});

	it("writes deterministic steps.json and steps.md from clicks + transcript across distinct real bundles", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-"));
		const root = path.join(work, "Recordings");
		const transcriptContent = "[0:01] Open the product catalog\n[0:03] Click the upload button\n";
		const clicksTelemetry = {
			samples: [
				{ timeMs: 1_250, cx: 0.25, cy: 0.5, interactionType: "click" },
				{ timeMs: 3_500, cx: 0.75, cy: 0.2, interactionType: "click" },
			],
		};

		// Distinct createdAt -> distinct bundle dirs, so the two bundles are real
		// and independent (not the same overwritten directory).
		const createdAtA = new Date(2026, 6, 11, 16, 42, 7).getTime();
		const createdAtB = new Date(2026, 6, 11, 16, 42, 8).getTime();

		const buildOnce = async (createdAt: number, tag: string) => {
			const screenVideoPath = path.join(work, `rec-${tag}.mp4`);
			await writeFile(screenVideoPath, "fake-mp4");
			await writeFile(`${screenVideoPath}.cursor.json`, JSON.stringify(clicksTelemetry));
			return createRecordingBundle({
				screenVideoPath,
				createdAt,
				recordingsRoot: root,
				transcriptContent,
				extractFrames: async () => {
					// no-op: this test asserts on steps.json/steps.md, not extracted frames
				},
			});
		};

		const a = await buildOnce(createdAtA, "a");
		const b = await buildOnce(createdAtB, "b");
		expect(a.bundleDir).not.toBe(b.bundleDir);
		const stepsJsonA = await readFile(path.join(a.bundleDir, "steps.json"), "utf-8");
		const stepsMdA = await readFile(path.join(a.bundleDir, "steps.md"), "utf-8");
		const stepsJsonB = await readFile(path.join(b.bundleDir, "steps.json"), "utf-8");
		const stepsMdB = await readFile(path.join(b.bundleDir, "steps.md"), "utf-8");
		// Both artifacts must be byte-identical across the two distinct bundles.
		expect(stepsJsonA).toBe(stepsJsonB);
		expect(stepsMdA).toBe(stepsMdB);

		// Done-when #2: every steps.md timestamp within 1s of its click.
		const mdSeconds = [...stepsMdA.matchAll(/\[(\d+):(\d{2})\]/g)].map(
			(m) => Number(m[1]) * 60 + Number(m[2]),
		);
		expect(mdSeconds).toEqual([1, 3]);
		for (const [i, clickMs] of [1_250, 3_500].entries()) {
			expect(Math.abs(mdSeconds[i] - Math.floor(clickMs / 1000))).toBeLessThanOrEqual(1);
		}
	});

	it("writes steps.json === [] and a transcript-only steps.md when there are no clicks", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec-noclicks.webm");
		await writeFile(screenVideoPath, "fake-webm");
		await writeFile(`${screenVideoPath}.cursor.json`, JSON.stringify({ samples: [] }));

		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: new Date(2026, 6, 11, 16, 42, 7).getTime(),
			recordingsRoot: root,
			transcriptContent: "[0:04] narrated walkthrough\n",
		});

		const stepsJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const stepsMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(stepsJson).toBe("[]\n");
		expect(stepsMd).toContain("transcript-only");
	});

	it("falls back to Step N labels when transcript.txt is absent", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec-notranscript.mp4");
		await writeFile(screenVideoPath, "fake-mp4");
		await writeFile(
			`${screenVideoPath}.cursor.json`,
			JSON.stringify({
				samples: [{ timeMs: 2_000, cx: 0.5, cy: 0.5, interactionType: "click" }],
			}),
		);

		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: new Date(2026, 6, 11, 16, 42, 7).getTime(),
			recordingsRoot: root,
			extractFrames: async () => {
				// no-op: this test asserts on steps.json/steps.md, not extracted frames
			},
		});

		const stepsJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const steps = JSON.parse(stepsJson) as Step[];
		expect(steps[0].label).toBe("Step 1");
	});
});

describe("parseTranscript", () => {
	it("parses [m:ss] text lines into { startMs, text } preserving file order", () => {
		const content = "[0:01] first action\n[1:30] second action\n";
		expect(parseTranscript(content)).toEqual([
			{ startMs: 1_000, text: "first action" },
			{ startMs: 90_000, text: "second action" },
		]);
	});

	it("ignores (no speech detected) and (transcription failed) marker lines", () => {
		const content = "(no speech detected)\n[0:04] real segment\n(transcription failed)\n";
		expect(parseTranscript(content)).toEqual([{ startMs: 4_000, text: "real segment" }]);
	});

	it("ignores blank lines and lines without the timestamp marker", () => {
		const content = "\nnot a segment\n[0:02] keep me\n\n";
		expect(parseTranscript(content)).toEqual([{ startMs: 2_000, text: "keep me" }]);
	});

	it("returns [] for empty content", () => {
		expect(parseTranscript("")).toEqual([]);
		expect(parseTranscript("(no speech detected)\n")).toEqual([]);
	});
});

describe("formatStepTimestamp", () => {
	it("matches transcriptFormat.formatTimestamp(ts/1000) across a range of inputs", () => {
		for (const ms of [0, 999, 1_000, 1_250, 59_999, 60_000, 3_599_999, 3_600_000, 90_500]) {
			expect(formatStepTimestamp(ms)).toBe(formatTimestamp(ms / 1000));
		}
	});
});

describe("buildSteps", () => {
	const segments: TranscriptSegment[] = [
		{ startMs: 1_000, text: "first action" },
		{ startMs: 3_000, text: "second action" },
	];

	it("picks the active segment (greatest startMs <= click.timeMs)", () => {
		const clicks: ClickInput[] = [
			{ timeMs: 1_250, cx: 0.25, cy: 0.5, outputPath: "step-01.png" },
			{ timeMs: 3_500, cx: 0.75, cy: 0.2, outputPath: "step-02.png" },
		];
		const steps = buildSteps(clicks, segments);
		expect(steps.map((s) => s.label)).toEqual(["first action", "second action"]);
	});

	it("falls back to Step N when the click precedes all segments", () => {
		const clicks: ClickInput[] = [{ timeMs: 500, cx: 0.1, cy: 0.1, outputPath: "step-01.png" }];
		expect(buildSteps(clicks, segments)[0].label).toBe("Step 1");
	});

	it("falls back to Step N when there are no segments", () => {
		const clicks: ClickInput[] = [{ timeMs: 1_250, cx: 0.25, cy: 0.5, outputPath: "step-01.png" }];
		expect(buildSteps(clicks, [])[0].label).toBe("Step 1");
	});

	it("trims whitespace from segment text", () => {
		const clicks: ClickInput[] = [{ timeMs: 1_500, cx: 0.25, cy: 0.5, outputPath: "step-01.png" }];
		expect(buildSteps(clicks, [{ startMs: 1_000, text: "   padded text   " }])[0].label).toBe(
			"padded text",
		);
	});

	it("uses a complete spoken phrase instead of the final word as a step label", () => {
		const clicks: ClickInput[] = [{ timeMs: 4_000, cx: 0.25, cy: 0.5, outputPath: "step-01.png" }];
		const words: TranscriptSegment[] = [
			{ startMs: 0, text: "I" },
			{ startMs: 100, text: "hope" },
			{ startMs: 200, text: "this" },
			{ startMs: 300, text: "is" },
			{ startMs: 400, text: "a" },
			{ startMs: 500, text: "great" },
			{ startMs: 600, text: "one." },
		];

		expect(buildSteps(clicks, words)[0]?.label).toBe("I hope this is a great one.");
	});

	it("produces the full Step contract (ts, coords, tier, redaction, screenshot)", () => {
		const clicks: ClickInput[] = [{ timeMs: 1_250, cx: 0.25, cy: 0.5, outputPath: "step-01.png" }];
		expect(buildSteps(clicks, segments)).toEqual([
			{
				label: "first action",
				ts: 1_250,
				coords: { cx: 0.25, cy: 0.5 },
				tier: "desktop",
				redaction: false,
				screenshot: "step-01.png",
			},
		]);
	});

	it("is deterministic: identical inputs produce deep-equal steps", () => {
		const clicks: ClickInput[] = [
			{ timeMs: 1_250, cx: 0.25, cy: 0.5, outputPath: "step-01.png" },
			{ timeMs: 3_500, cx: 0.75, cy: 0.2, outputPath: "step-02.png" },
		];
		expect(buildSteps(clicks, segments)).toEqual(buildSteps(clicks, segments));
	});
});

describe("renderStepsMarkdown", () => {
	it("keeps redacted text out of Markdown unless its step explicitly opts in", () => {
		const steps: Step[] = [
			{
				label: "Type the one-time code",
				ts: 1_250,
				coords: { cx: 0.25, cy: 0.5 },
				tier: "browser",
				redaction: true,
				screenshot: "step-01.png",
			},
			{
				label: "Type the one-time code",
				ts: 2_500,
				coords: { cx: 0.25, cy: 0.5 },
				tier: "browser",
				redaction: true,
				includeRevealedText: true,
				screenshot: "step-02.png",
			},
		];

		const markdown = renderStepsMarkdown(steps);

		expect(markdown).toContain("1. [0:01] [redacted]");
		expect(markdown).toContain("2. [0:02] Type the one-time code");
	});

	it("renders 'N. [m:ss] label' with a screenshot reference for each step", () => {
		const steps: Step[] = [
			{
				label: "first action",
				ts: 1_250,
				coords: { cx: 0.25, cy: 0.5 },
				tier: "desktop",
				redaction: false,
				screenshot: "step-01.png",
			},
		];
		const md = renderStepsMarkdown(steps);
		expect(md).toContain("1. [0:01] first action");
		expect(md).toContain("step-01.png");
	});

	it("renders a transcript-only note when there are no steps", () => {
		const md = renderStepsMarkdown([]);
		expect(md).toContain("transcript-only");
	});
});

describe("updateWorkflowDocument", () => {
	it("persists title and step edits, deletion, and the safe revealed-text default", async () => {
		const bundleDir = await mkdtemp(path.join(os.tmpdir(), "showhow-doc-edit-"));
		await writeFile(
			path.join(bundleDir, "meta.json"),
			JSON.stringify({
				schemaVersion: 1,
				title: "Original recording",
				source: "browser",
				createdAt: 1,
				video: "video.webm",
				transcript: "transcript.txt",
				steps: null,
			}),
		);
		await writeFile(
			path.join(bundleDir, "steps.json"),
			serializeStepsJson([
				{
					label: "Type account number",
					ts: 1_000,
					coords: { cx: 0, cy: 0 },
					tier: "browser",
					redaction: true,
					screenshot: "step-01.png",
				},
				{
					label: "Submit form",
					ts: 2_000,
					coords: { cx: 0, cy: 0 },
					tier: "browser",
					redaction: false,
					screenshot: "step-02.png",
				},
			]),
		);

		await updateWorkflowDocument(bundleDir, { type: "title", title: "Add an account" });
		await updateWorkflowDocument(bundleDir, {
			type: "step",
			index: 0,
			label: "Type account number 1234",
		});
		await updateWorkflowDocument(bundleDir, { type: "delete-step", index: 1 });

		expect(JSON.parse(await readFile(path.join(bundleDir, "meta.json"), "utf-8")).title).toBe(
			"Add an account",
		);
		expect(JSON.parse(await readFile(path.join(bundleDir, "steps.json"), "utf-8"))).toEqual([
			expect.objectContaining({
				label: "Type account number 1234",
				redaction: true,
				includeRevealedText: false,
			}),
		]);
		expect(await readFile(path.join(bundleDir, "steps.md"), "utf-8")).toContain("[redacted]");
	});
});

describe("serializeStepsJson", () => {
	it("serializes steps with JSON.stringify(steps, null, 2) + trailing newline", () => {
		const steps: Step[] = [
			{
				label: "first action",
				ts: 1_250,
				coords: { cx: 0.25, cy: 0.5 },
				tier: "desktop",
				redaction: false,
				screenshot: "step-01.png",
			},
		];
		expect(serializeStepsJson(steps)).toBe(`${JSON.stringify(steps, null, 2)}\n`);
	});

	it("serializes an empty step array as '[]\\n'", () => {
		expect(serializeStepsJson([])).toBe("[]\n");
	});

	it("is deterministic: identical steps produce identical serialized output", () => {
		const steps: Step[] = [
			{
				label: "first action",
				ts: 1_250,
				coords: { cx: 0.25, cy: 0.5 },
				tier: "desktop",
				redaction: false,
				screenshot: "step-01.png",
			},
		];
		expect(serializeStepsJson(steps)).toBe(serializeStepsJson(steps));
	});
});

describe("steps.md timestamp proximity (Done-when #2)", () => {
	it("every steps.md timestamp is within 1s of its click", () => {
		const clicks: ClickInput[] = [
			{ timeMs: 1_250, cx: 0.25, cy: 0.5, outputPath: "step-01.png" },
			{ timeMs: 3_500, cx: 0.75, cy: 0.2, outputPath: "step-02.png" },
			{ timeMs: 65_999, cx: 0.5, cy: 0.5, outputPath: "step-03.png" },
		];
		const segments: TranscriptSegment[] = [
			{ startMs: 1_000, text: "first" },
			{ startMs: 3_000, text: "second" },
			{ startMs: 65_000, text: "third" },
		];
		const steps = buildSteps(clicks, segments);
		const md = renderStepsMarkdown(steps);
		const mdSeconds = [...md.matchAll(/\[(\d+):(\d{2})\]/g)].map(
			(m) => Number(m[1]) * 60 + Number(m[2]),
		);
		expect(mdSeconds).toHaveLength(clicks.length);
		for (const [i, click] of clicks.entries()) {
			expect(Math.abs(mdSeconds[i] - Math.floor(click.timeMs / 1000))).toBeLessThanOrEqual(1);
		}
	});
});

describe("steps determinism (Done-when #1)", () => {
	it("serialized steps.json string is identical across two runs from identical inputs", () => {
		const clicks: ClickInput[] = [
			{ timeMs: 1_250, cx: 0.25, cy: 0.5, outputPath: "step-01.png" },
			{ timeMs: 3_500, cx: 0.75, cy: 0.2, outputPath: "step-02.png" },
		];
		const segments: TranscriptSegment[] = [
			{ startMs: 1_000, text: "first action" },
			{ startMs: 3_000, text: "second action" },
		];
		const run1 = serializeStepsJson(buildSteps(clicks, segments));
		const run2 = serializeStepsJson(buildSteps(clicks, segments));
		expect(run1).toBe(run2);
	});
});

describe("Step screenshot contract (deterministic from immutable inputs)", () => {
	it("buildSteps always emits the source-derived step-NN.png filename regardless of frame existence", () => {
		const clicks: ClickInput[] = [
			{ timeMs: 1_250, cx: 0.25, cy: 0.5, outputPath: "step-01.png" },
			{ timeMs: 3_500, cx: 0.75, cy: 0.2, outputPath: "step-02.png" },
		];
		const steps = buildSteps(clicks, []);
		expect(steps.map((s) => s.screenshot)).toEqual(["step-01.png", "step-02.png"]);
	});

	it("renderStepsMarkdown always emits the screenshots/step-NN.png reference for every step", () => {
		const steps: Step[] = [
			{
				label: "a",
				ts: 1_250,
				coords: { cx: 0.25, cy: 0.5 },
				tier: "desktop",
				redaction: false,
				screenshot: "step-01.png",
			},
			{
				label: "b",
				ts: 3_500,
				coords: { cx: 0.75, cy: 0.2 },
				tier: "desktop",
				redaction: false,
				screenshot: "step-02.png",
			},
		];
		const md = renderStepsMarkdown(steps);
		expect(md).toContain("![step-01.png](screenshots/step-01.png)");
		expect(md).toContain("![step-02.png](screenshots/step-02.png)");
	});
});

describe("createRecordingBundle frame-extraction failure", () => {
	it("preserves deterministic step-NN.png screenshot refs even when extraction fails", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec-fail.mp4");
		await writeFile(screenVideoPath, "fake-mp4");
		await writeFile(
			`${screenVideoPath}.cursor.json`,
			JSON.stringify({
				samples: [
					{ timeMs: 1_250, cx: 0.25, cy: 0.5, interactionType: "click" },
					{ timeMs: 3_500, cx: 0.75, cy: 0.2, interactionType: "click" },
				],
			}),
		);

		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: new Date(2026, 6, 11, 16, 42, 7).getTime(),
			recordingsRoot: root,
			transcriptContent: "[0:01] first\n[0:03] second\n",
			extractFrames: async () => {
				throw new Error("ffmpeg unavailable");
			},
		});

		const steps = JSON.parse(
			await readFile(path.join(result.bundleDir, "steps.json"), "utf-8"),
		) as Step[];
		// Contract: screenshot is the deterministic source-derived filename,
		// NOT blanked based on filesystem existence.
		expect(steps.map((s) => s.screenshot)).toEqual(["step-01.png", "step-02.png"]);
		const md = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(md).toContain("screenshots/step-01.png");
		expect(md).toContain("screenshots/step-02.png");
		// video is preserved
		expect(await readFile(result.screenVideoPath, "utf-8")).toBe("fake-mp4");
	});

	it("preserves deterministic step-NN.png refs for all steps on partial extraction", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec-partial.mp4");
		await writeFile(screenVideoPath, "fake-mp4");
		await writeFile(
			`${screenVideoPath}.cursor.json`,
			JSON.stringify({
				samples: [
					{ timeMs: 1_250, cx: 0.25, cy: 0.5, interactionType: "click" },
					{ timeMs: 3_500, cx: 0.75, cy: 0.2, interactionType: "click" },
				],
			}),
		);

		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: new Date(2026, 6, 11, 16, 42, 7).getTime(),
			recordingsRoot: root,
			transcriptContent: "[0:01] first\n[0:03] second\n",
			extractFrames: async ({ clicks, screenshotsDir }) => {
				// Only write the first frame; simulate partial failure.
				const { writeFile: wf } = await import("node:fs/promises");
				await wf(path.join(screenshotsDir, clicks[0].outputPath), "png");
			},
		});

		const steps = JSON.parse(
			await readFile(path.join(result.bundleDir, "steps.json"), "utf-8"),
		) as Step[];
		expect(steps[0].screenshot).toBe("step-01.png");
		expect(steps[1].screenshot).toBe("step-02.png");
		const md = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(md).toContain("screenshots/step-01.png");
		expect(md).toContain("screenshots/step-02.png");
	});
});

describe("regenerateDocArtifacts", () => {
	it("preserves browser-tier source steps when a late transcript arrives", async () => {
		const bundleDir = await mkdtemp(path.join(os.tmpdir(), "showhow-browser-steps-"));
		await writeFile(
			path.join(bundleDir, "meta.json"),
			JSON.stringify({ video: "video.webm", transcript: "transcript.txt" }),
			"utf-8",
		);
		await persistBrowserSteps(bundleDir, [
			{
				tier: "browser",
				ts: 1_500,
				label: "Type Password",
				coords: { cx: 0.2, cy: 0.3 },
				redaction: true,
				screenshot: "data:image/png;base64,iVBORw0KGgo=",
			},
		]);
		await writeFile(path.join(bundleDir, "transcript.txt"), "[0:01] desktop narration\n", "utf-8");

		await regenerateDocArtifacts(bundleDir);

		expect(JSON.parse(await readFile(path.join(bundleDir, "steps.json"), "utf-8"))).toEqual([
			expect.objectContaining({
				label: "Type Password",
				tier: "browser",
				redaction: true,
				screenshot: "step-01.png",
			}),
		]);
	});
	async function buildBundleWithClicks(opts: {
		transcriptContent?: string;
		extractFrames?: FrameExtractor;
		clicks?: { timeMs: number; cx: number; cy: number }[];
	}) {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-regen-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec.mp4");
		await writeFile(screenVideoPath, "fake-mp4");
		await writeFile(
			`${screenVideoPath}.cursor.json`,
			JSON.stringify({
				samples: (
					opts.clicks ?? [
						{ timeMs: 1_250, cx: 0.25, cy: 0.5, interactionType: "click" },
						{ timeMs: 3_500, cx: 0.75, cy: 0.2, interactionType: "click" },
					]
				).map((c) => ({ ...c, interactionType: "click" })),
			}),
		);
		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: new Date(2026, 6, 11, 16, 42, 7).getTime(),
			recordingsRoot: root,
			...(opts.transcriptContent !== undefined
				? { transcriptContent: opts.transcriptContent }
				: {}),
			extractFrames:
				opts.extractFrames ??
				(async ({ clicks, screenshotsDir }) => {
					const { writeFile: wf } = await import("node:fs/promises");
					for (const c of clicks) await wf(path.join(screenshotsDir, c.outputPath), "png");
				}),
		});
		return { result, root };
	}

	it("serializes overlapping regenerations of the same bundle without spurious failures", async () => {
		const { result } = await buildBundleWithClicks({
			transcriptContent: "[0:01] Open the product catalog\n[0:03] Click the upload button\n",
		});

		// Fire several regenerations of the SAME bundle concurrently. With shared
		// steps.*.tmp staging and no per-bundle serialization, an interleaved
		// sibling renames a temp out from under another run (ENOENT). All must resolve.
		const regens = await Promise.all([
			regenerateDocArtifacts(result.bundleDir),
			regenerateDocArtifacts(result.bundleDir),
			regenerateDocArtifacts(result.bundleDir),
			regenerateDocArtifacts(result.bundleDir),
		]);
		for (const regen of regens) expect(regen.success).toBe(true);

		// Final artifacts are a matched pair, and no staging temp files leak.
		const steps = JSON.parse(
			await readFile(path.join(result.bundleDir, "steps.json"), "utf-8"),
		) as Step[];
		const md = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		for (const step of steps) expect(md).toContain(step.label);
		const entries = await readdir(result.bundleDir);
		expect(entries.filter((e) => e.endsWith(".tmp"))).toEqual([]);
	});

	it("regenerates steps.json and steps.md from stored telemetry + newly written transcript (root-cause fix)", async () => {
		// Bundle created with NO transcript -> labels are "Step N".
		const { result } = await buildBundleWithClicks({});
		const before = JSON.parse(
			await readFile(path.join(result.bundleDir, "steps.json"), "utf-8"),
		) as Step[];
		expect(before.map((s) => s.label)).toEqual(["Step 1", "Step 2"]);

		// Transcript arrives later (the production IPC writes it after caption pipeline).
		await writeFile(
			path.join(result.bundleDir, "transcript.txt"),
			"[0:01] Open the product catalog\n[0:03] Click the upload button\n",
			"utf-8",
		);

		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(true);
		expect(regen.transcriptAvailable).toBe(true);
		expect(regen.stepsWritten).toBe(2);

		const after = JSON.parse(
			await readFile(path.join(result.bundleDir, "steps.json"), "utf-8"),
		) as Step[];
		expect(after.map((s) => s.label)).toEqual([
			"Open the product catalog",
			"Click the upload button",
		]);
		const md = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(md).toContain("[0:01] Open the product catalog");
		expect(md).toContain("[0:03] Click the upload button");
	});

	it("is deterministic: regenerating twice on the same bundle yields byte-identical steps.json AND steps.md", async () => {
		const { result } = await buildBundleWithClicks({
			transcriptContent: "[0:01] first\n[0:03] second\n",
		});
		await regenerateDocArtifacts(result.bundleDir);
		const json1 = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const md1 = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		await regenerateDocArtifacts(result.bundleDir);
		const json2 = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const md2 = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(json1).toBe(json2);
		expect(md1).toBe(md2);
	});

	it("reuses stored cursor telemetry, click ordering, and screenshot filenames", async () => {
		const { result } = await buildBundleWithClicks({
			clicks: [
				{ timeMs: 5_000, cx: 0.1, cy: 0.1 },
				{ timeMs: 1_000, cx: 0.9, cy: 0.9 },
			],
			transcriptContent: "[0:01] early\n[0:05] late\n",
		});
		await regenerateDocArtifacts(result.bundleDir);
		const steps = JSON.parse(
			await readFile(path.join(result.bundleDir, "steps.json"), "utf-8"),
		) as Step[];
		// Ordering preserved from telemetry (5s click first, 1s click second).
		expect(steps.map((s) => s.ts)).toEqual([5_000, 1_000]);
		expect(steps.map((s) => s.screenshot)).toEqual(["step-01.png", "step-02.png"]);
		expect(steps.map((s) => s.label)).toEqual(["late", "early"]);
	});

	it("gracefully falls back to Step N labels when transcript is unavailable", async () => {
		const { result } = await buildBundleWithClicks({});
		// No transcript.txt written.
		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(true);
		expect(regen.transcriptAvailable).toBe(false);
		const steps = JSON.parse(
			await readFile(path.join(result.bundleDir, "steps.json"), "utf-8"),
		) as Step[];
		expect(steps.map((s) => s.label)).toEqual(["Step 1", "Step 2"]);
	});

	it("preserves deterministic step-NN.png screenshot refs on regeneration even when frames are missing", async () => {
		// Build a bundle where extraction failed (no screenshots written).
		const { result } = await buildBundleWithClicks({
			extractFrames: async () => {
				throw new Error("ffmpeg unavailable");
			},
		});
		await writeFile(
			path.join(result.bundleDir, "transcript.txt"),
			"[0:01] first\n[0:03] second\n",
			"utf-8",
		);
		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(true);
		const steps = JSON.parse(
			await readFile(path.join(result.bundleDir, "steps.json"), "utf-8"),
		) as Step[];
		// Contract: screenshot is the deterministic source-derived filename.
		expect(steps.map((s) => s.screenshot)).toEqual(["step-01.png", "step-02.png"]);
		const md = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(md).toContain("screenshots/step-01.png");
		expect(md).toContain("screenshots/step-02.png");
	});

	it("handles a bundle with no cursor telemetry (no clicks) -> steps.json === []", async () => {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-regen-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec-nocursor.mp4");
		await writeFile(screenVideoPath, "fake-mp4");
		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: new Date(2026, 6, 11, 16, 42, 7).getTime(),
			recordingsRoot: root,
			transcriptContent: "[0:04] narrated\n",
		});
		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(true);
		expect(regen.stepsWritten).toBe(0);
		const json = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		expect(json).toBe("[]\n");
		const md = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(md).toContain("transcript-only");
	});

	it("never discards the video when generation encounters an issue", async () => {
		const { result } = await buildBundleWithClicks({});
		// Corrupt the cursor telemetry to provoke a read/parse path; video must survive.
		await writeFile(path.join(result.bundleDir, "video.mp4.cursor.json"), "{ not valid json");
		const regen = await regenerateDocArtifacts(result.bundleDir);
		// Video is untouched regardless of doc-layer outcome.
		expect(await readFile(result.screenVideoPath, "utf-8")).toBe("fake-mp4");
		// Corrupt telemetry is a required-source-read failure, not a valid
		// zero-click bundle: regeneration must report failure and preserve the
		// pre-existing artifact pair rather than overwriting them with [].
		expect(regen.success).toBe(false);
	});

	it("preserves the pre-existing artifact pair and reports failure when meta.json is corrupt", async () => {
		const { result } = await buildBundleWithClicks({
			transcriptContent: "[0:01] first\n[0:03] second\n",
		});
		const priorJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const priorMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");

		// Corrupt meta.json so the video filename (and thus telemetry path) cannot be resolved.
		await writeFile(path.join(result.bundleDir, "meta.json"), "{ not valid json", "utf-8");

		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(false);
		// The pre-existing pair must be unchanged.
		const afterJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const afterMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(afterJson).toBe(priorJson);
		expect(afterMd).toBe(priorMd);
		// Video untouched.
		expect(await readFile(result.screenVideoPath, "utf-8")).toBe("fake-mp4");
	});

	it("preserves the pre-existing artifact pair and reports failure when cursor telemetry is corrupt", async () => {
		const { result } = await buildBundleWithClicks({
			transcriptContent: "[0:01] first\n[0:03] second\n",
		});
		const priorJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const priorMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");

		// Corrupt the cursor telemetry file (exists but unparseable).
		await writeFile(
			path.join(result.bundleDir, "video.mp4.cursor.json"),
			"{ not valid json",
			"utf-8",
		);

		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(false);
		const afterJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const afterMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(afterJson).toBe(priorJson);
		expect(afterMd).toBe(priorMd);
		// Video untouched.
		expect(await readFile(result.screenVideoPath, "utf-8")).toBe("fake-mp4");
	});

	it("still succeeds for a valid zero-click bundle (telemetry present, samples: [])", async () => {
		// A bundle with valid empty telemetry is a TRUE zero-click bundle, not a
		// read/parse failure -- regeneration must succeed and write [].
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-regen-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec-empty.mp4");
		await writeFile(screenVideoPath, "fake-mp4");
		await writeFile(`${screenVideoPath}.cursor.json`, JSON.stringify({ samples: [] }));
		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: new Date(2026, 6, 11, 16, 42, 7).getTime(),
			recordingsRoot: root,
			transcriptContent: "[0:04] narrated\n",
		});
		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(true);
		expect(regen.stepsWritten).toBe(0);
		const json = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		expect(json).toBe("[]\n");
	});

	it("preserves the pre-existing artifact pair and reports failure when meta.json is missing", async () => {
		const { result } = await buildBundleWithClicks({
			transcriptContent: "[0:01] first\n[0:03] second\n",
		});
		const priorJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const priorMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");

		// Remove meta.json entirely -- a required source is missing.
		const { rm } = await import("node:fs/promises");
		await rm(path.join(result.bundleDir, "meta.json"), { force: true });

		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(false);
		const afterJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const afterMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(afterJson).toBe(priorJson);
		expect(afterMd).toBe(priorMd);
		expect(await readFile(result.screenVideoPath, "utf-8")).toBe("fake-mp4");
	});

	it("preserves the pre-existing artifact pair and reports failure when meta.json is structurally invalid (empty object)", async () => {
		const { result } = await buildBundleWithClicks({
			transcriptContent: "[0:01] first\n[0:03] second\n",
		});
		const priorJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const priorMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");

		// Valid JSON but lacks the required `video` field -> cannot resolve telemetry.
		await writeFile(path.join(result.bundleDir, "meta.json"), "{}", "utf-8");

		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(false);
		const afterJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const afterMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(afterJson).toBe(priorJson);
		expect(afterMd).toBe(priorMd);
		expect(await readFile(result.screenVideoPath, "utf-8")).toBe("fake-mp4");
	});

	it("preserves the pre-existing artifact pair and reports failure when meta declares cursorTelemetry but the telemetry file is missing", async () => {
		const { result } = await buildBundleWithClicks({
			transcriptContent: "[0:01] first\n[0:03] second\n",
		});
		const priorJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const priorMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");

		// meta.json declares cursorTelemetry but the telemetry file is gone.
		const { rm } = await import("node:fs/promises");
		await rm(path.join(result.bundleDir, "video.mp4.cursor.json"), { force: true });

		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(false);
		const afterJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const afterMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(afterJson).toBe(priorJson);
		expect(afterMd).toBe(priorMd);
		expect(await readFile(result.screenVideoPath, "utf-8")).toBe("fake-mp4");
	});

	it("still succeeds for a valid meta without cursorTelemetry (true zero-click, no telemetry file)", async () => {
		// A valid Showhow meta that explicitly omits cursorTelemetry is a true
		// zero-click bundle -- regeneration must succeed and write [].
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-regen-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec-nocursor.mp4");
		await writeFile(screenVideoPath, "fake-mp4");
		// No cursor.json beside the source -> createRecordingBundle writes meta
		// without cursorTelemetry.
		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: new Date(2026, 6, 11, 16, 42, 7).getTime(),
			recordingsRoot: root,
			transcriptContent: "[0:04] narrated\n",
		});
		const meta = JSON.parse(await readFile(path.join(result.bundleDir, "meta.json"), "utf-8"));
		expect(meta.cursorTelemetry).toBeUndefined();
		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(true);
		expect(regen.stepsWritten).toBe(0);
		const json = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		expect(json).toBe("[]\n");
	});
});

describe("regenerateDocArtifacts rollback safety (paired writes)", () => {
	async function buildBundleWithClicks(opts: {
		transcriptContent?: string;
		extractFrames?: FrameExtractor;
		clicks?: { timeMs: number; cx: number; cy: number }[];
	}) {
		const work = await mkdtemp(path.join(os.tmpdir(), "showhow-regen-"));
		const root = path.join(work, "Recordings");
		const screenVideoPath = path.join(work, "rec.mp4");
		await writeFile(screenVideoPath, "fake-mp4");
		await writeFile(
			`${screenVideoPath}.cursor.json`,
			JSON.stringify({
				samples: (
					opts.clicks ?? [
						{ timeMs: 1_250, cx: 0.25, cy: 0.5, interactionType: "click" },
						{ timeMs: 3_500, cx: 0.75, cy: 0.2, interactionType: "click" },
					]
				).map((c) => ({ ...c, interactionType: "click" })),
			}),
		);
		const result = await createRecordingBundle({
			screenVideoPath,
			createdAt: new Date(2026, 6, 11, 16, 42, 7).getTime(),
			recordingsRoot: root,
			...(opts.transcriptContent !== undefined
				? { transcriptContent: opts.transcriptContent }
				: {}),
			extractFrames:
				opts.extractFrames ??
				(async ({ clicks, screenshotsDir }) => {
					const { writeFile: wf } = await import("node:fs/promises");
					for (const c of clicks) await wf(path.join(screenshotsDir, c.outputPath), "png");
				}),
		});
		return { result, root };
	}

	it("leaves the prior paired artifacts unchanged when the second-artifact (steps.md) write fails", async () => {
		const { result } = await buildBundleWithClicks({
			transcriptContent: "[0:01] first\n[0:03] second\n",
		});
		// Establish a known-good prior pair.
		const priorJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const priorMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");

		// Write a new transcript so regeneration would produce different content.
		await writeFile(
			path.join(result.bundleDir, "transcript.txt"),
			"[0:01] updated first\n[0:03] updated second\n",
			"utf-8",
		);

		// Seam that fails only when staging steps.md (the second artifact). The
		// writer stages to *.tmp files, so the seam matches the temp path.
		let mdWriteAttempts = 0;
		const seam: WriteDocArtifactsSeam = {
			writeFile: async (filePath, _content) => {
				if (filePath.endsWith("steps.md.tmp")) {
					mdWriteAttempts += 1;
					throw new Error("simulated steps.md write failure");
				}
				await writeFile(filePath, _content, "utf-8");
			},
		};

		const regen = await regenerateDocArtifacts(result.bundleDir, seam);
		expect(regen.success).toBe(false);
		expect(mdWriteAttempts).toBe(1);

		// The prior pair must be unchanged: no new steps.json with updated labels
		// left alongside a stale/missing steps.md.
		const afterJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const afterMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(afterJson).toBe(priorJson);
		expect(afterMd).toBe(priorMd);
		// Specifically, the updated labels must NOT have landed in steps.json.
		expect(afterJson).not.toContain("updated first");
		// No leftover temp files.
		const entries = await readdir(result.bundleDir);
		expect(entries.filter((e) => e.endsWith(".tmp"))).toEqual([]);
	});

	it("leaves the prior paired artifacts unchanged when the first-artifact (steps.json) write fails", async () => {
		const { result } = await buildBundleWithClicks({
			transcriptContent: "[0:01] first\n[0:03] second\n",
		});
		const priorJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const priorMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");

		await writeFile(
			path.join(result.bundleDir, "transcript.txt"),
			"[0:01] updated first\n[0:03] updated second\n",
			"utf-8",
		);

		const seam: WriteDocArtifactsSeam = {
			writeFile: async (filePath, _content) => {
				if (filePath.endsWith("steps.json.tmp")) {
					throw new Error("simulated steps.json write failure");
				}
				await writeFile(filePath, _content, "utf-8");
			},
		};

		const regen = await regenerateDocArtifacts(result.bundleDir, seam);
		expect(regen.success).toBe(false);

		const afterJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const afterMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(afterJson).toBe(priorJson);
		expect(afterMd).toBe(priorMd);
		expect(afterJson).not.toContain("updated first");
		// No leftover temp files.
		const entries = await readdir(result.bundleDir);
		expect(entries.filter((e) => e.endsWith(".tmp"))).toEqual([]);
	});

	it("promotes both new artifacts atomically when no failure occurs", async () => {
		const { result } = await buildBundleWithClicks({
			transcriptContent: "[0:01] first\n[0:03] second\n",
		});
		await writeFile(
			path.join(result.bundleDir, "transcript.txt"),
			"[0:01] updated first\n[0:03] updated second\n",
			"utf-8",
		);
		const regen = await regenerateDocArtifacts(result.bundleDir);
		expect(regen.success).toBe(true);
		const afterJson = await readFile(path.join(result.bundleDir, "steps.json"), "utf-8");
		const afterMd = await readFile(path.join(result.bundleDir, "steps.md"), "utf-8");
		expect(afterJson).toContain("updated first");
		expect(afterMd).toContain("updated first");
	});
});
