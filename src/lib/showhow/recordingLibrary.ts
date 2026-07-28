/**
 * Shared type for a single local recording-library entry.
 * Used by both the main-process scanner and the renderer UI.
 */
export interface RecordingLibraryEntry {
	/** Absolute path to the bundle directory. */
	bundleDir: string;
	/** Human-readable title from meta.json. */
	title: string;
	/** Recording source: desktop OS capture or browser tab via the companion extension. */
	source: "desktop" | "browser";
	/** Unix epoch ms when the recording started (from meta.json). */
	createdAt: number;
	/** Recording duration in milliseconds, if known. */
	durationMs?: number;
}
