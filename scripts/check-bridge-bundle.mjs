#!/usr/bin/env node
/**
 * Regression check for the desktop bridge dev bundle.
 *
 * `npm run dev` builds the Electron main bundle via vite-plugin-electron's
 * watch/dev build. `ws` declares the native packages `bufferutil` and
 * `utf-8-validate` as optionalDependencies and wraps their `require()` in a
 * try/catch so it falls back to a pure-JS implementation when they are absent.
 *
 * Vite's optional-peer-dep handling rewrites that `require()` into a top-level
 * stub that THROWS `Could not resolve "bufferutil" imported by "ws"` in the dev
 * bundle. Because the stub is hoisted out of ws's try/catch, the throw crashes
 * the Electron main process at load under `npm run dev`.
 *
 * This script builds the dev bundle the same way `npm run dev` does and asserts
 * the bundle contains no such throwing stub. It is the minimal check that
 * proves the runtime packaging/configuration is correct; a unit test cannot
 * reach Vite's dev-bundle codegen.
 */
import { spawn } from "node:child_process";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist-electron");

async function buildDevBundle(timeoutMs) {
	await rm(DIST, { recursive: true, force: true });
	return new Promise((resolve, reject) => {
		const child = spawn("npm", ["run", "dev"], {
			cwd: ROOT,
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env },
		});
		let log = "";
		child.stdout.on("data", (d) => {
			log += d;
		});
		child.stderr.on("data", (d) => {
			log += d;
		});
		const timer = setTimeout(() => {
			child.kill("SIGTERM");
			setTimeout(() => {
				try {
					child.kill("SIGKILL");
				} catch {
					// Process already exited.
				}
			}, 3000);
		}, timeoutMs);
		child.on("exit", () => {
			clearTimeout(timer);
			resolve(log);
		});
		child.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

async function findWindowsBundle() {
	const files = await readdir(DIST);
	const candidate = files.find((f) => /^windows-.*\.js$/.test(f));
	if (!candidate) throw new Error(`No windows-*.js bundle found in ${DIST}`);
	return path.join(DIST, candidate);
}

async function main() {
	await buildDevBundle(30_000);
	const bundle = await findWindowsBundle();
	const code = await readFile(bundle, "utf-8");
	const failures = [];
	if (/Could not resolve "bufferutil" imported by "ws"/.test(code)) failures.push("bufferutil");
	if (/Could not resolve "utf-8-validate" imported by "ws"/.test(code))
		failures.push("utf-8-validate");
	if (failures.length) {
		console.error(
			`FAIL: dev main bundle throws on unresolved ws optional deps: ${failures.join(", ")}`,
		);
		console.error(`  bundle: ${bundle}`);
		process.exit(1);
	}
	console.log(
		`OK: dev main bundle (${path.basename(bundle)}) has no ws optional-dep throwing stub.`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
