import { evaluateHead } from "./overnight-review.mjs";

export async function reconcileRun({ api, record, policy, now = new Date().toISOString() }) {
	if (["merged", "cancelled", "blocked"].includes(record.state)) return record;
	const save = async (patch) => {
		const updated = { ...record, ...patch, updatedAt: now };
		await api.save(updated);
		return updated;
	};
	const approval = policy.approvals?.[record.issue];
	if (!approval || approval.scopeDigest !== record.scopeDigest)
		return save({ state: "blocked", reason: "approval-changed" });
	const pr = await api.locatePR(record);
	if (!pr) {
		if (Date.parse(now) - Date.parse(record.createdAt) > 90 * 60 * 1000) {
			return save({ state: "blocked", reason: "no-pr-after-90-minutes-inspect-assignment" });
		}
		return record;
	}
	if (pr.merged_at) return save({ state: "merged", pr: pr.number, reason: "observed-human-merge" });
	if (pr.state !== "open")
		return save({ state: "blocked", pr: pr.number, reason: "pr-closed-without-merge" });
	if (!(await api.scopeMatches(record)))
		return save({ state: "blocked", reason: "scope-or-ownership-changed" });
	const snapshot = await api.inspectPR(record, pr);
	const context = {
		pr: pr.number,
		head: snapshot.head,
		sessionId: snapshot.sessionId,
		sessionUrl: snapshot.sessionUrl,
	};
	if (["failed", "timed_out", "cancelled", "waiting_for_user"].includes(snapshot.taskState)) {
		return save({ ...context, state: "blocked", reason: `provider-${snapshot.taskState}` });
	}
	if (record.state === "fixing" && record.lastFixHead === snapshot.head) {
		if (Date.parse(now) - Date.parse(record.fixRequestedAt) > 90 * 60 * 1000) {
			return save({ ...context, state: "blocked", reason: "correction-produced-no-new-head" });
		}
		return record;
	}
	const result = evaluateHead(snapshot);
	if (record.state === "reviewed" && result.verdict !== "reviewed") {
		record = await save({ ...context, state: "verifying", reason: result.reason });
	}
	if (result.verdict === "reviewed") {
		return save({
			...context,
			state: "reviewed",
			reason: result.reason,
			reviewUrl: snapshot.review.url,
			evidenceUrls: snapshot.evidence.urls,
			reviewedAt: now,
		});
	}
	if (result.verdict === "blocked")
		return save({ ...context, state: "blocked", reason: result.reason });
	const billingReady =
		policy.paidOverage === false &&
		policy.budgetVerification?.stopPaidUsage === true &&
		Date.parse(policy.budgetVerification.expiresAt) > Date.parse(now);
	if (result.verdict === "fix") {
		if (record.fixDispatches >= policy.maxFixDispatches || !billingReady) {
			return save({
				...context,
				state: "blocked",
				reason: billingReady ? "correction-cap" : "billing-unverified",
			});
		}
		const fixing = await save({
			...context,
			state: "fixing",
			fixDispatches: record.fixDispatches + 1,
			lastFixHead: snapshot.head,
			fixRequestedAt: now,
			reason: result.reason,
		});
		try {
			await api.requestFix(
				pr.number,
				`Current head ${snapshot.head}: ${result.reason}. Review findings and CI logs on GitHub.`,
			);
		} catch {
			// Intent was persisted; never resend a potentially delivered request.
			await api.save({ ...fixing, state: "blocked", reason: "correction-delivery-uncertain" });
			return { ...fixing, state: "blocked", reason: "correction-delivery-uncertain" };
		}
		return fixing;
	}
	if (result.reason === "current-independent-review-required") {
		if (record.reviewHead === snapshot.head) {
			if (Date.parse(now) - Date.parse(record.reviewRequestedAt) > 90 * 60 * 1000) {
				return save({ ...context, state: "blocked", reason: "review-not-received" });
			}
			return record;
		}
		if (record.reviewCycles >= policy.maxReviewCycles || !billingReady) {
			return save({
				...context,
				state: "blocked",
				reason: billingReady ? "review-cap" : "billing-unverified",
			});
		}
		const reviewing = await save({
			...context,
			state: "reviewing",
			reviewCycles: record.reviewCycles + 1,
			reviewHead: snapshot.head,
			reviewRequestedAt: now,
		});
		try {
			await api.requestReview(pr.number);
		} catch {
			await api.save({ ...reviewing, state: "blocked", reason: "review-delivery-uncertain" });
			return { ...reviewing, state: "blocked", reason: "review-delivery-uncertain" };
		}
		return reviewing;
	}
	if (Date.parse(now) - Date.parse(record.createdAt) > 3 * 60 * 60 * 1000) {
		return save({ ...context, state: "blocked", reason: `run-timeout:${result.reason}` });
	}
	return record;
}
