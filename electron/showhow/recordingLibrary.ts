import type { Dirent } from "node:fs";
import { constants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RecordingLibraryEntry } from "../../src/lib/showhow/recordingLibrary";
import { SHOWHOW_RECORDINGS_ROOT } from "./bundle";
import { createShowhowMediaUrl } from "./mediaProtocol";

export type { RecordingLibraryEntry };

interface RawMeta {
	schemaVersion?: unknown;
	title?: unknown;
	source?: unknown;
	createdAt?: unknown;
	durationMs?: unknown;
	video?: unknown;
	stepCapture?: unknown;
}

interface RawStep {
	label?: unknown;
	ts?: unknown;
	screenshot?: unknown;
}

function isValidSource(value: unknown): value is "desktop" | "browser" {
	return value === "desktop" || value === "browser";
}

function isVideoName(value: unknown): value is "video.mp4" | "video.webm" {
	return value === "video.mp4" || value === "video.webm";
}

function isStepCapture(
	value: unknown,
): value is { status: "available" | "unavailable"; message?: string } {
	return (
		typeof value === "object" &&
		value !== null &&
		"status" in value &&
		(value.status === "available" || value.status === "unavailable") &&
		(!("message" in value) || typeof value.message === "string")
	);
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function readSteps(
	bundleDir: string,
): Promise<NonNullable<RecordingLibraryEntry["steps"]> | undefined> {
	let rawSteps: unknown;
	try {
		rawSteps = JSON.parse(await readFile(path.join(bundleDir, "steps.json"), "utf-8")) as unknown;
	} catch {
		return undefined;
	}
	if (!Array.isArray(rawSteps)) {
		return undefined;
	}
	return Promise.all(
		rawSteps.flatMap(async (raw): Promise<NonNullable<RecordingLibraryEntry["steps"]>> => {
			if (
				typeof raw !== "object" ||
				raw === null ||
				!isFiniteStep(raw as RawStep) ||
				raw.screenshot.split(/[\\/]/u).length !== 1
			) {
				return [];
			}
			const screenshotPath = path.join(bundleDir, "screenshots", raw.screenshot);
			return [
				{
					label: raw.label,
					ts: raw.ts,
					screenshot: raw.screenshot,
					...((await fileExists(screenshotPath))
						? { screenshotUrl: createShowhowMediaUrl(bundleDir, `screenshots/${raw.screenshot}`) }
						: {}),
				},
			];
		}),
	).then((steps) => steps.flat());
}

function isFiniteStep(value: RawStep): value is { label: string; ts: number; screenshot: string } {
	return (
		typeof value.label === "string" &&
		value.label.length > 0 &&
		typeof value.ts === "number" &&
		Number.isFinite(value.ts) &&
		typeof value.screenshot === "string" &&
		value.screenshot.length > 0
	);
}

async function readEntryForDir(
	recordingsRoot: string,
	name: string,
): Promise<RecordingLibraryEntry | null> {
	const bundleDir = path.join(recordingsRoot, name);
	const metaPath = path.join(bundleDir, "meta.json");
	let raw: RawMeta;
	try {
		raw = JSON.parse(await readFile(metaPath, "utf-8")) as RawMeta;
	} catch {
		return null;
	}
	if (
		typeof raw.title !== "string" ||
		raw.title === "" ||
		!isValidSource(raw.source) ||
		typeof raw.createdAt !== "number" ||
		!Number.isFinite(raw.createdAt)
	) {
		return null;
	}
	const entry: RecordingLibraryEntry = {
		bundleDir,
		title: raw.title,
		source: raw.source,
		createdAt: raw.createdAt,
	};
	if (typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs)) {
		entry.durationMs = raw.durationMs;
	}
	if (isVideoName(raw.video)) {
		const videoPath = path.join(bundleDir, raw.video);
		if (await fileExists(videoPath)) {
			entry.video = raw.video;
			entry.videoUrl = createShowhowMediaUrl(bundleDir, raw.video);
		}
	}
	if (isStepCapture(raw.stepCapture)) {
		entry.stepCapture = raw.stepCapture;
	}
	const steps = await readSteps(bundleDir);
	if (steps !== undefined) {
		entry.steps = steps;
	}
	return entry;
}

/**
 * Scan the recordings root and return a `RecordingLibraryEntry` for every
 * valid bundle directory, sorted newest-first by `createdAt`.
 *
 * A valid bundle is a subdirectory whose `meta.json` has at minimum:
 * - `title` (non-empty string)
 * - `source` ("desktop" | "browser")
 * - `createdAt` (finite number)
 *
 * Directories with missing or unreadable `meta.json`, missing required fields,
 * or an unrecognised `source` value are silently skipped. Plain files in the
 * root are also skipped.
 *
 * Returns `[]` without throwing when the root directory does not exist.
 */
export async function listRecordings(
	recordingsRoot = SHOWHOW_RECORDINGS_ROOT,
): Promise<RecordingLibraryEntry[]> {
	let entries: Dirent[];
	try {
		entries = await readdir(recordingsRoot, { withFileTypes: true });
	} catch (error: unknown) {
		if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
			return [];
		}
		throw error;
	}
	const results = await Promise.all(
		entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => readEntryForDir(recordingsRoot, entry.name)),
	);
	return results
		.filter((entry): entry is RecordingLibraryEntry => entry !== null)
		.sort((a, b) => b.createdAt - a.createdAt);
}
