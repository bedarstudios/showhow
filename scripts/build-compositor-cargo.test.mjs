import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { resolveRustTool, windowsCargoBuildCommand } from "./rustToolchain.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MACOS_BUILD_SCRIPT = path.join(ROOT, "scripts", "build-macos-compositor-addon.mjs");
const scratchRoot = process.env.TEST_SCRATCH_ROOT || tmpdir();
const cargoFilename = process.platform === "win32" ? "cargo.exe" : "cargo";
const roots = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function newScratchRoot() {
	const root = mkdtempSync(path.join(scratchRoot, "showhow-rust-toolchain-"));
	roots.push(root);
	return root;
}

function writeFakeTool(file) {
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, "");
	if (process.platform !== "win32") chmodSync(file, 0o755);
	return file;
}

function runMacosBuild({ pathCargo, fallbackCargo, relativePath = false }) {
	const root = newScratchRoot();
	const bin = path.join(root, "bin");
	const home = path.join(root, "home");
	const sdk = path.join(root, "sdk");
	const cargoDir = path.join(home, ".cargo", "bin");
	const platformOverride = path.join(root, "darwin-platform.mjs");
	mkdirSync(bin, { recursive: true });
	mkdirSync(path.join(sdk, "include"), { recursive: true });
	mkdirSync(home, { recursive: true });
	writeFileSync(
		platformOverride,
		'Object.defineProperty(process, "platform", { value: "darwin" });',
	);

	const writeFakeCargo = (cargoPath, marker) => {
		mkdirSync(path.dirname(cargoPath), { recursive: true });
		writeFileSync(cargoPath, `#!/bin/sh\nprintf '%s\\n' '${marker}'\nexit 73\n`);
		chmodSync(cargoPath, 0o755);
	};
	if (pathCargo) writeFakeCargo(path.join(bin, "cargo"), "PATH_CARGO_REACHED");
	if (fallbackCargo) writeFakeCargo(path.join(cargoDir, "cargo"), "FALLBACK_CARGO_REACHED");

	return spawnSync(process.execPath, ["--import", platformOverride, MACOS_BUILD_SCRIPT], {
		cwd: ROOT,
		encoding: "utf8",
		env: {
			HOME: home,
			MAC_FFMPEG_DIR: sdk,
			PATH: relativePath ? path.relative(ROOT, bin) : bin,
		},
	});
}

describe("macOS compositor cargo resolution", () => {
	it.skipIf(process.platform === "win32")(
		"runs PATH cargo after changing cwd when PATH contains a relative directory",
		() => {
			const result = runMacosBuild({
				pathCargo: true,
				fallbackCargo: false,
				relativePath: true,
			});

			expect(result.stdout).toContain("PATH_CARGO_REACHED");
			expect(result.stderr).toContain("exited with 73");
		},
	);

	it.skipIf(process.platform === "win32")(
		"prefers cargo on PATH when ~/.cargo/bin/cargo also exists",
		() => {
			const result = runMacosBuild({ pathCargo: true, fallbackCargo: true });

			expect(result.stdout).toContain("PATH_CARGO_REACHED");
			expect(result.stdout).not.toContain("FALLBACK_CARGO_REACHED");
			expect(result.stderr).toContain("exited with 73");
		},
	);

	it.skipIf(process.platform === "win32")(
		"keeps install-Rust guidance when cargo is missing",
		() => {
			const result = runMacosBuild({ pathCargo: false, fallbackCargo: false });

			expect(result.stderr).toContain("cargo not found on PATH");
			expect(result.stderr).toContain("Install Rust (https://rustup.rs) first.");
		},
	);
});

describe("Rust toolchain resolution", () => {
	it("prefers cargo on PATH over the standard install", () => {
		const root = newScratchRoot();
		const home = path.join(root, "home");
		const bin = path.join(root, "path");
		const pathCargo = writeFakeTool(path.join(bin, cargoFilename));
		writeFakeTool(path.join(home, ".cargo", "bin", cargoFilename));

		expect(resolveRustTool("cargo", { PATH: bin }, home)).toBe(pathCargo);
	});

	it("uses cargo from PATH when there is no fallback install", () => {
		const root = newScratchRoot();
		const home = path.join(root, "home");
		const bin = path.join(root, "path");
		const cargo = writeFakeTool(path.join(bin, cargoFilename));

		expect(resolveRustTool("cargo", { PATH: bin }, home)).toBe(cargo);
	});

	it("falls back to ~/.cargo/bin/cargo when PATH has no cargo", () => {
		const root = newScratchRoot();
		const home = path.join(root, "home");
		const cargo = writeFakeTool(path.join(home, ".cargo", "bin", cargoFilename));

		expect(resolveRustTool("cargo", { PATH: root }, home)).toBe(cargo);
	});

	it("returns no tool when PATH and the fallback are empty", () => {
		const root = newScratchRoot();

		expect(resolveRustTool("cargo", { PATH: root }, path.join(root, "home"))).toBeUndefined();
	});

	it("quotes the resolved Windows cargo path with spaces in the batch command", () => {
		const cargo = "C:\\Users\\100% Ready\\Rust Toolchain\\bin\\cargo.exe";

		expect(windowsCargoBuildCommand(cargo)).toBe(
			'"C:\\Users\\100%% Ready\\Rust Toolchain\\bin\\cargo.exe" ' +
				"build -p compositor-view-napi --release",
		);
	});
});
