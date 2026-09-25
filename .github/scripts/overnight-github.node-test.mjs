import assert from "node:assert/strict";
import test from "node:test";
import { GitHub } from "./overnight-github.mjs";
import { isImplementer, isReviewer } from "./overnight-identities.mjs";

const head = "a".repeat(40),
	base = "b".repeat(40);
const pr = {
	id: 4489609940,
	node_id: "PR_node",
	number: 84,
	head: { sha: head, repo: { full_name: "bedarstudios/showhow" } },
	base: { sha: base, ref: "main" },
	draft: false,
};
const policy = {
	repository: "bedarstudios/showhow",
	approvals: { 83: { scopeDigest: "digest", allowedFiles: ["src/demoVideo/timing.ts"] } },
};
function fixture({
	taskID = pr.id,
	ciBase = base,
	reviewHead = head,
	changed = "src/demoVideo/timing.ts",
} = {}) {
	const api = new GitHub(policy);
	api.call = async (_method, path) => {
		if (path.startsWith("/agents/"))
			return {
				tasks: [
					{
						id: "task",
						state: "completed",
						artifacts: [{ provider: "github", type: "pull", data: { id: taskID } }],
					},
				],
			};
		if (path.includes("/actions/runs?"))
			return {
				total_count: 1,
				workflow_runs: [
					{
						id: 1,
						path: ".github/workflows/ci.yml",
						head_sha: head,
						pull_requests: [{ number: 84, head: { sha: head }, base: { sha: ciBase } }],
					},
				],
			};
		if (path.includes("/jobs?"))
			return {
				total_count: 1,
				jobs: [
					{
						name: "Cloud evidence",
						conclusion: "success",
						status: "completed",
						html_url: "https://github.com/evidence",
					},
				],
			};
		if (path === "/graphql")
			return {
				data: {
					repository: {
						pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } } },
					},
				},
			};
		throw Error(`unexpected request ${path}`);
	};
	api.list = async (path) => {
		if (path.endsWith("/files")) return [{ filename: changed }];
		if (path.endsWith("/reviews"))
			return [
				{
					id: 10,
					user: { login: "Copilot", id: 175728472, type: "Bot" },
					commit_id: reviewHead,
					state: "COMMENTED",
					body: "generated no comments",
				},
			];
		if (path.endsWith("/comments")) return [];
		throw Error(`unexpected list ${path}`);
	};
	return api;
}
test("collector associates provider task by REST PR ID, not issue/PR number", async () => {
	const valid = await fixture().inspectPR({ issue: 83, scopeDigest: "digest" }, pr);
	assert.equal(valid.implementerFinished, true);
	assert.equal(valid.testedHead, head);
	assert.equal(valid.evidence.red, true);
	const unrelated = await fixture({ taskID: 84 }).inspectPR(
		{ issue: 83, scopeDigest: "digest" },
		pr,
	);
	assert.equal(unrelated.implementerFinished, false);
});
test("collector rejects old CI base, old reviewer head and protected file changes", async () => {
	const oldCI = await fixture({ ciBase: head }).inspectPR({ issue: 83, scopeDigest: "digest" }, pr);
	assert.equal(oldCI.evidence, null);
	assert.equal(oldCI.testedHead, undefined);
	const oldReview = await fixture({ reviewHead: base }).inspectPR(
		{ issue: 83, scopeDigest: "digest" },
		pr,
	);
	assert.equal(oldReview.review, null);
	const protectedChange = await fixture({ changed: ".github/workflows/ci.yml" }).inspectPR(
		{ issue: 83, scopeDigest: "digest" },
		pr,
	);
	assert.deepEqual(protectedChange.protectedPaths, [".github/workflows/ci.yml"]);
});
test("read-only adapter rejects REST writes and GraphQL mutations before transport", async () => {
	let requests = 0;
	const api = new GitHub(policy, {
		token: "fixture",
		request: async () => {
			requests++;
			throw Error("unexpected");
		},
	});
	await assert.rejects(() => api.call("POST", "/repos/bedarstudios/showhow/issues", {}), /dry-run/);
	await assert.rejects(
		() => api.call("POST", "/graphql", { query: "mutation { x }" }),
		/read-query/,
	);
	assert.equal(requests, 0);
});

test("identical Copilot display names cannot substitute implementation and review identities", () => {
	const worker = { login: "Copilot", id: 198982749, type: "Bot" };
	const reviewer = { login: "Copilot", id: 175728472, type: "Bot" };
	assert.equal(isImplementer(worker), true);
	assert.equal(isReviewer(worker), false);
	assert.equal(isReviewer(reviewer), true);
	assert.equal(isImplementer(reviewer), false);
	assert.equal(isReviewer({ ...reviewer, type: "User" }), false);
});

test("active cloud ownership requires only the implementer assignee", async () => {
	const { scopeDigest } = await import("./overnight.mjs");
	const record = { issue: 83, scopeDigest: scopeDigest("approved") };
	const worker = { id: 198982749, type: "Bot", login: "Copilot" };
	for (const [assignees, expected] of [
		[[worker], true],
		[[worker, { id: 123, type: "User", login: "owner" }], false],
		[[], false],
		[undefined, false],
	]) {
		const api = new GitHub(policy);
		api.call = async () => ({
			state: "open",
			body: "approved",
			labels: [{ name: "overnight" }],
			assignees,
		});
		assert.equal(await api.scopeMatches(record), expected);
	}
});
