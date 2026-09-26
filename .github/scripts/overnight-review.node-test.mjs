import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHead } from "./overnight-review.mjs";

const head = "a".repeat(40);
const base = "b".repeat(40);
const names = [
	"Lint",
	"Type Check",
	"Test",
	"Build",
	"Validate PR title (semantic)",
	"Cloud evidence",
];
const snapshot = {
	head,
	base,
	testedHead: head,
	testedBase: base,
	implementerFinished: true,
	draft: false,
	protectedPaths: [],
	checks: names.map((name) => ({ name, conclusion: "success", status: "completed" })),
	review: {
		user: "Copilot",
		actorId: 175728472,
		actorType: "Bot",
		commit: head,
		state: "COMMENTED",
		comments: 0,
		body: "Copilot reviewed the changes and generated no comments.",
	},
	unresolvedThreads: 0,
	evidence: {
		head,
		red: true,
		green: true,
		urls: ["https://github.com/bedarstudios/showhow/pull/83"],
	},
};
test("reviewed needs a separate current-head review and actual required check results", () => {
	assert.equal(evaluateHead(snapshot).verdict, "reviewed");
	assert.notEqual(
		evaluateHead({ ...snapshot, review: { ...snapshot.review, commit: base } }).verdict,
		"reviewed",
	);
});
for (const [name, changed] of Object.entries({
	"old CI head": { testedHead: base },
	"old CI base": { testedBase: head },
	"still implementing": { implementerFinished: false },
	draft: { draft: true },
	"protected path": { protectedPaths: [".github/workflows/ci.yml"] },
	"missing check": { checks: [] },
	"skipped check": { checks: snapshot.checks.map((c) => ({ ...c, conclusion: "skipped" })) },
	"failed check": { checks: snapshot.checks.map((c) => ({ ...c, conclusion: "failure" })) },
	"wrong reviewer": { review: { ...snapshot.review, actorId: 198982749 } },
	"review findings": { review: { ...snapshot.review, comments: 1 } },
	"body-only uncertainty": { review: { ...snapshot.review, body: "Please check error handling." } },
	"open review threads": { unresolvedThreads: 1 },
	"no behavior evidence": { evidence: null },
	"old behavior evidence": { evidence: { ...snapshot.evidence, head: base } },
})) {
	test(`cannot pass with ${name}`, () => {
		assert.notEqual(evaluateHead({ ...snapshot, ...changed }).verdict, "reviewed");
	});
}

test("current Copilot v2 approval summary passes with all other evidence gates", () => {
	const body =
		"<!-- ccr-overview-v2 -->\n\n## Copilot review overview\n\n### 🟢 Approval recommended\n\nNo unresolved review issues were identified, and all readiness assessments support approval.\n\n**Review effort:** Lite  \n**Findings:** None\n";
	assert.equal(
		evaluateHead({ ...snapshot, review: { ...snapshot.review, body } }).verdict,
		"reviewed",
	);
	assert.notEqual(
		evaluateHead({
			...snapshot,
			review: { ...snapshot.review, body: body.replace("**Findings:** None", "**Findings:** 1") },
		}).verdict,
		"reviewed",
	);
});
