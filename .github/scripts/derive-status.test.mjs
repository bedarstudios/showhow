import { describe, expect, it } from "vitest";
import { deriveStatus } from "./derive-status.mjs";

describe("deriveStatus", () => {
	it("puts an issue with no status labels in Todo", () => {
		expect(deriveStatus({ state: "open", labels: [] })).toBe("Todo");
		expect(deriveStatus({ state: "open", labels: ["bug", "priority"] })).toBe("Todo");
	});

	it("maps each status label to its column", () => {
		expect(deriveStatus({ state: "open", labels: ["creating-spec"] })).toBe("Creating plan/spec");
		expect(deriveStatus({ state: "open", labels: ["ready-to-implement"] })).toBe(
			"Ready to implement",
		);
		expect(deriveStatus({ state: "open", labels: ["in-progress"] })).toBe("In progress");
		expect(deriveStatus({ state: "open", labels: ["needs-review"] })).toBe("Reviewing");
		expect(deriveStatus({ state: "open", labels: ["review-passed"] })).toBe("Reviewing");
		expect(deriveStatus({ state: "open", labels: ["needs-human"] })).toBe("Blocked");
	});

	// A closed issue is finished regardless of what it was labelled on the way
	// out. Without this, a ticket that hit the cap and was then closed by hand
	// would sit in Blocked forever.
	it("treats closed as Done even when a blocking label survives", () => {
		expect(deriveStatus({ state: "closed", labels: ["needs-human"] })).toBe("Done");
		expect(deriveStatus({ state: "closed", labels: ["in-progress", "needs-review"] })).toBe("Done");
	});

	// The whole point of the rule being a pure function: an issue accumulates
	// labels rather than swapping them, so precedence is what decides the column.
	it("gives needs-human precedence over any review state", () => {
		expect(deriveStatus({ state: "open", labels: ["review-passed", "needs-human"] })).toBe(
			"Blocked",
		);
		expect(deriveStatus({ state: "open", labels: ["needs-human", "needs-review"] })).toBe(
			"Blocked",
		);
	});

	it("gives a review state precedence over in-progress", () => {
		expect(deriveStatus({ state: "open", labels: ["in-progress", "review-passed"] })).toBe(
			"Reviewing",
		);
		expect(deriveStatus({ state: "open", labels: ["in-progress", "needs-review"] })).toBe(
			"Reviewing",
		);
	});

	it("gives in-progress precedence over ready-to-implement", () => {
		expect(deriveStatus({ state: "open", labels: ["ready-to-implement", "in-progress"] })).toBe(
			"In progress",
		);
	});

	it("ignores label order", () => {
		const labels = ["priority", "needs-human", "bug", "review-passed"];
		expect(deriveStatus({ state: "open", labels })).toBe(
			deriveStatus({ state: "open", labels: [...labels].reverse() }),
		);
	});

	it("tolerates a missing or malformed label list", () => {
		expect(deriveStatus({ state: "open" })).toBe("Todo");
		expect(deriveStatus({ state: "open", labels: null })).toBe("Todo");
	});
});
