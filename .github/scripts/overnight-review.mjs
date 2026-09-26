import { REVIEWER_ID } from "./overnight-identities.mjs";

const REQUIRED_CHECKS = [
	"Lint",
	"Type Check",
	"Test",
	"Build",
	"Validate PR title (semantic)",
	"Cloud evidence",
];
export function evaluateHead(snapshot) {
	const result = (verdict, reason) => ({ verdict, head: snapshot.head, reason });
	if (snapshot.protectedPaths?.length) return result("blocked", "protected-path-change");
	if (
		snapshot.implementerFinished !== true ||
		(snapshot.draft !== false && snapshot.draftReviewAllowed !== true)
	) {
		return result("pending", "implementer-not-finished");
	}
	if (snapshot.testedHead !== snapshot.head || snapshot.testedBase !== snapshot.base) {
		return result("pending", "ci-provenance-mismatch");
	}
	for (const name of REQUIRED_CHECKS) {
		const check = snapshot.checks?.find((candidate) => candidate.name === name);
		if (!check || check.status !== "completed") return result("pending", `check-pending:${name}`);
		if (check.conclusion !== "success") return result("fix", `check-not-passing:${name}`);
	}
	const review = snapshot.review;
	if (
		!review ||
		review.actorId !== REVIEWER_ID ||
		review.actorType !== "Bot" ||
		review.commit !== snapshot.head ||
		!["COMMENTED", "APPROVED"].includes(review.state)
	) {
		return result("pending", "current-independent-review-required");
	}
	if (
		!Number.isInteger(snapshot.unresolvedThreads) ||
		snapshot.unresolvedThreads > 0 ||
		!Number.isInteger(review.comments) ||
		review.comments > 0
	) {
		return result("fix", "review-findings");
	}
	// Copilot submits COMMENTED reviews. Zero inline comments alone cannot prove
	// a clean review: require its affirmative summary as well, otherwise escalate.
	const body = review.body ?? "";
	const legacyApproval = /generated (?:no|0) comments|did not find any issues/i.test(body);
	const overviewApproval =
		body.startsWith("<!-- ccr-overview-v2 -->") &&
		/^### 🟢 Approval recommended\s*$/m.test(body) &&
		/^\*\*Findings:\*\* None\s*$/m.test(body) &&
		body.includes(
			"No unresolved review issues were identified, and all readiness assessments support approval.",
		);
	if (!legacyApproval && !overviewApproval) {
		return result("blocked", "review-summary-needs-assessment");
	}
	const evidence = snapshot.evidence;
	if (
		evidence?.head !== snapshot.head ||
		evidence.red !== true ||
		evidence.green !== true ||
		!Array.isArray(evidence.urls) ||
		evidence.urls.length === 0
	) {
		return result("blocked", "behavior-evidence-unverified");
	}
	return result("reviewed", "current-head-verified");
}
