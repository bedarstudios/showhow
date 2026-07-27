import { describe, expect, it } from "vitest";
import type { ZoomRegion } from "../types";
import { computeRegionStrength } from "./zoomRegionUtils";

const region: ZoomRegion = {
	id: "early-auto-zoom",
	startMs: 0,
	endMs: 1_333,
	depth: "medium",
	focus: { cx: 0.4, cy: 0.6 },
	source: "auto",
	startsSettled: true,
};

describe("computeRegionStrength", () => {
	it("starts an auto-generated boundary region fully settled", () => {
		expect(computeRegionStrength(region, 0)).toBe(1);
		expect(computeRegionStrength(region, 250)).toBe(1);
	});

	it("preserves the transition for an auto dwell region at the boundary", () => {
		const dwellRegion = { ...region, startsSettled: undefined };

		expect(computeRegionStrength(dwellRegion, 0)).toBeLessThan(1);
		expect(computeRegionStrength(dwellRegion, 250)).toBeLessThan(1);
	});
});
