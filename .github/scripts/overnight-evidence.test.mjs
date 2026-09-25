import assert from "node:assert/strict";
import test from "node:test";
import { isBehavioralFailure, validateReport } from "./overnight-evidence.mjs";

test("report requires the approved target test and a distinct red commit", () => {
	const context = { issue: 83, head: "a".repeat(40), targetTest: "src/demoVideo/timing.test.ts" };
	const report = { issue: 83, redCommit: "b".repeat(40), targetTest: context.targetTest };
	assert.equal(validateReport(report, context), report.redCommit);
	assert.throws(() => validateReport({ ...report, targetTest: "scripts/other.test.ts" }, context));
	assert.throws(() => validateReport({ ...report, redCommit: context.head }, context));
});
test("missing imports and setup failures do not count as behavioral red", () => {
	assert.equal(isBehavioralFailure({ numFailedTests: 0, numFailedTestSuites: 1 }), false);
	assert.equal(
		isBehavioralFailure({
			numFailedTests: 1,
			testResults: [
				{ assertionResults: [{ status: "failed", failureMessages: ["Cannot find module x"] }] },
			],
		}),
		false,
	);
	assert.equal(
		isBehavioralFailure({
			numFailedTests: 1,
			testResults: [
				{
					assertionResults: [
						{ status: "failed", failureMessages: ["AssertionError: expected 0 to be 75"] },
					],
				},
			],
		}),
		true,
	);
});
