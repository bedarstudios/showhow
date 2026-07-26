import { describe, expect, it } from "vitest";
import type { CursorRecordingSample } from "../../src/native/contracts";
import { mapCursorSampleToTelemetryPoint } from "./cursorTelemetry";

describe("mapCursorSampleToTelemetryPoint", () => {
	it("preserves a click sample's interactionType, timestamp, and position", () => {
		const sample: CursorRecordingSample = {
			timeMs: 4082,
			cx: 0.25,
			cy: 0.75,
			interactionType: "click",
		};

		const point = mapCursorSampleToTelemetryPoint(sample);

		expect(point.timeMs).toBe(4082);
		expect(point.cx).toBe(0.25);
		expect(point.cy).toBe(0.75);
		expect(point.interactionType).toBe("click");
	});

	it("preserves a move sample's interactionType", () => {
		const sample: CursorRecordingSample = {
			timeMs: 100,
			cx: 0.5,
			cy: 0.5,
			interactionType: "move",
		};

		expect(mapCursorSampleToTelemetryPoint(sample).interactionType).toBe("move");
	});

	it("preserves a mouseup sample's interactionType", () => {
		const sample: CursorRecordingSample = {
			timeMs: 26571,
			cx: 0.3,
			cy: 0.4,
			interactionType: "mouseup",
		};

		expect(mapCursorSampleToTelemetryPoint(sample).interactionType).toBe("mouseup");
	});

	it("falls back to interactionType=move when the sample omits it", () => {
		const sample: CursorRecordingSample = {
			timeMs: 200,
			cx: 0.1,
			cy: 0.2,
		};

		const point = mapCursorSampleToTelemetryPoint(sample);

		expect(point.interactionType).toBe("move");
		expect(point.timeMs).toBe(200);
		expect(point.cx).toBe(0.1);
		expect(point.cy).toBe(0.2);
	});

	it("falls back to interactionType=move when the sample carries an unrecognized interactionType", () => {
		const sample = {
			timeMs: 300,
			cx: 0.6,
			cy: 0.7,
			interactionType: "double-click",
		} as unknown as CursorRecordingSample;

		expect(mapCursorSampleToTelemetryPoint(sample).interactionType).toBe("move");
	});

	it("preserves exact timestamp and coordinates across mixed interaction types", () => {
		const samples: CursorRecordingSample[] = [
			{ timeMs: 0, cx: 0, cy: 0, interactionType: "move" },
			{ timeMs: 1234, cx: 0.125, cy: 0.875, interactionType: "click" },
			{ timeMs: 5678, cx: 0.999, cy: 0.001, interactionType: "mouseup" },
		];

		const points = samples.map(mapCursorSampleToTelemetryPoint);

		expect(points).toEqual([
			{ timeMs: 0, cx: 0, cy: 0, interactionType: "move" },
			{ timeMs: 1234, cx: 0.125, cy: 0.875, interactionType: "click" },
			{ timeMs: 5678, cx: 0.999, cy: 0.001, interactionType: "mouseup" },
		]);
	});
});
