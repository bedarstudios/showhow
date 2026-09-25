import assert from "node:assert/strict";
import test from "node:test";
import { admit, scopeDigest } from "./overnight.mjs";

const body = "Approved portable behavior";
const approval = {
	scopeDigest: scopeDigest(body),
	approver: "bedarstudios",
	source: "https://github.com/bedarstudios/showhow/issues/83",
	profile: "linux-portable",
	allowedFiles: ["src/demoVideo/timing.ts"],
	targetTest: "src/demoVideo/timing.test.ts",
};
const policy = {
	enabled: true,
	repository: "bedarstudios/showhow",
	projectNumber: 2,
	mode: "maintenance",
	maxActive: 1,
	maxFixDispatches: 1,
	maxReviewCycles: 2,
	paidOverage: false,
	osDeployment: { commit: "a".repeat(40), verified: true },
	budgetVerification: { stopPaidUsage: true, expiresAt: "2026-10-01T00:00:00Z" },
	approvals: { 83: approval },
};
const snapshot = {
	repository: policy.repository,
	issue: 83,
	body,
	state: "open",
	labels: ["overnight", "ready-to-implement"],
	assignees: [],
	projectNumbers: [2],
	baseHead: "b".repeat(40),
	mode: "maintenance",
	dependenciesIntegrated: true,
	activeRuns: 0,
	existingRun: false,
	linkedPRs: [],
	now: "2026-09-25T12:00:00Z",
};

test("admission requires approved scope even when queue labels are present", () => {
	assert.equal(admit(snapshot, { ...policy, approvals: {} }).eligible, false);
	assert.equal(admit(snapshot, policy).eligible, true);
});

for (const [name, changed] of Object.entries({
	"edited scope": { body: "Different work" },
	"local owner": { labels: ["overnight", "ready-to-implement", "in-progress"] },
	"human blocked": { labels: ["overnight", "ready-to-implement", "needs-human"] },
	"no cloud reservation": { labels: ["ready-to-implement"] },
	"not ready": { labels: ["overnight"] },
	"assigned elsewhere": { assignees: ["someone"] },
	"off board": { projectNumbers: [] },
	closed: { state: "closed" },
	"duplicate run": { existingRun: true },
	capacity: { activeRuns: 1 },
	"existing PR": { linkedPRs: [84] },
	"dependency incomplete": { dependenciesIntegrated: false },
	"unknown mode": { mode: null },
	"wrong repository": { repository: "other/repo" },
	"unknown main": { baseHead: "" },
})) {
	test(`admission rejects ${name}`, () => {
		assert.equal(admit({ ...snapshot, ...changed }, policy).eligible, false);
	});
}
for (const [name, changed] of Object.entries({
	disabled: { enabled: false },
	"billing unknown": { budgetVerification: null },
	"billing expired": {
		budgetVerification: { stopPaidUsage: true, expiresAt: "2026-09-01T00:00:00Z" },
	},
	"paid usage enabled": { paidOverage: true },
	"undeployed local protection": { osDeployment: null },
})) {
	test(`admission rejects ${name}`, () => {
		assert.equal(admit(snapshot, { ...policy, ...changed }).eligible, false);
	});
}

test("approval digest uses fixed SHA256 and includes whitespace edits", () => {
	assert.equal(
		scopeDigest("abc"),
		"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
	);
	assert.notEqual(scopeDigest(body), scopeDigest(`${body}\n`));
});

import { startRun } from "./overnight-dispatch.mjs";

function fakeAPI(next = snapshot) {
	const calls = [];
	return {
		calls,
		async reserve(record) {
			calls.push("reserve");
			return { ...record, id: 1 };
		},
		async snapshot() {
			calls.push("read");
			return next;
		},
		async save(record) {
			calls.push(`save:${record.state}`);
		},
		async assign() {
			calls.push("assign");
			return { assignee: "copilot-swe-agent" };
		},
	};
}
test("dry run has no mutations or assignment", async () => {
	const api = fakeAPI();
	const result = await startRun({ api, snapshot, policy });
	assert.equal(result.eligible, true);
	assert.deepEqual(api.calls, []);
});
test("reservation and fresh recheck precede the single assignment", async () => {
	const api = fakeAPI();
	await startRun({ api, snapshot, policy, dryRun: false });
	assert.deepEqual(api.calls, ["reserve", "read", "save:assigning", "assign", "save:implementing"]);
});
test("a local claim acquired after reservation blocks cloud assignment", async () => {
	const api = fakeAPI({ ...snapshot, labels: [...snapshot.labels, "in-progress"] });
	await startRun({ api, snapshot, policy, dryRun: false });
	assert.deepEqual(api.calls, ["reserve", "read", "save:blocked"]);
});
test("ambiguous assignment never triggers a blind retry", async () => {
	const api = fakeAPI();
	api.assign = async () => {
		api.calls.push("assign");
		throw Error("connection lost after server accepted");
	};
	const record = await startRun({ api, snapshot, policy, dryRun: false });
	assert.equal(record.state, "assignment-uncertain");
	assert.equal(api.calls.filter((c) => c === "assign").length, 1);
});
