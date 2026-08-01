import type { StepCaptureReason } from "../../src/lib/showhow/recordingLibrary";
import type { BrowserStepRecord } from "./bundle";

export interface CompanionStepCaptureInput {
	/** Browser-tier steps drained from the bridge for this recording. */
	ingestedStepCount: number;
	/** Whether the companion is connected right now. */
	isCompanionConnected: boolean;
	/** Whether the companion disconnected while a recording epoch was active. */
	hadMidRecordingDisconnect: boolean;
	/**
	 * Whether a browser companion was expected for this recording. When false
	 * (a pure desktop recording), a never-paired companion is NOT mislabeled as
	 * `companion-unpaired`; the bundle's own no-clicks/frame-extraction reason
	 * stands.
	 */
	companionExpected: boolean;
}

export interface CompanionStepCaptureResult {
	status: "unavailable";
	reason: StepCaptureReason;
	message: string;
}

const COMPANION_DISCONNECTED_MESSAGE =
	"Browser companion disconnected mid-recording; semantic steps unavailable. Desktop tier remains usable.";
const COMPANION_UNPAIRED_MESSAGE =
	"Browser companion was not paired; semantic steps unavailable. Desktop tier remains usable.";

/**
 * Decide the structured step-capture degradation reason for a browser
 * companion recording, from the bridge state at bundle time. Returns `null`
 * when no companion-origin degradation should be recorded -- either because
 * browser steps were ingested (the available path owns persistence) or because
 * the companion was never expected and never involved (a desktop recording,
 * whose reason is owned by the bundle's own click/frame-extraction pass).
 *
 * A mid-recording disconnect is always a companion-origin degradation
 * (the companion was involved), so `companion-disconnected` is returned
 * regardless of `companionExpected`. A never-paired companion is only
 * `companion-unpaired` when a browser companion was expected, so desktop
 * recordings are not mislabeled.
 */
export function resolveCompanionStepCapture(
	input: CompanionStepCaptureInput,
): CompanionStepCaptureResult | null {
	if (input.ingestedStepCount > 0) {
		return null;
	}
	if (input.hadMidRecordingDisconnect) {
		return {
			status: "unavailable",
			reason: "companion-disconnected",
			message: COMPANION_DISCONNECTED_MESSAGE,
		};
	}
	if (input.companionExpected && !input.isCompanionConnected) {
		return {
			status: "unavailable",
			reason: "companion-unpaired",
			message: COMPANION_UNPAIRED_MESSAGE,
		};
	}
	return null;
}

/** A step-capture record to persist into a bundle's meta.json. */
export interface StepCaptureMark {
	status: "available" | "unavailable";
	message?: string;
	reason?: StepCaptureReason;
}

export interface ApplyCompanionStepCaptureArgs {
	/** Browser-tier steps drained from the bridge for this recording. */
	browserSteps: BrowserStepRecord[];
	/** The bundle's recording source ("browser" => companion was expected). */
	bundleSource: "desktop" | "browser";
	/** Whether the bundle's stepCapture is already `available` (desktop clicks). */
	bundleAlreadyAvailable: boolean;
	/** Whether the companion is connected right now. */
	isCompanionConnected: boolean;
	/** Whether the companion disconnected while a recording epoch was active. */
	hadMidRecordingDisconnect: boolean;
	/** Persist ingested browser steps into the bundle. Throws on failure. */
	persistSteps: (steps: BrowserStepRecord[]) => Promise<void>;
	/** Rewrite the bundle's meta.json stepCapture field. Never throws. */
	markStepCapture: (mark: StepCaptureMark) => Promise<void>;
}

const BROWSER_PERSISTENCE_FAILED_MESSAGE =
	"Browser step capture failed; semantic steps unavailable. Desktop tier remains usable.";

/**
 * Apply the companion step-capture outcome to a bundle: persist ingested
 * browser steps (marking available, or unavailable on a persistence failure),
 * or -- when no browser steps were ingested -- record a structured companion
 * degradation reason. A companion-origin reason never overrides an
 * already-available bundle (desktop clicks were extracted), and a desktop
 * recording where the companion was never expected is never mislabeled as
 * companion-unpaired. Never throws; persistence failures degrade to an
 * unavailable mark.
 */
export async function applyCompanionStepCapture(
	args: ApplyCompanionStepCaptureArgs,
): Promise<void> {
	if (args.browserSteps.length > 0) {
		try {
			await args.persistSteps(args.browserSteps);
			await args.markStepCapture({ status: "available" });
		} catch {
			await args.markStepCapture({
				status: "unavailable",
				message: BROWSER_PERSISTENCE_FAILED_MESSAGE,
			});
		}
		return;
	}
	if (args.bundleAlreadyAvailable) {
		return;
	}
	const degradation = resolveCompanionStepCapture({
		ingestedStepCount: 0,
		isCompanionConnected: args.isCompanionConnected,
		hadMidRecordingDisconnect: args.hadMidRecordingDisconnect,
		companionExpected: args.bundleSource === "browser",
	});
	if (degradation) {
		await args.markStepCapture({
			status: degradation.status,
			reason: degradation.reason,
			message: degradation.message,
		});
	}
}
