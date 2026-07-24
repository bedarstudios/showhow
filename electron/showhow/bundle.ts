import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

/** Root for all Showhow recording bundles. One folder per recording; the folder IS the recording. */
export const SHOWHOW_RECORDINGS_ROOT = path.join(os.homedir(), "Showhow", "Recordings");

export interface ShowhowMeta {
	schemaVersion: 1;
	title: string;
	source: "desktop";
	createdAt: number;
	durationMs?: number;
	video: "video.webm" | "video.mp4";
	webcam?: "webcam.webm";
	/** Kept at the editor's `${videoPath}.cursor.json` convention -- see handlers.ts telemetry loading. */
	cursorTelemetry?: "video.webm.cursor.json" | "video.mp4.cursor.json";
	transcript: "transcript.txt";
	/** Filled by the Phase 2 doc engine. */
	steps: null;
	stepCapture?: {
		status: "available" | "unavailable";
		message?: string;
	};
}

export interface BuildMetaInput {
	createdAt: number;
	durationMs?: number;
	hasWebcam: boolean;
	hasCursorTelemetry: boolean;
	videoFileName?: "video.webm" | "video.mp4";
}

export interface CreateBundleInput {
	screenVideoPath: string;
	webcamVideoPath?: string;
	createdAt: number;
	durationMs?: number;
	/** Test seam; production callers omit it. */
	recordingsRoot?: string;
	/** Test seam; production callers omit it. */
	extractFrames?: FrameExtractor;
	/**
	 * Test seam; production callers omit it. When provided, the text is written
	 * to `transcript.txt` in the bundle before step generation so the doc engine
	 * can match transcript segments to clicks. In production, transcript.txt is
	 * written by the separate caption pipeline; if it is not present at bundle
	 * time, step labels fall back to `Step N`.
	 */
	transcriptContent?: string;
}

export interface CreateBundleResult {
	bundleDir: string;
	screenVideoPath: string;
	webcamVideoPath?: string;
}

interface ClickSample {
	timeMs: number;
	cx: number;
	cy: number;
	interactionType?: string;
}

export interface StepFrame {
	timeMs: number;
	cx: number;
	cy: number;
	outputPath: string;
}

export interface FrameExtractorInput {
	videoPath: string;
	screenshotsDir: string;
	clicks: StepFrame[];
}

export type FrameExtractor = (input: FrameExtractorInput) => Promise<void>;

const pad = (n: number) => String(n).padStart(2, "0");

// --- Phase 2 doc engine: deterministic steps.json / steps.md -----------------

/** A parsed transcript segment. `startMs` is the segment start in milliseconds. */
export interface TranscriptSegment {
	startMs: number;
	text: string;
}

/** A single click fed to the step builder. */
export interface ClickInput {
	timeMs: number;
	cx: number;
	cy: number;
	/** The `step-NN.png` filename already assigned to this click's frame. */
	outputPath: string;
}

/** The source-of-truth Step record written to steps.json. */
export interface Step {
	label: string;
	/** Click time in milliseconds (integer, source of truth). */
	ts: number;
	coords: { cx: number; cy: number };
	tier: "desktop";
	redaction: false;
	/** The `step-NN.png` filename inside `screenshots/`. */
	screenshot: string;
}

const TRANSCRIPT_LINE = /^\[(\d+):(\d{2})\]\s+(.*)$/u;
const TRANSCRIPT_MARKERS = new Set(["(no speech detected)", "(transcription failed)"]);

/**
 * Parse transcript.txt content into `{ startMs, text }` segments, preserving
 * file order. Lines that are blank, marker lines (`(no speech detected)` /
 * `(transcription failed)`), or lack the `[m:ss]` prefix are ignored.
 * Deterministic: no locale, no Date, no random.
 */
export function parseTranscript(content: string): TranscriptSegment[] {
	const segments: TranscriptSegment[] = [];
	for (const rawLine of content.split("\n")) {
		const line = rawLine.trim();
		if (line === "") continue;
		if (TRANSCRIPT_MARKERS.has(line)) continue;
		const match = TRANSCRIPT_LINE.exec(line);
		if (!match) continue;
		const minutes = Number(match[1]);
		const seconds = Number(match[2]);
		const text = match[3].trim();
		segments.push({ startMs: minutes * 60_000 + seconds * 1_000, text });
	}
	return segments;
}

/**
 * Format a click time in milliseconds as the same `[m:ss]` chip transcript.txt
 * uses. Parity with `src/lib/showhow/transcriptFormat.ts#formatTimestamp` is
 * asserted by a dedicated test across a range of inputs.
 */
export function formatStepTimestamp(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Build the Steps array from clicks and transcript segments. For each click (in
 * order, 1-based), the label is the text of the transcript segment with the
 * greatest `startMs <= click.timeMs`. If the click precedes all segments (or
 * there are no segments), the label falls back to `Step N`. Pure and
 * deterministic: no Date, no random, no filesystem iteration order.
 */
export function buildSteps(clicks: ClickInput[], segments: TranscriptSegment[]): Step[] {
	return clicks.map((click, index) => {
		let label: string | undefined;
		let labelStartMs = -Infinity;
		for (const seg of segments) {
			if (seg.startMs <= click.timeMs && seg.startMs >= labelStartMs) {
				labelStartMs = seg.startMs;
				label = seg.text;
			}
		}
		return {
			label: label && label.trim() !== "" ? label.trim() : `Step ${index + 1}`,
			ts: click.timeMs,
			coords: { cx: click.cx, cy: click.cy },
			tier: "desktop",
			redaction: false,
			screenshot: click.outputPath,
		};
	});
}

const TRANSCRIPT_ONLY_NOTE =
	"# Workflow doc\n\nNo desktop clicks were captured; this is a transcript-only doc. See transcript.txt.\n";

/**
 * Render the human/agent-readable steps.md from the Steps array. Each step is
 * `N. [m:ss] label` followed by a screenshot reference. The `[m:ss]` chip is
 * derived from `ts` via `formatStepTimestamp` -- never recomputed from a second
 * source. With zero steps, returns a deterministic transcript-only note.
 */
export function renderStepsMarkdown(steps: Step[]): string {
	if (steps.length === 0) return TRANSCRIPT_ONLY_NOTE;
	const lines: string[] = ["# Workflow doc", ""];
	for (const [i, step] of steps.entries()) {
		lines.push(`${i + 1}. [${formatStepTimestamp(step.ts)}] ${step.label}`);
		lines.push(`   ![${step.screenshot}](screenshots/${step.screenshot})`);
	}
	return `${lines.join("\n")}\n`;
}

/**
 * Serialize the Steps array as the source-of-truth steps.json: a stable
 * `JSON.stringify(steps, null, 2)` followed by a single trailing newline.
 * Deterministic across runs from identical inputs.
 */
export function serializeStepsJson(steps: Step[]): string {
	return `${JSON.stringify(steps, null, 2)}\n`;
}

export function bundleDirName(createdAt: number): string {
	const d = new Date(createdAt);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-recording`;
}

export function buildMeta(input: BuildMetaInput): ShowhowMeta {
	const d = new Date(input.createdAt);
	const title = `Recording ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	const videoFileName = input.videoFileName ?? "video.webm";
	return {
		schemaVersion: 1,
		title,
		source: "desktop",
		createdAt: input.createdAt,
		...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
		video: videoFileName,
		...(input.hasWebcam ? { webcam: "webcam.webm" as const } : {}),
		...(input.hasCursorTelemetry
			? { cursorTelemetry: `${videoFileName}.cursor.json` as ShowhowMeta["cursorTelemetry"] }
			: {}),
		transcript: "transcript.txt",
		steps: null,
	};
}

function clickSamplesFromTelemetry(raw: string): ClickSample[] {
	try {
		const telemetry = JSON.parse(raw) as { samples?: unknown };
		if (!Array.isArray(telemetry.samples)) return [];
		return telemetry.samples.filter(
			(sample): sample is ClickSample =>
				typeof sample === "object" &&
				sample !== null &&
				(sample as ClickSample).interactionType === "click" &&
				typeof (sample as ClickSample).timeMs === "number" &&
				typeof (sample as ClickSample).cx === "number" &&
				typeof (sample as ClickSample).cy === "number",
		);
	} catch {
		return [];
	}
}

function markerFilter(cx: number, cy: number): string {
	const x = Math.min(1, Math.max(0, cx)).toFixed(6);
	const y = Math.min(1, Math.max(0, cy)).toFixed(6);
	return `drawbox=x=iw*${x}-16:y=ih*${y}-16:w=32:h=32:color=red@0.9:t=fill,drawbox=x=iw*${x}-20:y=ih*${y}-20:w=40:h=40:color=white@0.9:t=4`;
}

export const extractDesktopStepFrames: FrameExtractor = async ({
	videoPath,
	screenshotsDir,
	clicks,
}) => {
	for (const click of clicks) {
		await execFile("ffmpeg", [
			"-y",
			"-ss",
			String(click.timeMs / 1000),
			"-i",
			videoPath,
			"-frames:v",
			"1",
			"-vf",
			markerFilter(click.cx, click.cy),
			path.join(screenshotsDir, click.outputPath),
		]);
	}
};

/** Move with cross-device fallback: userData and $HOME are usually one volume, but never assume. */
async function moveFile(src: string, dest: string): Promise<void> {
	try {
		await fs.rename(src, dest);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
		await fs.copyFile(src, dest);
		await fs.rm(src, { force: true });
	}
}

async function fileExists(p: string): Promise<boolean> {
	try {
		await fs.stat(p);
		return true;
	} catch {
		return false;
	}
}

export async function createRecordingBundle(input: CreateBundleInput): Promise<CreateBundleResult> {
	const root = input.recordingsRoot ?? SHOWHOW_RECORDINGS_ROOT;
	const bundleDir = path.join(root, bundleDirName(input.createdAt));
	await fs.mkdir(path.join(bundleDir, "screenshots"), { recursive: true });

	const videoFileName =
		path.extname(input.screenVideoPath).toLowerCase() === ".mp4" ? "video.mp4" : "video.webm";
	const screenDest = path.join(bundleDir, videoFileName);
	await moveFile(input.screenVideoPath, screenDest);

	const cursorSrc = `${input.screenVideoPath}.cursor.json`;
	const hasCursorTelemetry = await fileExists(cursorSrc);
	if (hasCursorTelemetry) {
		await moveFile(cursorSrc, `${screenDest}.cursor.json`);
	}

	const screenshotsDir = path.join(bundleDir, "screenshots");
	const clicks = hasCursorTelemetry
		? clickSamplesFromTelemetry(await fs.readFile(`${screenDest}.cursor.json`, "utf-8"))
		: [];
	const stepFrames = clicks.map((click, index) => ({
		timeMs: click.timeMs,
		cx: click.cx,
		cy: click.cy,
		outputPath: `step-${String(index + 1).padStart(2, "0")}.png`,
	}));
	let stepCapture: ShowhowMeta["stepCapture"];
	if (stepFrames.length === 0) {
		stepCapture = {
			status: "unavailable",
			message: "No desktop clicks were captured; this bundle has a transcript-only doc.",
		};
	} else {
		try {
			await (input.extractFrames ?? extractDesktopStepFrames)({
				videoPath: screenDest,
				screenshotsDir,
				clicks: stepFrames,
			});
			stepCapture = { status: "available" };
		} catch (error) {
			console.warn("[showhow] desktop click frame extraction unavailable:", error);
			stepCapture = {
				status: "unavailable",
				message:
					"Desktop click frames could not be extracted; this bundle has a transcript-only doc.",
			};
		}
	}

	let webcamDest: string | undefined;
	if (input.webcamVideoPath && (await fileExists(input.webcamVideoPath))) {
		webcamDest = path.join(bundleDir, "webcam.webm");
		await moveFile(input.webcamVideoPath, webcamDest);
	}

	const meta = buildMeta({
		createdAt: input.createdAt,
		durationMs: input.durationMs,
		hasWebcam: webcamDest !== undefined,
		hasCursorTelemetry,
		videoFileName,
	});
	if (stepCapture) {
		meta.stepCapture = stepCapture;
	}
	await fs.writeFile(path.join(bundleDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

	// Phase 2 doc engine: generate deterministic steps.json + steps.md from the
	// immutable inputs (clicks + transcript). Transcript.txt may not be present
	// yet (the caption pipeline writes it later); in that case labels fall back
	// to `Step N`. Generation never throws -- a doc-layer failure must never
	// discard a valid recording.
	try {
		if (input.transcriptContent !== undefined) {
			await fs.writeFile(path.join(bundleDir, "transcript.txt"), input.transcriptContent, "utf-8");
		}
		await writeDocArtifacts(bundleDir, stepFrames);
	} catch (error) {
		console.warn("[showhow] step artifact generation failed; bundle remains complete:", error);
	}

	return {
		bundleDir,
		screenVideoPath: screenDest,
		...(webcamDest ? { webcamVideoPath: webcamDest } : {}),
	};
}

export interface RegenerateDocArtifactsResult {
	bundleDir: string;
	success: boolean;
	stepsWritten: number;
	transcriptAvailable: boolean;
}

/**
 * Test seam for the paired doc-artifact writer. Production omits it (uses real
 * `fs`); tests inject a `writeFile` that can simulate a failure on either
 * artifact to prove rollback safety.
 */
export interface WriteDocArtifactsSeam {
	writeFile: (filePath: string, content: string) => Promise<void>;
}

/**
 * Read the stored cursor telemetry from an existing bundle and reconstruct the
 * click ordering + `step-NN.png` screenshot filenames, then deterministically
 * regenerate `steps.json` and `steps.md` from the bundle's current
 * `transcript.txt`. Screenshot references are always the deterministic
 * source-derived `step-NN.png` filenames -- they are NOT blanked based on
 * filesystem existence, because determinism derives from immutable inputs.
 *
 * This is the re-runnable doc engine: production calls it after the caption
 * pipeline writes `transcript.txt` (which happens AFTER `createRecordingBundle`
 * ran with no transcript and produced `Step N` fallback labels). It never
 * mutates the source inputs (video, transcript.txt, *.cursor.json) and never
 * discards the video -- it only writes the two steps artifacts.
 *
 * Paired writes are rollback-safe: both artifact strings are generated first,
 * then staged to temp files; only if BOTH stage successfully are they promoted
 * (renamed) into place. If either stage or promote fails, the prior pair is left
 * unchanged. Never throws; returns `{ success: false, ... }` on failure.
 *
 * Gracefully degrades: missing transcript -> `Step N` labels; missing/unparseable
 * telemetry -> empty steps.
 */
export async function regenerateDocArtifacts(
	bundleDir: string,
	seam?: WriteDocArtifactsSeam,
): Promise<RegenerateDocArtifactsResult> {
	const result: RegenerateDocArtifactsResult = {
		bundleDir,
		success: false,
		stepsWritten: 0,
		transcriptAvailable: false,
	};
	try {
		// Reconstruct stepFrames from the stored cursor telemetry, reusing the
		// stored click ordering and the canonical step-NN.png filenames.
		const stepFrames = await stepFramesFromBundle(bundleDir);
		const { stepsWritten, transcriptAvailable } = await writeDocArtifacts(
			bundleDir,
			stepFrames,
			seam,
		);
		result.success = true;
		result.stepsWritten = stepsWritten;
		result.transcriptAvailable = transcriptAvailable;
	} catch (error) {
		console.warn("[showhow] regenerateDocArtifacts failed; bundle left intact:", error);
	}
	return result;
}

/**
 * Reconstruct the StepFrame list for an existing bundle by reading its stored
 * cursor telemetry (`<videoFileName>.cursor.json`, discovered via `meta.json`).
 * Reuses the stored click ordering and the canonical `step-NN.png` filenames.
 *
 * Distinguishes a TRUE zero-click bundle from a required-source-read/parse
 * failure. A read/parse failure THROWS so the caller can preserve the existing
 * artifact pair and report `success: false` rather than overwriting a valid
 * pair with `[]`/transcript-only output.
 *
 * Required-source failures (throw):
 * - meta.json is missing, unreadable, unparseable, or structurally invalid
 *   (lacks the required `video` field).
 * - meta.json declares `cursorTelemetry` but the telemetry file is missing.
 * - The telemetry file exists but is unreadable or unparseable.
 *
 * True zero-click (return `[]`):
 * - A valid Showhow meta that explicitly omits `cursorTelemetry` (no cursor
 *   tracking was recorded).
 * - A valid telemetry record with `samples: []`.
 */
async function stepFramesFromBundle(bundleDir: string): Promise<StepFrame[]> {
	// meta.json is a required source: missing, unreadable, unparseable, or
	// structurally invalid are all source-read failures, not zero-click.
	const metaPath = path.join(bundleDir, "meta.json");
	if (!(await fileExists(metaPath))) {
		throw new Error("regenerateDocArtifacts: meta.json is missing");
	}
	let meta: ShowhowMeta;
	try {
		meta = JSON.parse(await fs.readFile(metaPath, "utf-8")) as ShowhowMeta;
	} catch (error) {
		throw new Error(`regenerateDocArtifacts: meta.json is unreadable: ${String(error)}`);
	}
	// Structurally validate: the `video` field is required to resolve the
	// telemetry path. An empty object `{}` or any record lacking it is invalid.
	if (
		meta === null ||
		typeof meta !== "object" ||
		typeof (meta as { video?: unknown }).video !== "string" ||
		(meta as { video?: unknown }).video === ""
	) {
		throw new Error("regenerateDocArtifacts: meta.json is structurally invalid (missing video)");
	}
	const videoFileName = meta.video;
	const telemetryPath = path.join(bundleDir, `${videoFileName}.cursor.json`);
	const telemetryExists = await fileExists(telemetryPath);
	// If meta explicitly declares cursorTelemetry, the telemetry file is a
	// required source: its absence is a source-read failure, not zero-click.
	const declaresTelemetry = meta.cursorTelemetry !== undefined;
	if (declaresTelemetry && !telemetryExists) {
		throw new Error(
			"regenerateDocArtifacts: meta.json declares cursorTelemetry but the telemetry file is missing",
		);
	}
	if (!telemetryExists) {
		// Valid meta without cursorTelemetry and no telemetry file -> true
		// zero-click bundle (no cursor tracking was recorded).
		return [];
	}
	let raw: string;
	try {
		raw = await fs.readFile(telemetryPath, "utf-8");
	} catch (error) {
		// Required source-read failure: telemetry file exists but is unreadable.
		throw new Error(`regenerateDocArtifacts: cursor telemetry is unreadable: ${String(error)}`);
	}
	const clicks = clickSamplesFromTelemetryStrict(raw);
	return clicks.map((click, index) => ({
		timeMs: click.timeMs,
		cx: click.cx,
		cy: click.cy,
		outputPath: `step-${String(index + 1).padStart(2, "0")}.png`,
	}));
}

/**
 * Strict variant of `clickSamplesFromTelemetry` used by the regeneration path.
 * Unlike the lenient variant (which returns `[]` on any parse failure, suitable
 * for the initial bundle pass where telemetry was just written), this THROWS on
 * unparseable JSON so the caller can distinguish a corrupt-telemetry source-read
 * failure from a valid zero-click bundle. A valid `samples: []` still returns
 * `[]` (true zero-click).
 */
function clickSamplesFromTelemetryStrict(raw: string): ClickSample[] {
	let telemetry: { samples?: unknown };
	try {
		telemetry = JSON.parse(raw) as { samples?: unknown };
	} catch (error) {
		throw new Error(`regenerateDocArtifacts: cursor telemetry is not valid JSON: ${String(error)}`);
	}
	if (!Array.isArray(telemetry.samples)) {
		// `samples` missing or wrong type is a structural failure, not zero clicks.
		throw new Error("regenerateDocArtifacts: cursor telemetry has no samples array");
	}
	return telemetry.samples.filter(
		(sample): sample is ClickSample =>
			typeof sample === "object" &&
			sample !== null &&
			(sample as ClickSample).interactionType === "click" &&
			typeof (sample as ClickSample).timeMs === "number" &&
			typeof (sample as ClickSample).cx === "number" &&
			typeof (sample as ClickSample).cy === "number",
	);
}

/**
 * Shared doc-artifact writer used by both `createRecordingBundle` (initial pass)
 * and `regenerateDocArtifacts` (re-run after transcript arrives). Reads
 * `transcript.txt` from the bundle if present, builds steps from the given
 * stepFrames (screenshot refs are always the deterministic source-derived
 * `step-NN.png` filenames), and writes deterministic `steps.json` + `steps.md`.
 *
 * Paired writes are rollback-safe: both artifact strings are generated first,
 * then staged to temp files within the bundle dir; only if BOTH stage
 * successfully are they promoted (renamed) into place. If either stage or
 * promote fails, the prior pair is left unchanged (no new artifact paired with
 * a stale/missing companion). Returns the step count and whether a transcript
 * was available. Throws on failure so callers can decide rollback semantics.
 */
async function writeDocArtifacts(
	bundleDir: string,
	stepFrames: StepFrame[],
	seam?: WriteDocArtifactsSeam,
): Promise<{ stepsWritten: number; transcriptAvailable: boolean }> {
	const transcriptPath = path.join(bundleDir, "transcript.txt");
	let transcriptContent = "";
	let transcriptAvailable = false;
	if (await fileExists(transcriptPath)) {
		try {
			transcriptContent = await fs.readFile(transcriptPath, "utf-8");
			transcriptAvailable = true;
		} catch {
			// Degrade to fallback labels rather than failing generation.
			transcriptContent = "";
			transcriptAvailable = false;
		}
	}
	const segments = parseTranscript(transcriptContent);
	const stepClicks: ClickInput[] = stepFrames.map((frame) => ({
		timeMs: frame.timeMs,
		cx: frame.cx,
		cy: frame.cy,
		outputPath: frame.outputPath,
	}));
	const steps = buildSteps(stepClicks, segments);

	const jsonContent = serializeStepsJson(steps);
	const mdContent = renderStepsMarkdown(steps);

	const jsonPath = path.join(bundleDir, "steps.json");
	const mdPath = path.join(bundleDir, "steps.md");
	const jsonTmp = path.join(bundleDir, "steps.json.tmp");
	const mdTmp = path.join(bundleDir, "steps.md.tmp");

	const write = seam?.writeFile ?? defaultWriteFile;

	// Stage both artifacts to temp files first. If either fails, clean up any
	// staged temp and leave the prior pair untouched.
	await write(jsonTmp, jsonContent);
	try {
		await write(mdTmp, mdContent);
	} catch (error) {
		// Clean up the staged steps.json.tmp so no half-staged state remains.
		await fs.rm(jsonTmp, { force: true });
		throw error;
	}

	// Both staged successfully -> promote atomically (rename). If the second
	// rename fails, attempt to restore the first so we don't leave a new
	// artifact paired with a stale companion.
	await promotePaired(jsonPath, jsonTmp, mdPath, mdTmp);

	return { stepsWritten: steps.length, transcriptAvailable };
}

async function defaultWriteFile(filePath: string, content: string): Promise<void> {
	await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Promote two staged temp files into their final paths in a rollback-safe
 * manner. Renames are atomic on the same filesystem. If the second rename
 * fails, attempt to restore the first to its prior state (best-effort) so we
 * don't leave a new artifact paired with a stale/missing companion.
 */
async function promotePaired(
	finalJson: string,
	tmpJson: string,
	finalMd: string,
	tmpMd: string,
): Promise<void> {
	// Preserve prior steps.json for rollback (it may not exist on first write).
	// steps.md need not be preserved: if its rename fails, it was never
	// overwritten, so the prior steps.md (if any) is still on disk untouched.
	let priorJson: Buffer | undefined;
	try {
		priorJson = await fs.readFile(finalJson);
	} catch {
		priorJson = undefined;
	}

	// Promote steps.json.
	await fs.rename(tmpJson, finalJson);
	// Promote steps.md; if it fails, roll back steps.json to its prior state.
	try {
		await fs.rename(tmpMd, finalMd);
	} catch (error) {
		// Restore steps.json to its prior content (or remove if it didn't exist).
		if (priorJson !== undefined) {
			await fs.writeFile(finalJson, priorJson);
		} else {
			await fs.rm(finalJson, { force: true });
		}
		throw error;
	}
}
