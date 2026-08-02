import type { CursorCaptureMode } from "./recordingSession";
import type { StepCaptureReason } from "./showhow/recordingLibrary";

export interface CursorAccessPreflightInput {
	/** Electron platform string (`getPlatform()`). */
	platform: string;
	/** The user-selected cursor capture mode for this recording. */
	cursorCaptureMode: CursorCaptureMode;
	/** Whether the native accessibility request resolved without throwing. */
	accessCheckSucceeded: boolean;
	/** Whether the OS granted accessibility (only meaningful when the check succeeded). */
	accessGranted: boolean;
}

export interface CursorAccessPreflightResult {
	/**
	 * When true, the recorder continues in a degraded system-cursor mode
	 * (the editable overlay is unavailable) rather than aborting before the
	 * countdown. This is the recorder-first fail-open policy.
	 */
	degradedToSystemCursor: boolean;
	/** Structured step-capture degradation reason to persist, if any. */
	stepCaptureReason?: StepCaptureReason;
}

/**
 * Decide cursor-mode degradation for the recorder-first fail-open policy.
 *
 * On macOS with the editable-overlay cursor mode, an accessibility denial -- or
 * a preflight check that itself fails -- degrades to system-cursor mode and
 * records a structured `accessibility-denied` step-capture reason rather than
 * aborting the recording before the countdown. The recording still starts; the
 * desktop tier (transcript-only doc) remains usable.
 *
 * Non-darwin platforms, and darwin recordings already in system-cursor mode,
 * never degrade: the editable overlay is not in use, so accessibility is
 * irrelevant.
 */
export function resolveCursorAccessPreflight(
	input: CursorAccessPreflightInput,
): CursorAccessPreflightResult {
	if (input.platform !== "darwin" || input.cursorCaptureMode !== "editable-overlay") {
		return { degradedToSystemCursor: false };
	}
	if (!input.accessCheckSucceeded || !input.accessGranted) {
		return {
			degradedToSystemCursor: true,
			stepCaptureReason: "accessibility-denied",
		};
	}
	return { degradedToSystemCursor: false };
}
