export interface ProjectMedia {
	screenVideoPath: string;
	webcamVideoPath?: string;
	cursorCaptureMode?: CursorCaptureMode;
}

export type CursorCaptureMode = "editable-overlay" | "system";

/**
 * Structured step-capture degradation reason, re-exported from the canonical
 * Showhow shared type so the recorder can persist the root cause (e.g.
 * `accessibility-denied`) through the store-recorded-session IPC into the
 * bundle's meta.json. Kept here as a convenience re-export so the IPC input
 * type is self-contained.
 */
export type { StepCaptureReason } from "./showhow/recordingLibrary";

export interface RecordingSession extends ProjectMedia {
	createdAt: number;
	showhowBundleDir?: string;
	showhowVideoFileUrl?: string;
}

export interface RecordedVideoAssetInput {
	fileName: string;
	videoData: ArrayBuffer;
}

export interface StoreRecordedSessionInput {
	screen: RecordedVideoAssetInput;
	webcam?: RecordedVideoAssetInput;
	createdAt?: number;
	cursorCaptureMode?: CursorCaptureMode;
	/**
	 * Recording wall-clock duration (ms). The main process patches the WebM Duration
	 * header on streamed recordings (the renderer no longer holds the bytes). Browser
	 * MediaRecorder writes no/zero duration, which breaks the editor seek bar and
	 * timeline for anything that took the streaming path.
	 */
	durationMs?: number;
	/**
	 * Structured step-capture degradation reason to persist into the bundle's
	 * meta.json (e.g. `accessibility-denied` when the recorder degraded to
	 * system-cursor mode). Optional; omitted for a normal recording.
	 */
	stepCaptureReason?: import("./showhow/recordingLibrary").StepCaptureReason;
	/**
	 * Recording source written to meta.json. Defaults to "desktop"; "browser"
	 * marks a browser-companion recording so companion-origin degradation
	 * reasons (unpaired/disconnected) are applied at bundle time.
	 */
	source?: "desktop" | "browser";
}

export function normalizeCursorCaptureMode(value: unknown): CursorCaptureMode | undefined {
	return value === "editable-overlay" || value === "system" ? value : undefined;
}

function normalizePath(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

export function normalizeProjectMedia(candidate: unknown): ProjectMedia | null {
	if (!candidate || typeof candidate !== "object") {
		return null;
	}

	const raw = candidate as Partial<ProjectMedia>;
	const screenVideoPath = normalizePath(raw.screenVideoPath);

	if (!screenVideoPath) {
		return null;
	}

	const webcamVideoPath = normalizePath(raw.webcamVideoPath);
	const cursorCaptureMode = normalizeCursorCaptureMode(raw.cursorCaptureMode);

	return {
		screenVideoPath,
		...(webcamVideoPath ? { webcamVideoPath } : {}),
		...(cursorCaptureMode ? { cursorCaptureMode } : {}),
	};
}

export function normalizeRecordingSession(candidate: unknown): RecordingSession | null {
	if (!candidate || typeof candidate !== "object") {
		return null;
	}

	const raw = candidate as Partial<RecordingSession>;
	const media = normalizeProjectMedia(raw);
	if (!media) {
		return null;
	}

	return {
		...media,
		createdAt:
			typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
				? raw.createdAt
				: Date.now(),
		...(normalizePath(raw.showhowBundleDir)
			? { showhowBundleDir: normalizePath(raw.showhowBundleDir) }
			: {}),
		...(normalizePath(raw.showhowVideoFileUrl)
			? { showhowVideoFileUrl: normalizePath(raw.showhowVideoFileUrl) }
			: {}),
	};
}

/**
 * Clears a completed Showhow transcript job only when the session still owns that job.
 * Returning null prevents an old editor callback from replacing a newer session.
 */
export function completeShowhowTranscriptSession(
	currentSession: RecordingSession,
	bundleDir: string,
	videoFileUrl: string,
): RecordingSession | null {
	if (
		currentSession.showhowBundleDir !== bundleDir ||
		currentSession.showhowVideoFileUrl !== videoFileUrl
	) {
		return null;
	}

	const completedSession = { ...currentSession };
	delete completedSession.showhowBundleDir;
	delete completedSession.showhowVideoFileUrl;
	return completedSession;
}
