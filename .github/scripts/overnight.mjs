import { createHash } from "node:crypto";
export function scopeDigest(body) {
	return createHash("sha256").update(body).digest("hex");
}
export function admit(snapshot, policy) {
	const reject = (reason) => ({ eligible: false, reason });
	if (policy.maxActive !== 1 || policy.maxFixDispatches !== 1 || policy.maxReviewCycles !== 2)
		return reject("invalid-limits");
	if (policy.enabled !== true) return reject("disabled");
	if (
		policy.paidOverage !== false ||
		policy.budgetVerification?.stopPaidUsage !== true ||
		!(Date.parse(policy.budgetVerification.expiresAt) > Date.parse(snapshot.now))
	) {
		return reject("billing-unverified-or-expired");
	}
	if (policy.osDeployment?.verified !== true || !/^[a-f0-9]{40}$/.test(policy.osDeployment.commit))
		return reject("local-protection-unverified");
	if (
		snapshot.repository !== policy.repository ||
		snapshot.mode !== "maintenance" ||
		policy.mode !== "maintenance"
	)
		return reject("repository-or-mode");
	if (!/^[a-f0-9]{40}$/.test(snapshot.baseHead)) return reject("unknown-main");
	if (snapshot.state !== "open" || !snapshot.projectNumbers?.includes(policy.projectNumber)) {
		return reject("closed-or-off-board");
	}
	const labels = snapshot.labels ?? [];
	if (
		!labels.includes("overnight") ||
		!labels.includes("ready-to-implement") ||
		labels.includes("in-progress") ||
		labels.includes("needs-human") ||
		!Array.isArray(snapshot.assignees) ||
		snapshot.assignees.length !== 0
	) {
		return reject("ownership-or-readiness");
	}
	if (snapshot.dependenciesIntegrated !== true) return reject("dependencies-unverified");
	if (
		snapshot.existingRun !== false ||
		!Array.isArray(snapshot.linkedPRs) ||
		snapshot.linkedPRs.length !== 0 ||
		!Number.isInteger(snapshot.activeRuns) ||
		snapshot.activeRuns >= policy.maxActive
	)
		return reject("existing-work-or-capacity");
	const approval = policy.approvals?.[snapshot.issue];
	if (
		!approval ||
		approval.profile !== "linux-portable" ||
		approval.approver !== "bedarstudios" ||
		!approval.source ||
		!Array.isArray(approval.allowedFiles) ||
		approval.allowedFiles.length === 0 ||
		!approval.targetTest ||
		approval.scopeDigest !== scopeDigest(snapshot.body)
	) {
		return { eligible: false, reason: "scope-unapproved-or-edited" };
	}
	return {
		eligible: true,
		issue: snapshot.issue,
		baseHead: snapshot.baseHead,
		scopeDigest: approval.scopeDigest,
	};
}
