import type { CursorRecordingSample, CursorTelemetryPoint } from "../../src/native/contracts";

/**
 * Project a full cursor recording sample down to the telemetry shape the editor
 * receives across the IPC boundary. Preserves `interactionType` so downstream
 * click detection sees the original anchors; falls back to `"move"` when the
 * sample omits or carries an unrecognized interaction type.
 */
export function mapCursorSampleToTelemetryPoint(
	sample: CursorRecordingSample,
): CursorTelemetryPoint {
	const interactionType: CursorTelemetryPoint["interactionType"] =
		sample.interactionType === "click" ||
		sample.interactionType === "mouseup" ||
		sample.interactionType === "move"
			? sample.interactionType
			: "move";

	return {
		timeMs: sample.timeMs,
		cx: sample.cx,
		cy: sample.cy,
		interactionType,
	};
}
