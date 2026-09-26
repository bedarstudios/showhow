import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanBrandingReferences } from "../../scripts/branding-check.mjs";

const roots = [];
const legacyToken = ["open", "screen"].join("");
const allowedLine = `  "content": "legacy .${legacyToken} project file here",`;

async function makeFixture(contents) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "showhow-branding-check-"));
	roots.push(root);
	await fs.writeFile(path.join(root, "design.pen"), contents);
	return root;
}

async function scan(root, files, allowed) {
	return scanBrandingReferences(root, { allowed }, async () => files);
}

describe("branding checker occurrence-aware exceptions", () => {
	afterEach(async () => {
		await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
	});

	it("allows exactly the recorded two matching lines", async () => {
		const root = await makeFixture(`${allowedLine}\n${allowedLine}\n`);
		const matches = await scan(
			root,
			["design.pen"],
			[{ file: "design.pen", lines: [{ text: allowedLine.trim(), count: 2 }] }],
		);
		expect(matches).toEqual([]);
	});

	it("rejects a third occurrence of the allowed line", async () => {
		const root = await makeFixture(`${allowedLine}\n${allowedLine}\n${allowedLine}\n`);
		const matches = await scan(
			root,
			["design.pen"],
			[{ file: "design.pen", lines: [{ text: allowedLine.trim(), count: 2 }] }],
		);
		expect(matches).toHaveLength(3);
	});

	it("rejects unrelated legacy-brand lines in a file with a line exception", async () => {
		const unrelatedLine = `unrelated ${legacyToken} reference`;
		const root = await makeFixture(`${allowedLine}\n${allowedLine}\n${unrelatedLine}\n`);
		const matches = await scan(
			root,
			["design.pen"],
			[{ file: "design.pen", lines: [{ text: allowedLine.trim(), count: 2 }] }],
		);
		expect(matches).toEqual([{ file: "design.pen", line: 3, text: unrelatedLine }]);
	});

	it("continues to skip entries without a lines exception", async () => {
		const root = await makeFixture(`unrelated ${legacyToken} reference\n`);
		const matches = await scan(root, ["design.pen"], [{ file: "design.pen" }]);
		expect(matches).toEqual([]);
	});
});
