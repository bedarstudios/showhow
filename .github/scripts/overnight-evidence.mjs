import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
export function validateReport(report, { issue, head, targetTest }) {
	if (
		report.issue !== issue ||
		!sha(report.redCommit) ||
		report.redCommit === head ||
		report.targetTest !== targetTest ||
		!/^src\/[A-Za-z0-9_./-]+\.test\.tsx?$/.test(targetTest)
	) {
		throw Error("invalid-evidence-contract");
	}
	return report.redCommit;
}
export function isBehavioralFailure(result) {
	return (
		Number.isInteger(result.numFailedTests) &&
		result.numFailedTests > 0 &&
		result.testResults?.some((file) =>
			file.assertionResults?.some(
				(assertion) =>
					assertion.status === "failed" &&
					assertion.failureMessages?.some((message) =>
						/AssertionError|expected .* to|to (?:be|equal|throw)/is.test(message),
					),
			),
		)
	);
}
function run() {
	const head = process.env.PR_HEAD;
	const base = process.env.PR_BASE;
	const issue = Number(process.env.PILOT_ISSUE);
	const profile = JSON.parse(readFileSync(process.env.APPROVAL_FILE, "utf8"));
	if (!sha(head) || !sha(base) || !Number.isInteger(issue)) throw Error("invalid-provenance");
	const original = git("rev-parse", "HEAD");
	const report = JSON.parse(git("show", `${head}:${profile.evidenceFile}`));
	const red = validateReport(report, { issue, head, targetTest: profile.targetTest });
	git("merge-base", "--is-ancestor", base, red);
	git("merge-base", "--is-ancestor", red, head);
	if (red === base) throw Error("red-must-be-a-ticket-commit");
	if (
		git("show", `${red}:${profile.targetTest}`) !== git("show", `${head}:${profile.targetTest}`)
	) {
		throw Error("red-and-green-must-exercise-identical-target-test");
	}
	const env = { ...process.env };
	delete env.GH_TOKEN;
	delete env.GITHUB_TOKEN;
	const vitest = () =>
		spawnSync("npx", ["--no-install", "vitest", "run", profile.targetTest, "--reporter=json"], {
			encoding: "utf8",
			env,
			timeout: 120000,
			maxBuffer: 10 * 1024 * 1024,
		});
	try {
		git("checkout", "--detach", red);
		const failed = vitest();
		if (failed.error || failed.status === 0 || !isBehavioralFailure(JSON.parse(failed.stdout))) {
			throw Error("red-did-not-reproduce-a-behavioral-assertion");
		}
		console.log(`Verified behavioral RED at ${red}`);
		git("checkout", "--detach", head);
		const passed = vitest();
		const green = JSON.parse(passed.stdout);
		if (
			passed.error ||
			passed.status !== 0 ||
			green.numFailedTests !== 0 ||
			green.numPassedTests < 1
		) {
			throw Error("targeted-green-failed");
		}
		console.log(`Verified identical targeted GREEN at ${head}`);
	} finally {
		git("checkout", "--detach", original);
	}
}
if (process.argv[1]?.endsWith("/overnight-evidence.mjs")) run();
