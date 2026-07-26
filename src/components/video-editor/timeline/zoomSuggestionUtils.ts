import type { CursorTelemetryPoint, ZoomFocus } from "../types";
import { ZOOM_IN_OVERLAP_MS } from "../videoPlayback/zoomRegionUtils";

export const MIN_DWELL_DURATION_MS = 450;
export const MAX_DWELL_DURATION_MS = 2600;
export const DWELL_MOVE_THRESHOLD = 0.02;
/** Minimum spacing between two accepted suggestion centres. */
export const SUGGESTION_SPACING_MS = 1800;
/** Playhead overlap at full zoom strength — see zoomRegionUtils.ZOOM_IN_OVERLAP_MS. */
export { ZOOM_IN_OVERLAP_MS as PLAYBACK_FULL_STRENGTH_OVERLAP_MS };

const CLICK_INTERACTION_TYPE = "click";

export interface ZoomDwellCandidate {
	centerTimeMs: number;
	focus: ZoomFocus;
	strength: number;
}

function clamp01(value: number) {
	return Math.max(0, Math.min(value, 1));
}

// Normalization preserves every sample field (interactionType included) --
// via the spread -- so downstream click detection sees the original anchors.
// `timeMs` is clamped to [0, totalMs] (baseline contract: no sample escapes the
// recording's span), and `cx`/`cy` are clamped to [0, 1].
function normalizeTelemetrySample(
	sample: CursorTelemetryPoint,
	totalMs: number,
): CursorTelemetryPoint {
	return {
		...sample,
		timeMs: Math.max(0, Math.min(sample.timeMs, totalMs)),
		cx: clamp01(sample.cx),
		cy: clamp01(sample.cy),
	};
}

export function normalizeCursorTelemetry(
	telemetry: CursorTelemetryPoint[],
	totalMs: number,
): CursorTelemetryPoint[] {
	return [...telemetry]
		.filter(
			(sample) =>
				Number.isFinite(sample.timeMs) && Number.isFinite(sample.cx) && Number.isFinite(sample.cy),
		)
		.sort((a, b) => a.timeMs - b.timeMs)
		.map((sample) => normalizeTelemetrySample(sample, totalMs));
}

export function detectZoomDwellCandidates(samples: CursorTelemetryPoint[]): ZoomDwellCandidate[] {
	if (samples.length < 2) {
		return [];
	}

	const dwellCandidates: ZoomDwellCandidate[] = [];
	let runStart = 0;

	const pushRunIfDwell = (startIndex: number, endIndexExclusive: number) => {
		if (endIndexExclusive - startIndex < 2) {
			return;
		}

		const start = samples[startIndex];
		const end = samples[endIndexExclusive - 1];
		const runDuration = end.timeMs - start.timeMs;
		if (runDuration < MIN_DWELL_DURATION_MS || runDuration > MAX_DWELL_DURATION_MS) {
			return;
		}

		const runSamples = samples.slice(startIndex, endIndexExclusive);
		const avgCx = runSamples.reduce((sum, sample) => sum + sample.cx, 0) / runSamples.length;
		const avgCy = runSamples.reduce((sum, sample) => sum + sample.cy, 0) / runSamples.length;

		dwellCandidates.push({
			centerTimeMs: Math.round((start.timeMs + end.timeMs) / 2),
			focus: { cx: avgCx, cy: avgCy },
			strength: runDuration,
		});
	};

	for (let index = 1; index < samples.length; index += 1) {
		const prev = samples[index - 1];
		const curr = samples[index];
		const distance = Math.hypot(curr.cx - prev.cx, curr.cy - prev.cy);

		if (distance > DWELL_MOVE_THRESHOLD) {
			pushRunIfDwell(runStart, index);
			runStart = index;
		}
	}
	pushRunIfDwell(runStart, samples.length);

	return dwellCandidates;
}

export interface AutoZoomSuggestion {
	span: { start: number; end: number };
	focus: ZoomFocus;
}

/**
 * Build non-overlapping zoom suggestions from cursor telemetry: detect dwell moments,
 * rank by duration, space by SUGGESTION_SPACING_MS, drop any overlapping an existing
 * region. Pure, shared by the magic-wand toggle and the on-load auto-suggest pass.
 */
export function buildAutoZoomSuggestions(options: {
	cursorTelemetry: CursorTelemetryPoint[];
	totalMs: number;
	existingRegions: { startMs: number; endMs: number }[];
	defaultDurationMs: number;
}): AutoZoomSuggestion[] {
	const { cursorTelemetry, totalMs, existingRegions, defaultDurationMs } = options;
	if (totalMs <= 0 || cursorTelemetry.length < 2) {
		return [];
	}

	const defaultDuration = Math.min(defaultDurationMs, totalMs);
	if (defaultDuration <= 0) {
		return [];
	}

	const normalizedSamples = normalizeCursorTelemetry(cursorTelemetry, totalMs);
	if (normalizedSamples.length < 2) {
		return [];
	}

	// Click anchors are preferred over dwell: a click marks an intentional
	// interaction point, so when any click exists the candidate list is built
	// from clicks only. Dwell is a fallback for telemetry with zero clicks.
	const clickSamples = normalizedSamples.filter(
		(sample) => sample.interactionType === CLICK_INTERACTION_TYPE,
	);

	const isClickMode = clickSamples.length > 0;
	let candidates: ZoomDwellCandidate[];
	if (isClickMode) {
		candidates = clickSamples
			.slice()
			.sort((a, b) => a.timeMs - b.timeMs)
			.map((sample) => ({
				centerTimeMs: sample.timeMs,
				focus: { cx: sample.cx, cy: sample.cy },
				strength: sample.timeMs,
			}));
	} else {
		candidates = detectZoomDwellCandidates(normalizedSamples);
	}
	if (candidates.length === 0) {
		return [];
	}

	const reservedSpans = existingRegions
		.map((region) => ({ start: region.startMs, end: region.endMs }))
		.sort((a, b) => a.start - b.start);

	// Clicks are processed chronologically (earliest first) so SUGGESTION_SPACING_MS
	// accepts the earliest click of each cluster. Dwell candidates keep the
	// existing duration-descending rank.
	const sortedCandidates = isClickMode
		? [...candidates].sort((a, b) => a.centerTimeMs - b.centerTimeMs)
		: [...candidates].sort((a, b) => b.strength - a.strength);
	const acceptedCenters: number[] = [];
	const suggestions: AutoZoomSuggestion[] = [];

	for (const candidate of sortedCandidates) {
		const tooCloseToAccepted = acceptedCenters.some(
			(center) => Math.abs(center - candidate.centerTimeMs) < SUGGESTION_SPACING_MS,
		);
		if (tooCloseToAccepted) {
			continue;
		}

		// Click spans lead in by ZOOM_IN_OVERLAP_MS so the zoom is fully settled
		// at or before the click frame; dwell spans keep the centered layout.
		const centeredStart = isClickMode
			? Math.round(candidate.centerTimeMs - ZOOM_IN_OVERLAP_MS)
			: Math.round(candidate.centerTimeMs - defaultDuration / 2);
		const candidateStart = Math.max(0, Math.min(centeredStart, totalMs - defaultDuration));
		const candidateEnd = candidateStart + defaultDuration;
		const hasOverlap = reservedSpans.some(
			(span) => candidateEnd > span.start && candidateStart < span.end,
		);
		if (hasOverlap) {
			continue;
		}

		reservedSpans.push({ start: candidateStart, end: candidateEnd });
		acceptedCenters.push(candidate.centerTimeMs);
		suggestions.push({
			span: { start: candidateStart, end: candidateEnd },
			focus: candidate.focus,
		});
	}

	return suggestions;
}
