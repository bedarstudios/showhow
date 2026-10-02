import assert from "node:assert/strict";
import { test } from "node:test";
import { launchAfterDoctor } from "./verify-showhow-export.mjs";

const good = { node: "v22.22.1", npm: "10.9.4", codex: "codex-cli 0.160.0", missing: [] };
test("missing tools, build, fixture or dependencies fail before launch", () => {
	for (const missing of [
		"ffmpeg",
		"dist-electron/main.js",
		"tests/fixtures/sample.webm",
		"playwright",
	]) {
		let launches = 0;
		assert.throws(
			() => launchAfterDoctor({ ...good, missing: [missing] }, () => launches++),
			/prerequisite/,
		);
		assert.equal(launches, 0);
	}
});

test("an existing evidence directory is rejected without touching its bytes", async () => {
	const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const { reserveEvidence } = await import("./verify-showhow-export.mjs");
	const dir = mkdtempSync(join(tmpdir(), "showhow-evidence-test-"));
	try {
		writeFileSync(join(dir, "result.json"), "original proof");
		assert.throws(() => reserveEvidence(dir), /exist/i);
		assert.equal(readFileSync(join(dir, "result.json"), "utf8"), "original proof");
	} finally {
		rmSync(dir, { recursive: true });
	}
});

test("successful media cannot mask cleanup failure or fixture mutation", async () => {
	const { accepted } = await import("./verify-showhow-export.mjs");
	const result = {
		media: { valid: true },
		journey: true,
		cleanup: { processesGone: true, rootGone: true },
		fixture: { before: "abc", after: "abc" },
	};
	assert.equal(accepted(result), true);
	assert.equal(accepted({ ...result, cleanup: { processesGone: false, rootGone: true } }), false);
	assert.equal(accepted({ ...result, cleanup: { processesGone: true, rootGone: false } }), false);
	assert.equal(accepted({ ...result, fixture: { before: "abc", after: "changed" } }), false);
});

const validProbe = {
	streams: [{ width: 640, height: 480, nb_read_frames: "60", duration: "2.0" }],
	format: { duration: "2.0" },
};
test("a corrupt GIF or incomplete independent decoder cannot establish export proof", async () => {
	const { validateGif } = await import("./verify-showhow-export.mjs");
	assert.throws(() => validateGif(Buffer.alloc(2048), validProbe, { status: 0 }), /GIF/);
});

test("full FFmpeg decode failure rejects a GIF with plausible signature and probe", async () => {
	const { validateGif } = await import("./verify-showhow-export.mjs");
	const bytes = Buffer.alloc(2048);
	bytes.write("GIF89a");
	assert.throws(
		() => validateGif(bytes, validProbe, { status: 1, stderr: "decoder error" }),
		/decode/,
	);
});

test("exact engine and Codex pins reject substitutions", () => {
	for (const [key, value] of [
		["node", "v24.14.0"],
		["npm", "11.9.0"],
		["codex", "codex-cli 0.159.0"],
	]) {
		assert.throws(
			() => launchAfterDoctor({ ...good, [key]: value }, () => undefined),
			/prerequisite/,
		);
	}
});

test("probe frame, dimension and duration bounds reject implausible media", async () => {
	const { validateGif } = await import("./verify-showhow-export.mjs");
	const bytes = Buffer.alloc(2048);
	bytes.write("GIF89a");
	for (const stream of [
		{ width: 0 },
		{ height: 0 },
		{ nb_read_frames: "1" },
		{ duration: "0.5" },
		{ duration: "5" },
	]) {
		assert.throws(
			() =>
				validateGif(bytes, { streams: [{ ...validProbe.streams[0], ...stream }] }, { status: 0 }),
			/bounds/,
		);
	}
	assert.equal(validateGif(bytes, validProbe, { status: 0 }).valid, true);
});

test("supporting bootstrap ordering sets private paths before production import", async () => {
	const { makeBootstrap } = await import("./verify-showhow-export.mjs");
	const source = makeBootstrap("/synthetic/main.js", {
		appData: "/synthetic/private/appData",
		temp: "/synthetic/private/temp",
	});
	assert.ok(source.indexOf("app.setPath") < source.indexOf("await import("));
	assert.ok(source.includes("file:///synthetic/main.js"));
	// Real native results, rather than this string check, must prove isolation.
});

test("real CLI doctor with missing tool PATH retains failure and never launches Electron", async () => {
	const fs = await import("node:fs");
	const path = await import("node:path");
	const { fileURLToPath } = await import("node:url");
	const { spawnSync } = await import("node:child_process");
	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	const parent = fs.mkdtempSync(path.join(root, "artifacts/verification-recipe/doctor-test-"));
	try {
		const bins = path.join(parent, "bins");
		fs.mkdirSync(bins);
		for (const name of ["node", "npm", "codex"]) {
			const executable =
				name === "node"
					? process.execPath
					: process.env.PATH.split(path.delimiter)
							.map((entry) => path.join(entry, name))
							.find((entry) => fs.existsSync(entry));
			assert.ok(executable, `${name} exists in test setup`);
			fs.symlinkSync(executable, path.join(bins, name));
		}
		const evidence = path.join(parent, "failure");
		const outcome = spawnSync(
			process.execPath,
			[path.join(root, "scripts/verify-showhow-export.mjs"), "--evidence-dir", evidence],
			{ env: { ...process.env, PATH: bins }, encoding: "utf8", timeout: 15000 },
		);
		assert.equal(outcome.status, 1, outcome.stderr);
		const result = JSON.parse(fs.readFileSync(path.join(evidence, "result.json"), "utf8"));
		assert.equal(result.failure.stage, "doctor");
		assert.match(result.failure.message, /ffmpeg/);
		assert.equal(result.electronPid, undefined);
		assert.equal(result.journey, false);
	} finally {
		fs.rmSync(parent, { recursive: true });
	}
});
