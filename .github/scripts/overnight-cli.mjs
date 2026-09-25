import { appendFileSync, readFileSync } from "node:fs";
import { startRun } from "./overnight-dispatch.mjs";
import { GitHub } from "./overnight-github.mjs";
import { reconcileRun } from "./overnight-reconcile.mjs";

const policy = JSON.parse(readFileSync(".bedar/overnight.json", "utf8"));
const mode = process.env.CLOUD_MODE ?? "dry-run";
if (!["dry-run", "start", "reconcile", "nightly"].includes(mode)) throw Error("unknown-mode");
const writable = mode !== "dry-run";
if (
	writable &&
	(process.env.GITHUB_ACTIONS !== "true" ||
		process.env.GITHUB_REF !== "refs/heads/main" ||
		process.env.GITHUB_REPOSITORY !== policy.repository)
)
	throw Error("trusted-main-workflow-required");
if (!policy.enabled) {
	console.log("Cloud controller disabled; zero mutations.");
	process.exit(0);
}
const api = new GitHub(policy, {
	token: process.env.GITHUB_TOKEN,
	agentToken: process.env.COPILOT_DISPATCH_TOKEN,
	writable,
});
const records = await api.records();
if (mode === "reconcile" || mode === "nightly") {
	for (const record of records) {
		const result = await reconcileRun({ api, record, policy });
		await api.projectStatus(result);
		console.log(
			JSON.stringify({ issue: record.issue, state: result.state, reason: result.reason }),
		);
	}
}
if (mode === "nightly") {
	if (!policy.nightlyEnabled || !policy.pilotEvidence?.verified) {
		console.log("Nightly admission disabled pending pilot proof.");
		process.exit(0);
	}
	const current = await api.records();
	if (
		!current.some(
			(r) =>
				r.issue === policy.pilotEvidence.issue &&
				["reviewed", "merged"].includes(r.state) &&
				r.head === policy.pilotEvidence.head,
		)
	)
		throw Error("pilot-proof-not-in-ledger");
}
if (mode === "start" || mode === "dry-run" || mode === "nightly") {
	const numbers =
		mode === "nightly"
			? Object.keys(policy.approvals)
					.map(Number)
					.sort((a, b) => a - b)
			: [Number(process.env.CLOUD_ISSUE)];
	for (const issue of numbers) {
		if (!Number.isInteger(issue) || issue < 1) throw Error("issue-number-required");
		const snapshot = await api.snapshot(issue);
		const result = await startRun({ api, snapshot, policy, dryRun: mode === "dry-run" });
		if (result.state) await api.projectStatus(result);
		console.log(JSON.stringify(result));
		if (process.env.GITHUB_STEP_SUMMARY)
			appendFileSync(
				process.env.GITHUB_STEP_SUMMARY,
				`Issue #${issue}: ${result.state ?? result.reason ?? "eligible"}\n`,
			);
		if (result.state || result.eligible) break;
	}
}
