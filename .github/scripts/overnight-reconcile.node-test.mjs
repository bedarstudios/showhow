import assert from "node:assert/strict";
import test from "node:test";
import { reconcileRun } from "./overnight-reconcile.mjs";

const head = "a".repeat(40),
	base = "b".repeat(40);
const now = "2026-09-25T01:00:00Z";
const record = {
	version: 1,
	id: 1,
	issue: 83,
	scopeDigest: "approved-digest",
	state: "implementing",
	fixDispatches: 0,
	reviewCycles: 0,
	createdAt: now,
};
const policy = {
	approvals: { 83: { scopeDigest: record.scopeDigest } },
	maxFixDispatches: 1,
	maxReviewCycles: 2,
	paidOverage: false,
	budgetVerification: { stopPaidUsage: true, expiresAt: "2026-10-01T00:00:00Z" },
};
const snapshot = {
	head,
	base,
	testedHead: head,
	testedBase: base,
	draft: false,
	implementerFinished: true,
	taskState: "completed",
	protectedPaths: [],
	unresolvedThreads: 0,
	checks: [
		"Lint",
		"Type Check",
		"Test",
		"Build",
		"Validate PR title (semantic)",
		"Cloud evidence",
	].map((name) => ({ name, status: "completed", conclusion: "success" })),
	review: null,
	evidence: { head, red: true, green: true, urls: ["https://github.com/example/evidence"] },
};
function fake(current = snapshot) {
	const calls = [];
	return {
		calls,
		async locatePR() {
			return { number: 84, state: "open", head: { sha: head } };
		},
		async scopeMatches() {
			return true;
		},
		async inspectPR() {
			return current;
		},
		async save(r) {
			calls.push({ save: r.state, fix: r.fixDispatches, review: r.reviewCycles });
		},
		async requestReview() {
			calls.push("review");
		},
		async requestFix() {
			calls.push("fix");
		},
	};
}
test("review intent is persisted before requesting, and replay does not request again", async () => {
	const api = fake();
	const next = await reconcileRun({ api, record, policy, now });
	assert.deepEqual(api.calls, [{ save: "reviewing", fix: 0, review: 1 }, "review"]);
	api.calls.length = 0;
	await reconcileRun({ api, record: next, policy, now });
	assert.deepEqual(api.calls, []);
});
test("failed required check permits one correction, then caps further dispatches", async () => {
	const api = fake({
		...snapshot,
		checks: snapshot.checks.map((c) => ({ ...c, conclusion: "failure" })),
	});
	const next = await reconcileRun({ api, record, policy, now });
	assert.deepEqual(api.calls, [{ save: "fixing", fix: 1, review: 0 }, "fix"]);
	api.calls.length = 0;
	const capped = await reconcileRun({
		api,
		record: { ...next, state: "implementing" },
		policy,
		now,
	});
	assert.equal(capped.reason, "correction-cap");
	assert.deepEqual(api.calls, [{ save: "blocked", fix: 1, review: 0 }]);
});
test("review cap and expired billing never request another metered review", async () => {
	for (const changed of [
		{ record: { ...record, reviewCycles: 2 } },
		{ policy: { ...policy, budgetVerification: null } },
	]) {
		const api = fake();
		const result = await reconcileRun({ api, record, policy, now, ...changed });
		assert.equal(result.state, "blocked");
		assert.equal(api.calls.includes("review"), false);
	}
});
test("reviewed record observes later human merge without another agent request", async () => {
	const api = fake();
	api.locatePR = async () => ({ number: 84, merged_at: now, head: { sha: head } });
	const result = await reconcileRun({
		api,
		record: { ...record, state: "reviewed", head },
		policy,
		now,
	});
	assert.equal(result.state, "merged");
	assert.deepEqual(api.calls, [{ save: "merged", fix: 0, review: 0 }]);
});
test("unconfirmed provider work and old evidence cannot pass", async () => {
	const api = fake({ ...snapshot, taskState: "failed" });
	const result = await reconcileRun({ api, record, policy, now });
	assert.equal(result.state, "blocked");
	assert.equal(result.reason, "provider-failed");
});

test("a reviewed PR closed without merge becomes blocked", async () => {
	const api = fake();
	api.locatePR = async () => ({ number: 84, state: "closed", head: { sha: head } });
	const result = await reconcileRun({
		api,
		record: { ...record, state: "reviewed", head },
		policy,
		now,
	});
	assert.equal(result.state, "blocked");
});
for (const [name, changed] of Object.entries({
	"draft reset": { draft: true },
	"changed base": { base: "c".repeat(40) },
})) {
	test(`reviewed is invalidated by ${name}`, async () => {
		const api = fake({ ...snapshot, ...changed });
		const result = await reconcileRun({
			api,
			record: { ...record, state: "reviewed", head },
			policy,
			now,
		});
		assert.notEqual(result.state, "reviewed");
	});
}

test("scope changed after dispatch blocks review or repair", async () => {
	const api = fake();
	api.scopeMatches = async () => false;
	const result = await reconcileRun({ api, record, policy, now });
	assert.equal(result.reason, "scope-or-ownership-changed");
	assert.equal(api.calls.includes("review"), false);
});

test("dismissed prior review immediately invalidates reviewed even within pending request timeout", async () => {
	const api = fake({ ...snapshot, review: null });
	const result = await reconcileRun({
		api,
		record: { ...record, state: "reviewed", head, reviewHead: head, reviewRequestedAt: now },
		policy,
		now,
	});
	assert.notEqual(result.state, "reviewed");
	assert.equal(api.calls[0].save, "verifying");
});

for (const approvals of [{}, { 83: { scopeDigest: "replacement-digest" } }]) {
	test(`revoked approval persists blocked before inspecting PR: ${JSON.stringify(approvals)}`, async () => {
		const api = fake();
		api.inspectPR = async () => {
			throw Error("approval-changed");
		};
		const next = await reconcileRun({ api, record, policy: { ...policy, approvals }, now });
		assert.equal(next.state, "blocked");
		assert.equal(next.reason, "approval-changed");
		assert.deepEqual(api.calls, [{ save: "blocked", fix: 0, review: 0 }]);
	});
}
