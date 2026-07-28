import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface BundleAuditDiagnostic {
	kind: "transcript-timestamp-beyond-meta-duration";
	timestampMs: number;
	durationMs: number;
}

interface ContractArtifact {
	path: string | null;
	present: boolean;
}

export interface BundleAuditReport {
	bundleDir: string;
	acceptancePassed: boolean;
	contract: {
		complete: boolean;
		video: ContractArtifact;
		transcript: ContractArtifact;
		stepsJson: ContractArtifact;
		stepsMarkdown: ContractArtifact;
		screenshots: ContractArtifact;
		meta: ContractArtifact;
	};
	cursorTelemetry: {
		declaredPath: string | null;
		present: boolean;
		clickTimestampsMs: number[];
	};
	screenshots: {
		count: number;
		stepCount: number;
		matchesStepCount: boolean;
		referencedPaths: string[];
		missingReferencedPaths: string[];
		allReferencesPresent: boolean;
	};
	steps: {
		timestampsMs: number[];
		matchClickTelemetryExactly: boolean;
		markdownChipTimestampsMs: number[];
		markdownChipDeltasMs: number[];
		markdownChipsWithinOneSecond: boolean;
	};
	diagnostics: BundleAuditDiagnostic[];
}

interface BundleMeta {
	video?: unknown;
	cursorTelemetry?: unknown;
	durationMs?: unknown;
}

const TIMESTAMP_LINE = /^\[(\d+):(\d{2})\]\s+/u;
const STEP_CHIP = /^\s*\d+\.\s+\[(\d+):(\d{2})\]/u;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function timestampMs(minutes: string, seconds: string): number {
	return (Number(minutes) * 60 + Number(seconds)) * 1_000;
}

async function exists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function readJson(filePath: string): Promise<unknown> {
	try {
		return JSON.parse(await readFile(filePath, "utf-8")) as unknown;
	} catch {
		return undefined;
	}
}

function pathFromMeta(meta: BundleMeta, key: "video" | "cursorTelemetry"): string | null {
	const value = meta[key];
	return typeof value === "string" ? value : null;
}

function stepTimestamps(value: unknown): number[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((step) =>
		isRecord(step) && typeof step.ts === "number" && Number.isFinite(step.ts) ? [step.ts] : [],
	);
}

function stepScreenshotPaths(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((step) =>
		isRecord(step) && typeof step.screenshot === "string" && step.screenshot.length > 0
			? [step.screenshot]
			: [],
	);
}

function clickTimestamps(value: unknown): number[] {
	if (!isRecord(value) || !Array.isArray(value.samples)) return [];
	return value.samples.flatMap((sample) =>
		isRecord(sample) &&
		sample.interactionType === "click" &&
		typeof sample.timeMs === "number" &&
		Number.isFinite(sample.timeMs)
			? [sample.timeMs]
			: [],
	);
}

function parseTimestampLines(content: string, pattern: RegExp): number[] {
	return content.split("\n").flatMap((line) => {
		const match = pattern.exec(line);
		return match ? [timestampMs(match[1], match[2])] : [];
	});
}

function matchesExactly(left: number[], right: number[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function auditBundle(bundleDir: string): Promise<BundleAuditReport> {
	const metaPath = path.join(bundleDir, "meta.json");
	const metaValue = await readJson(metaPath);
	const meta: BundleMeta = isRecord(metaValue) ? metaValue : {};
	const videoPath = pathFromMeta(meta, "video");
	const cursorTelemetryPath = pathFromMeta(meta, "cursorTelemetry");
	const transcriptPath = "transcript.txt";
	const stepsJsonPath = "steps.json";
	const stepsMarkdownPath = "steps.md";
	const screenshotsPath = "screenshots";

	const [
		videoPresent,
		transcriptPresent,
		stepsJsonPresent,
		stepsMarkdownPresent,
		screenshotsPresent,
		metaPresent,
	] = await Promise.all([
		videoPath === null ? false : exists(path.join(bundleDir, videoPath)),
		exists(path.join(bundleDir, transcriptPath)),
		exists(path.join(bundleDir, stepsJsonPath)),
		exists(path.join(bundleDir, stepsMarkdownPath)),
		exists(path.join(bundleDir, screenshotsPath)),
		exists(metaPath),
	]);

	const [stepsValue, telemetryValue, transcriptContent, stepsMarkdownContent, screenshotEntries] =
		await Promise.all([
			readJson(path.join(bundleDir, stepsJsonPath)),
			cursorTelemetryPath === null
				? Promise.resolve(undefined)
				: readJson(path.join(bundleDir, cursorTelemetryPath)),
			transcriptPresent
				? readFile(path.join(bundleDir, transcriptPath), "utf-8")
				: Promise.resolve(""),
			stepsMarkdownPresent
				? readFile(path.join(bundleDir, stepsMarkdownPath), "utf-8")
				: Promise.resolve(""),
			screenshotsPresent
				? readdir(path.join(bundleDir, screenshotsPath), { withFileTypes: true }).catch(() => [])
				: Promise.resolve([]),
		]);

	const timestampsMs = stepTimestamps(stepsValue);
	const referencedScreenshotPaths = stepScreenshotPaths(stepsValue);
	const clickTimestampsMs = clickTimestamps(telemetryValue);
	const markdownChipTimestampsMs = parseTimestampLines(stepsMarkdownContent, STEP_CHIP);
	const markdownChipDeltasMs = markdownChipTimestampsMs.map((chip, index) =>
		Math.abs(chip - (clickTimestampsMs[index] ?? Number.NaN)),
	);
	const durationMs = typeof meta.durationMs === "number" ? meta.durationMs : undefined;
	const diagnostics =
		durationMs === undefined
			? []
			: parseTimestampLines(transcriptContent, TIMESTAMP_LINE)
					.filter((value) => value > durationMs)
					.map((value) => ({
						kind: "transcript-timestamp-beyond-meta-duration" as const,
						timestampMs: value,
						durationMs,
					}));
	const screenshotFileNames = screenshotEntries
		.filter((entry) => entry.isFile())
		.map((entry) => entry.name);
	const screenshotCount = screenshotFileNames.length;
	const screenshotFileNameSet = new Set(screenshotFileNames);
	const missingReferencedScreenshotPaths = referencedScreenshotPaths.filter(
		(screenshotPath) => !screenshotFileNameSet.has(screenshotPath),
	);
	const allScreenshotReferencesPresent =
		referencedScreenshotPaths.length === timestampsMs.length &&
		missingReferencedScreenshotPaths.length === 0;
	const contract = {
		video: { path: videoPath, present: videoPresent },
		transcript: { path: transcriptPath, present: transcriptPresent },
		stepsJson: { path: stepsJsonPath, present: stepsJsonPresent },
		stepsMarkdown: { path: stepsMarkdownPath, present: stepsMarkdownPresent },
		screenshots: { path: screenshotsPath, present: screenshotsPresent },
		meta: { path: "meta.json", present: metaPresent },
	};
	const complete = Object.values(contract).every((artifact) => artifact.present);
	const matchClickTelemetryExactly = matchesExactly(timestampsMs, clickTimestampsMs);
	const markdownChipsWithinOneSecond =
		markdownChipTimestampsMs.length === clickTimestampsMs.length &&
		markdownChipDeltasMs.every((delta) => delta <= 1_000);

	return {
		bundleDir,
		acceptancePassed:
			complete &&
			cursorTelemetryPath !== null &&
			(await exists(path.join(bundleDir, cursorTelemetryPath))) &&
			timestampsMs.length > 0 &&
			allScreenshotReferencesPresent &&
			matchClickTelemetryExactly &&
			markdownChipsWithinOneSecond,
		contract: { complete, ...contract },
		cursorTelemetry: {
			declaredPath: cursorTelemetryPath,
			present:
				cursorTelemetryPath !== null && (await exists(path.join(bundleDir, cursorTelemetryPath))),
			clickTimestampsMs,
		},
		screenshots: {
			count: screenshotCount,
			stepCount: timestampsMs.length,
			matchesStepCount: screenshotCount === timestampsMs.length,
			referencedPaths: referencedScreenshotPaths,
			missingReferencedPaths: missingReferencedScreenshotPaths,
			allReferencesPresent: allScreenshotReferencesPresent,
		},
		steps: {
			timestampsMs,
			matchClickTelemetryExactly,
			markdownChipTimestampsMs,
			markdownChipDeltasMs,
			markdownChipsWithinOneSecond,
		},
		diagnostics,
	};
}
