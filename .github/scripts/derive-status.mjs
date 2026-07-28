/**
 * Derive a Projects v2 Status column from an issue's state and labels.
 *
 * Labels are the source of truth for the Bedar Loop board; the board is a
 * projection of them. This function is deliberately PURE and absolute: it looks
 * only at the issue's full current label set, never at the board's existing
 * value and never at which label just changed.
 *
 * That matters because label events arrive out of order and can be replayed.
 * A relative rule ("labeled -> advance a column") would race with itself and
 * with the agents that write labels unattended. An absolute rule converges on
 * the same column no matter how many times, or in what order, it runs.
 *
 * First match wins.
 */

const RULES = [
	{ status: "Blocked", label: "needs-human" },
	{ status: "Reviewing", label: ["review-passed", "needs-review"] },
	{ status: "In progress", label: "in-progress" },
	{ status: "Ready to implement", label: "ready-to-implement" },
	{ status: "Creating plan/spec", label: "creating-spec" },
];

export const DEFAULT_STATUS = "Todo";
export const CLOSED_STATUS = "Done";

/**
 * @param {{ state?: string, labels?: Array<string|{name:string}>|null }} issue
 * @returns {string} one of the seven Status option names
 */
export function deriveStatus(issue) {
	// A closed issue is finished, whatever it was carrying on the way out.
	if (issue?.state === "closed") return CLOSED_STATUS;

	// Accept both the bare strings a caller might build and the label objects
	// the REST API actually returns, so callers never have to remember which.
	const names = new Set(
		(Array.isArray(issue?.labels) ? issue.labels : [])
			.map((label) => (typeof label === "string" ? label : label?.name))
			.filter(Boolean),
	);

	for (const rule of RULES) {
		const wanted = Array.isArray(rule.label) ? rule.label : [rule.label];
		if (wanted.some((name) => names.has(name))) return rule.status;
	}

	return DEFAULT_STATUS;
}
