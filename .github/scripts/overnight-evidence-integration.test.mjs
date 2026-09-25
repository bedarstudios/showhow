import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dependencies = resolve("node_modules");
const runner = fileURLToPath(new URL("./overnight-evidence.mjs", import.meta.url));
test("trusted evidence runner reproduces actual Vitest red and green commits", () => {
	const root = mkdtempSync(join(tmpdir(), "cloud-evidence-"));
	const git = (...args) =>
		execFileSync("git", args, {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	const put = (name, text) => writeFileSync(join(root, name), text);
	try {
		git("init", "-q");
		git("config", "user.email", "fixture@example.invalid");
		git("config", "user.name", "Fixture");
		mkdirSync(join(root, "src/demo"), { recursive: true });
		mkdirSync(join(root, "artifacts"));
		put(".gitignore", "node_modules\n");
		put("package.json", '{"type":"module"}');
		git("add", ".");
		git("commit", "-qm", "base");
		const base = git("rev-parse", "HEAD");
		put("src/demo/timing.ts", "export function frames() { return 0; }\n");
		put(
			"src/demo/timing.test.ts",
			'import {test,expect} from "vitest"; import {frames} from "./timing"; test("75 frames",()=>expect(frames()).toBe(75));\n',
		);
		git("add", ".");
		git("commit", "-qm", "behavioral red");
		const red = git("rev-parse", "HEAD");
		put("src/demo/timing.ts", "export function frames() { return 75; }\n");
		put(
			"artifacts/evidence.json",
			JSON.stringify({ issue: 83, redCommit: red, targetTest: "src/demo/timing.test.ts" }),
		);
		git("add", ".");
		git("commit", "-qm", "green");
		const head = git("rev-parse", "HEAD");
		symlinkSync(dependencies, join(root, "node_modules"), "dir");
		put(
			"approval.json",
			JSON.stringify({
				targetTest: "src/demo/timing.test.ts",
				evidenceFile: "artifacts/evidence.json",
			}),
		);
		const result = spawnSync(process.execPath, [runner], {
			cwd: root,
			encoding: "utf8",
			timeout: 120000,
			env: {
				...process.env,
				PR_HEAD: head,
				PR_BASE: base,
				PILOT_ISSUE: "83",
				APPROVAL_FILE: join(root, "approval.json"),
			},
		});
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.match(result.stdout, /Verified behavioral RED/);
		assert.match(result.stdout, /Verified identical targeted GREEN/);
		assert.equal(git("rev-parse", "HEAD"), head);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
