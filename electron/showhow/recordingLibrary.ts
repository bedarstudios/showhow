import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RecordingLibraryEntry } from "../../src/lib/showhow/recordingLibrary";
import { SHOWHOW_RECORDINGS_ROOT } from "./bundle";

export type { RecordingLibraryEntry };

interface RawMeta {
	schemaVersion?: unknown;
	title?: unknown;
	source?: unknown;
	createdAt?: unknown;
	durationMs?: unknown;
}

function isValidSource(value: unknown): value is "desktop" | "browser" {
	return value === "desktop" || value === "browser";
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
	} catch {
		return [];
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
