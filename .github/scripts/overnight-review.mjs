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
	if (snapshot.implementerFinished !== true || snapshot.draft !== false) {
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
	if (!/generated (?:no|0) comments|did not find any issues/i.test(review.body ?? "")) {
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
