import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditBundle } from "./bundleAudit";

describe("auditBundle", () => {
	it("accepts a complete handoff while reporting transcript timestamps beyond its duration", async () => {
		const bundleDir = await mkdtemp(path.join(os.tmpdir(), "showhow-bundle-audit-"));
		await mkdir(path.join(bundleDir, "screenshots"));
		await Promise.all([
			writeFile(path.join(bundleDir, "video.mp4"), "video"),
			writeFile(
				path.join(bundleDir, "meta.json"),
				JSON.stringify({
					video: "video.mp4",
					transcript: "transcript.txt",
					cursorTelemetry: "video.mp4.cursor.json",
					durationMs: 6_500,
				}),
			),
			writeFile(path.join(bundleDir, "transcript.txt"), "[0:06] complete\n[0:07] overflow\n"),
			writeFile(
				path.join(bundleDir, "video.mp4.cursor.json"),
				JSON.stringify({
					samples: [
						{ timeMs: 4_082, interactionType: "click" },
						{ timeMs: 4_500, interactionType: "move" },
						{ timeMs: 5_500, interactionType: "click" },
					],
				}),
			),
			writeFile(
				path.join(bundleDir, "steps.json"),
				JSON.stringify([
					{ ts: 4_082, screenshot: "step-01.png" },
					{ ts: 5_500, screenshot: "step-02.png" },
				]),
			),
			writeFile(
				path.join(bundleDir, "steps.md"),
				[
					"# Workflow doc",
					"",
					"1. [0:04] first",
					"   ![step-01.png](screenshots/step-01.png)",
					"2. [0:05] second",
					"   ![step-02.png](screenshots/step-02.png)",
					"",
				].join("\n"),
			),
			writeFile(path.join(bundleDir, "screenshots", "step-01.png"), "screenshot"),
			writeFile(path.join(bundleDir, "screenshots", "step-02.png"), "screenshot"),
		]);

		const report = await auditBundle(bundleDir);

		expect(report.acceptancePassed).toBe(true);
		expect(report.contract.complete).toBe(true);
		expect(report.cursorTelemetry.clickTimestampsMs).toEqual([4_082, 5_500]);
		expect(report.screenshots.matchesStepCount).toBe(true);
		expect(report.steps.matchClickTelemetryExactly).toBe(true);
		expect(report.steps.markdownChipsWithinOneSecond).toBe(true);
		expect(report.diagnostics).toContainEqual({
			kind: "transcript-timestamp-beyond-meta-duration",
			timestampMs: 7_000,
			durationMs: 6_500,
		});
	});
});
