import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isImplementer } from "./overnight-identities.mjs";

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const policy = JSON.parse(readFileSync(process.env.POLICY_FILE, "utf8"));
const pr = event.pull_request;
if (!pr || !isImplementer(pr.user)) throw Error("not-copilot-pr");
const approved = Object.entries(policy.approvals).filter(([number]) =>
	new RegExp(`(?:#|/issues/)${number}\\b`).test(pr.body ?? ""),
);
if (approved.length !== 1) throw Error("exactly-one-approved-issue-required");
const [number, approval] = approved[0];
const files = execFileSync("git", ["diff", "--name-only", `${pr.base.sha}...${pr.head.sha}`], {
	encoding: "utf8",
})
	.trim()
	.split("\n")
	.filter(Boolean);
if (
	files.some(
		(file) =>
			!approval.allowedFiles.some((allowed) =>
				allowed.endsWith("/") ? file.startsWith(allowed) : file === allowed,
			),
	)
)
	throw Error("unapproved-file-change");
writeFileSync(process.env.APPROVAL_FILE, JSON.stringify(approval));
writeFileSync(
	process.env.GITHUB_ENV,
	`PILOT_ISSUE=${number}\nPR_HEAD=${pr.head.sha}\nPR_BASE=${pr.base.sha}\n`,
	{ flag: "a" },
);
