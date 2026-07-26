import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CursorTelemetryPoint } from "../types";
import { buildAutoZoomSuggestions, normalizeCursorTelemetry } from "./zoomSuggestionUtils";

const fixturePath = path.resolve(import.meta.dirname, "__fixtures__/issue32-cursor.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
	durationMs: number;
	samples: CursorTelemetryPoint[];
};
const { samples, durationMs } = fixture;

const CLICK_TYPES = new Set(["click", "double-click", "right-click", "middle-click"]);
const clickSamples = samples.filter((sample) => CLICK_TYPES.has(sample.interactionType ?? ""));

function findClickByFocus(focus: { cx: number; cy: number }) {
	return clickSamples.find(
		(sample) => Math.abs(sample.cx - focus.cx) < 1e-6 && Math.abs(sample.cy - focus.cy) < 1e-6,
	);
}

describe("normalizeCursorTelemetry", () => {
	it("preserves interactionType and coordinates for all six in-range click samples", () => {
		const normalized = normalizeCursorTelemetry(samples, durationMs);
		// All fixture click samples fall within [0, durationMs]; their timeMs,
		// interactionType, and cx/cy must survive normalization unchanged.
		expect(clickSamples).toHaveLength(6);
		for (const click of clickSamples) {
			expect(click.timeMs).toBeLessThanOrEqual(durationMs);
			const point = normalized.find(
				(sample) =>
					sample.timeMs === click.timeMs && sample.interactionType === click.interactionType,
			);
			expect(point, `normalized click at t=${click.timeMs} must survive`).toBeDefined();
			expect(point!.interactionType).toBe(click.interactionType);
			expect(point!.cx).toBeCloseTo(click.cx, 6);
			expect(point!.cy).toBeCloseTo(click.cy, 6);
		}
		const normalizedClicks = normalized.filter((sample) => sample.interactionType === "click");
		expect(normalizedClicks).toHaveLength(clickSamples.length);
	});

	it("clamps out-of-range timestamps to [0, durationMs]", () => {
		const over = samples.find((sample) => sample.timeMs > durationMs);
		expect(over, "fixture must contain a sample past durationMs").toBeDefined();
		const normalized = normalizeCursorTelemetry(samples, durationMs);
		const clamped = normalized.find(
			(sample) => sample.timeMs === durationMs && sample.interactionType === over?.interactionType,
		);
		expect(clamped, "trailing sample past durationMs must be clamped to durationMs").toBeDefined();
	});
});

describe("buildAutoZoomSuggestions (issue32 fixture)", () => {
	const defaultDurationMs = 1333;
	const suggestions = buildAutoZoomSuggestions({
		cursorTelemetry: samples,
		totalMs: durationMs,
		existingRegions: [],
		defaultDurationMs,
	});

	it("produces exactly 3 suggestions", () => {
		expect(suggestions).toHaveLength(3);
	});

	it("accepted anchors are 4082, 6236, 25899ms with focus equal to click coordinates", () => {
		const expectedAnchors = [4082, 6236, 25899];
		const anchorClicks = expectedAnchors.map((t) => clickSamples.find((c) => c.timeMs === t));
		for (const click of anchorClicks) {
			expect(click, `fixture must contain a click at the expected anchor`).toBeDefined();
		}
		const sorted = [...suggestions].sort((a, b) => a.span.start - b.span.start);
		for (const [index, suggestion] of sorted.entries()) {
			const expected = anchorClicks[index];
			expect(suggestion.focus.cx).toBeCloseTo(expected!.cx, 6);
			expect(suggestion.focus.cy).toBeCloseTo(expected!.cy, 6);
		}
	});

	it("each region start + 500ms lands at or before its anchor click", () => {
		const sorted = [...suggestions].sort((a, b) => a.span.start - b.span.start);
		for (const suggestion of sorted) {
			const anchor = findClickByFocus(suggestion.focus);
			expect(anchor, "suggestion focus must match a click sample").toBeDefined();
			expect(suggestion.span.start + 500).toBeLessThanOrEqual(anchor!.timeMs);
		}
	});

	it("produces no dwell-only spans", () => {
		for (const suggestion of suggestions) {
			const anchor = findClickByFocus(suggestion.focus);
			expect(anchor, "every suggestion focus must match a click sample").toBeDefined();
		}
	});
});
