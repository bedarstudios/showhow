import { scopeDigest } from "./overnight.mjs";
import { isImplementer, isReviewer } from "./overnight-identities.mjs";

const MARKER = "<!-- bedar-cloud-run:v1 -->\n";
const BOT = "github-actions[bot]";
export class GitHub {
	constructor(policy, { token, agentToken, writable = false, request = fetch } = {}) {
		this.policy = policy;
		this.token = token;
		this.agentToken = agentToken;
		this.writable = writable;
		this.request = request;
		this.prefix = `/repos/${policy.repository}`;
	}
	async call(method, path, body, agent = false) {
		if (path === "/graphql" && !/^query\b/.test(body?.query?.trim() ?? ""))
			throw Error("read-query-required");
		if (method !== "GET" && path !== "/graphql" && !this.writable)
			throw Error("dry-run-write-forbidden");
		const token = agent ? this.agentToken : this.token;
		if (!token) throw Error("required-token-missing");
		const response = await this.request(`https://api.github.com${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
				"Content-Type": "application/json",
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: AbortSignal.timeout(30000),
		});
		if (!response.ok) throw Error(`GitHub ${method} ${path.split("?")[0]}: ${response.status}`);
		if (response.status === 204) return null;
		const data = await response.json();
		if (data.errors?.length) throw Error("GitHub GraphQL read failed");
		return data;
	}
	async list(path, agent = false) {
		const all = [];
		for (let page = 1; page <= 100; page++) {
			const data = await this.call(
				"GET",
				`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
				undefined,
				agent,
			);
			if (!Array.isArray(data)) throw Error("unexpected-list-response");
			all.push(...data);
			if (data.length < 100) return all;
		}
		throw Error("pagination-limit");
	}
	async records() {
		if (!Number.isInteger(this.policy.stateIssue)) throw Error("state-issue-not-configured");
		const comments = await this.list(`${this.prefix}/issues/${this.policy.stateIssue}/comments`);
		return comments
			.filter((c) => c.body?.startsWith(MARKER))
			.map((c) => {
				if (c.user.login !== BOT) throw Error("untrusted-state-record");
				const record = JSON.parse(c.body.slice(MARKER.length));
				if (
					record.version !== 1 ||
					!Number.isInteger(record.issue) ||
					!record.state ||
					!Number.isInteger(record.fixDispatches) ||
					record.fixDispatches < 0 ||
					record.fixDispatches > 1 ||
					!Number.isInteger(record.reviewCycles) ||
					record.reviewCycles < 0 ||
					record.reviewCycles > 2
				)
					throw Error("invalid-state-record");
				return { ...record, id: c.id };
			});
	}
	async reserve(record) {
		const records = await this.records();
		if (
			records.some((r) => r.issue === record.issue) ||
			records.filter((r) => !["merged", "cancelled"].includes(r.state)).length >=
				this.policy.maxActive
		) {
			throw Error("reservation-conflict");
		}
		const saved = await this.call(
			"POST",
			`${this.prefix}/issues/${this.policy.stateIssue}/comments`,
			{
				body: MARKER + JSON.stringify(record),
			},
		);
		return { ...record, id: saved.id };
	}
	async save(record) {
		if (!Number.isInteger(record.id)) throw Error("state-id-required");
		const current = await this.call("GET", `${this.prefix}/issues/comments/${record.id}`);
		if (current.user.login !== BOT || !current.body.startsWith(MARKER))
			throw Error("state-owner-mismatch");
		await this.call("PATCH", `${this.prefix}/issues/comments/${record.id}`, {
			body: MARKER + JSON.stringify(record),
		});
	}
	async snapshot(number) {
		if (!Number.isInteger(number)) throw Error("invalid-issue-number");
		const issue = await this.call("GET", `${this.prefix}/issues/${number}`);
		const main = await this.call("GET", `${this.prefix}/commits/main`);
		const records = await this.records();
		const [owner, name] = this.policy.repository.split("/");
		const projects = await this.call(
			"POST",
			"/graphql",
			{
				query: `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){issue(number:$number){projectItems(first:100){nodes{project{number}} pageInfo{hasNextPage}} closedByPullRequestsReferences(first:100,includeClosedPrs:true){nodes{url} pageInfo{hasNextPage}}}}}`,
				variables: { owner, name, number },
			},
			true,
		);
		const items = projects.data?.repository?.issue?.projectItems;
		const linked = projects.data?.repository?.issue?.closedByPullRequestsReferences;
		if (!linked || linked.pageInfo.hasNextPage) throw Error("linked-prs-unverified");
		if (!items || items.pageInfo.hasNextPage) throw Error("project-membership-unverified");
		const approval = this.policy.approvals[number];
		let dependenciesIntegrated = Array.isArray(approval?.dependencyCommits);
		for (const commit of approval?.dependencyCommits ?? []) {
			if (!/^[a-f0-9]{40}$/.test(commit)) {
				dependenciesIntegrated = false;
				break;
			}
			const comparison = await this.call("GET", `${this.prefix}/compare/${commit}...${main.sha}`);
			if (!["ahead", "identical"].includes(comparison.status)) dependenciesIntegrated = false;
		}
		const modeFile = await this.call(
			"GET",
			`${this.prefix}/contents/.bedar/loop.yml?ref=${main.sha}`,
		);
		const modeText = Buffer.from(modeFile.content, "base64").toString("utf8");
		return {
			repository: this.policy.repository,
			issue: number,
			body: issue.body ?? "",
			state: issue.state,
			labels: issue.labels.map((l) => l.name),
			assignees: issue.assignees.map((a) => a.login),
			projectNumbers: items.nodes.map((item) => item.project.number),
			baseHead: main.sha,
			mode: /^standalone_mode:\s*maintenance\s*$/m.test(modeText) ? "maintenance" : null,
			dependenciesIntegrated,
			activeRuns: records.filter((r) => !["merged", "cancelled"].includes(r.state)).length,
			existingRun: records.some((r) => r.issue === number),
			now: new Date().toISOString(),
			linkedPRs: linked.nodes.map((pr) => pr.url),
		};
	}
	async assign(issue, baseHead, approval) {
		const assigned = await this.call(
			"POST",
			`${this.prefix}/issues/${issue}/assignees`,
			{
				assignees: ["copilot-swe-agent[bot]"],
				agent_assignment: {
					target_repo: this.policy.repository,
					base_branch: "main",
					custom_instructions: `Implement only issue #${issue}, approved digest ${approval.scopeDigest}, expected main ${baseHead}. Follow .github/skills/overnight-ticket/SKILL.md. Allowed paths: ${approval.allowedFiles.join(", ")}. Targeted check: npx vitest run ${approval.targetTest}. Preserve the relevant RED and GREEN commit/test evidence. Return one PR with Fixes #${issue} in its body for separate review and human merge.`,
				},
			},
			true,
		);
		if (!assigned.assignees?.some(isImplementer)) {
			throw Error("assignment-not-confirmed");
		}
		return { url: assigned.html_url, confirmedAt: new Date().toISOString() };
	}
	async requestReview(pr) {
		return this.call(
			"POST",
			`${this.prefix}/pulls/${pr}/requested_reviewers`,
			{
				reviewers: ["copilot-pull-request-reviewer[bot]"],
			},
			true,
		);
	}
	async requestFix(pr, message) {
		return this.call(
			"POST",
			`${this.prefix}/issues/${pr}/comments`,
			{
				body: `@copilot Correct this same PR within its approved scope. ${message}\nRerun the required checks and update commit-specific evidence. Return for a second independent review. Never merge.`,
			},
			true,
		);
	}
	async locatePR(record) {
		const [owner, name] = this.policy.repository.split("/");
		const result = await this.call("POST", "/graphql", {
			query: `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){issue(number:$number){closedByPullRequestsReferences(first:100,includeClosedPrs:true){nodes{url} pageInfo{hasNextPage}}}}}`,
			variables: { owner, name, number: record.issue },
		});
		const linked = result.data?.repository?.issue?.closedByPullRequestsReferences;
		if (!linked || linked.pageInfo.hasNextPage) throw Error("linked-prs-unverified");
		const urls = linked.nodes.map((pr) => pr.url);
		const prefix = `https://github.com/${this.policy.repository}/pull/`;
		const candidates = [];
		for (const url of urls) {
			if (!url.startsWith(prefix) || !/^\d+$/.test(url.slice(prefix.length))) continue;
			const pr = await this.call("GET", `${this.prefix}/pulls/${url.slice(prefix.length)}`);
			if (
				isImplementer(pr.user) &&
				Date.parse(pr.created_at) + 1000 >= Date.parse(record.createdAt)
			)
				candidates.push(pr);
		}
		if (candidates.length > 1) throw Error("multiple-agent-prs");
		return candidates[0] ?? null;
	}
	async inspectPR(record, pr) {
		if (pr.base.ref !== "main" || pr.head.repo?.full_name !== this.policy.repository)
			throw Error("unexpected-pr-repository-or-base");
		const approval = this.policy.approvals[record.issue];
		if (!approval || approval.scopeDigest !== record.scopeDigest) throw Error("approval-changed");
		const files = await this.list(`${this.prefix}/pulls/${pr.number}/files`);
		const protectedPaths = files
			.map((f) => f.filename)
			.filter(
				(file) =>
					!approval.allowedFiles.some((allowed) =>
						allowed.endsWith("/") ? file.startsWith(allowed) : file === allowed,
					),
			);
		const tasks = await this.call(
			"GET",
			`/agents/repos/${this.policy.repository}/tasks?per_page=100`,
			undefined,
			true,
		);
		if (!Array.isArray(tasks.tasks) || tasks.tasks.length >= 100)
			throw Error("task-list-incomplete");
		const matching = tasks.tasks.filter((task) =>
			task.artifacts?.some(
				(artifact) =>
					artifact.provider === "github" &&
					artifact.type === "pull" &&
					(artifact.data.id === pr.id || artifact.data.global_id === pr.node_id),
			),
		);
		if (matching.length > 1) throw Error("multiple-tasks-for-pr");
		const task = matching[0];
		const runs = await this.call(
			"GET",
			`${this.prefix}/actions/runs?event=pull_request&head_sha=${pr.head.sha}&per_page=100`,
		);
		if (runs.total_count > 100) throw Error("ci-list-incomplete");
		const run = runs.workflow_runs
			.filter(
				(run) =>
					run.path === ".github/workflows/ci.yml" &&
					run.head_sha === pr.head.sha &&
					run.pull_requests.some(
						(p) =>
							p.number === pr.number && p.head.sha === pr.head.sha && p.base.sha === pr.base.sha,
					),
			)
			.sort((a, b) => b.id - a.id)[0];
		let checks = [];
		if (run) {
			const jobs = await this.call(
				"GET",
				`${this.prefix}/actions/runs/${run.id}/jobs?per_page=100`,
			);
			if (jobs.total_count > 100) throw Error("ci-jobs-incomplete");
			checks = jobs.jobs;
		}
		const reviews = await this.list(`${this.prefix}/pulls/${pr.number}/reviews`);
		const latest = reviews
			.filter((r) => isReviewer(r.user) && r.commit_id === pr.head.sha)
			.sort((a, b) => b.id - a.id)[0];
		const comments = latest
			? await this.list(`${this.prefix}/pulls/${pr.number}/reviews/${latest.id}/comments`)
			: [];
		const [owner, name] = this.policy.repository.split("/");
		const threads = await this.call("POST", "/graphql", {
			query: `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved isOutdated} pageInfo{hasNextPage}}}}}`,
			variables: { owner, name, number: pr.number },
		});
		const threadList = threads.data?.repository?.pullRequest?.reviewThreads;
		if (!threadList || threadList.pageInfo.hasNextPage) throw Error("review-threads-incomplete");
		const evidenceJob = checks.find((c) => c.name === "Cloud evidence");
		return {
			head: pr.head.sha,
			base: pr.base.sha,
			draft: pr.draft,
			implementerFinished: task?.state === "completed",
			taskState: task?.state,
			sessionId: task?.id,
			sessionUrl: task?.html_url,
			testedHead: run?.head_sha,
			testedBase: run?.pull_requests.find((p) => p.number === pr.number)?.base.sha,
			protectedPaths,
			checks,
			review: latest
				? {
						user: latest.user.login,
						actorId: latest.user.id,
						actorType: latest.user.type,
						commit: latest.commit_id,
						state: latest.state,
						comments: comments.length,
						body: latest.body,
						url: latest.html_url,
					}
				: null,
			unresolvedThreads: threadList.nodes.filter((t) => !t.isResolved && !t.isOutdated).length,
			evidence:
				evidenceJob?.conclusion === "success"
					? {
							head: pr.head.sha,
							red: true,
							green: true,
							urls: [evidenceJob.html_url],
						}
					: null,
		};
	}
	async scopeMatches(record) {
		const issue = await this.call("GET", `${this.prefix}/issues/${record.issue}`);
		return (
			scopeDigest(issue.body ?? "") === record.scopeDigest &&
			issue.labels.some((l) => l.name === "overnight") &&
			!issue.labels.some((l) => l.name === "needs-human")
		);
	}
	async projectStatus(record) {
		const status = ["blocked", "assignment-uncertain"].includes(record.state)
			? "needs-human"
			: record.state === "reviewed"
				? "review-passed"
				: record.state === "reviewing"
					? "needs-review"
					: ["implementing", "fixing", "verifying"].includes(record.state)
						? "in-progress"
						: null;
		if (!status) return;
		const issue = await this.call("GET", `${this.prefix}/issues/${record.issue}`);
		if (!issue.labels.some((l) => l.name === "overnight")) return;
		const names = issue.labels.map((l) => l.name);
		if (!names.includes(status))
			await this.call("POST", `${this.prefix}/issues/${record.issue}/labels`, { labels: [status] });
		// Only labels owned by this lane; preserve unrelated issue metadata.
		for (const old of ["ready-to-implement", "in-progress", "needs-review", "review-passed"]) {
			if (old !== status && names.includes(old)) {
				await this.call("DELETE", `${this.prefix}/issues/${record.issue}/labels/${old}`);
			}
		}
	}
}
