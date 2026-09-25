// All side effects go through this boundary; persist intent before metered writes.
export async function startRun({ api, snapshot, policy, dryRun = true }) {
	const { admit } = await import("./overnight.mjs");
	const decision = admit(snapshot, policy);
	if (!decision.eligible || dryRun) return { ...decision, dryRun };
	const record = {
		version: 1,
		issue: snapshot.issue,
		scopeDigest: decision.scopeDigest,
		baseHead: snapshot.baseHead,
		state: "reserved",
		fixDispatches: 0,
		reviewCycles: 0,
		createdAt: snapshot.now,
	};
	const saved = await api.reserve(record);
	const current = await api.snapshot(snapshot.issue);
	// Reservation exists now; admission still considers the pre-reservation count.
	const recheck = admit(
		{ ...current, existingRun: false, activeRuns: snapshot.activeRuns },
		policy,
	);
	if (
		!recheck.eligible ||
		recheck.baseHead !== record.baseHead ||
		recheck.scopeDigest !== record.scopeDigest
	) {
		await api.save({ ...saved, state: "blocked", reason: "admission-changed" });
		return { eligible: false, reason: "admission-changed" };
	}
	// A crash after this save is intentionally not retryable without reconciliation.
	const pending = { ...saved, state: "assigning" };
	await api.save(pending);
	try {
		const assignment = await api.assign(
			snapshot.issue,
			record.baseHead,
			policy.approvals[snapshot.issue],
		);
		const result = { ...pending, state: "implementing", assignment };
		await api.save(result);
		return result;
	} catch {
		const result = {
			...pending,
			state: "assignment-uncertain",
			reason: "inspect-provider-before-any-retry",
		};
		await api.save(result);
		return result;
	}
}
