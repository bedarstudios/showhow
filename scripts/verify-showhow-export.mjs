import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
export function assertPrerequisites(facts) {
	if (
		facts.node !== "v22.22.1" ||
		facts.npm !== "10.9.4" ||
		facts.codex !== "codex-cli 0.160.0" ||
		facts.missing.length
	) {
		throw new Error(`prerequisite failure: ${JSON.stringify(facts)}`);
	}
}
export function launchAfterDoctor(facts, launch) {
	assertPrerequisites(facts);
	return launch();
}
export function reserveEvidence(directory) {
	fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
}
export function accepted(result) {
	return (
		!result.failure &&
		result.journey === true &&
		result.media?.valid === true &&
		result.cleanup?.processesGone === true &&
		result.cleanup?.rootGone === true &&
		Boolean(result.fixture?.before) &&
		result.fixture.before === result.fixture.after
	);
}
export function validateGif(bytes, probe, decode) {
	if (!/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii")) || bytes.length <= 1024)
		throw new Error("Invalid GIF bytes");
	const stream = probe.streams?.[0];
	const duration = Number(stream?.duration ?? probe.format?.duration);
	const frames = Number(stream?.nb_read_frames);
	if (!(stream?.width > 0 && stream?.height > 0 && frames >= 2 && duration >= 1 && duration <= 4))
		throw new Error("Invalid decoded media bounds");
	if (decode.status !== 0 || decode.error || decode.signal)
		throw new Error("Full FFmpeg decode failed");
	return {
		valid: true,
		width: stream.width,
		height: stream.height,
		frames,
		duration,
		size: bytes.length,
		decodeExit: decode.status,
	};
}

export function makeBootstrap(main, paths) {
	return `import { app } from "electron";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
const paths = ${JSON.stringify(paths)};
for (const [key, value] of Object.entries(paths)) app.setPath(key, value);
globalThis.__showhowVerificationRuntime = () => {
  const current = Object.fromEntries(Object.keys(paths).map(key => [key, app.getPath(key)]));
  const tmpdir = os.tmpdir();
  const locks = ["showhow-single-instance", "openscreen-single-instance"].map(prefix => {
    const lock = path.join(tmpdir, prefix + "-uid-" + process.getuid() + ".lock");
    return { path: lock, pid: Number(fs.readFileSync(path.join(lock, "pid"), "utf8")) };
  });
  return { paths: current, recordings: path.join(current.userData, "recordings"), tmpdir, locks, pid: process.pid };
};
await import(${JSON.stringify(pathToFileURL(main).href)});
`;
}

function inside(root, target) {
	const relative = path.relative(fs.realpathSync(root), fs.realpathSync(target));
	return (
		relative !== "" &&
		!relative.startsWith(`..${path.sep}`) &&
		relative !== ".." &&
		!path.isAbsolute(relative)
	);
}

function checked(command, args) {
	const result = spawnSync(command, args, {
		encoding: "utf8",
		timeout: 30_000,
		maxBuffer: 8 * 1024 * 1024,
	});
	if (result.error || result.status !== 0)
		throw new Error(
			`${command} ${args.join(" ")} failed (${result.status}): ${result.error?.message ?? result.stderr}`,
		);
	return result.stdout.trim();
}

function resolvedTool(name) {
	for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
		const candidate = path.join(directory, name);
		try {
			fs.accessSync(candidate, fs.constants.X_OK);
			return candidate;
		} catch {
			/* Try the next PATH entry. */
		}
	}
	return null;
}

function doctor(root) {
	const missing = [];
	const tools = {};
	for (const name of ["npm", "codex", "ffmpeg", "ffprobe", "ps"]) {
		const executable = resolvedTool(name);
		if (!executable) missing.push(name);
		else
			tools[name] = {
				path: executable,
				version:
					name === "ps"
						? "system process table"
						: checked(executable, [name.startsWith("ff") ? "-version" : "--version"]).split(
								"\n",
							)[0],
			};
	}
	let electronBinary;
	let playwright;
	try {
		electronBinary = require("electron");
	} catch {
		missing.push("electron dependency");
	}
	try {
		playwright = require.resolve("playwright");
	} catch {
		missing.push("playwright dependency");
	}
	for (const file of [
		"dist-electron/main.js",
		"dist-electron/preload.mjs",
		"dist/index.html",
		"tests/fixtures/sample.webm",
	]) {
		try {
			fs.accessSync(path.join(root, file), fs.constants.R_OK);
		} catch {
			missing.push(file);
		}
	}
	if (electronBinary) {
		try {
			fs.accessSync(electronBinary, fs.constants.X_OK);
		} catch {
			missing.push("Electron binary");
		}
	}
	const facts = {
		node: process.version,
		npm: tools.npm?.version,
		codex: tools.codex?.version,
		missing,
	};
	assertPrerequisites(facts);
	const repository = checked("git", ["-C", root, "rev-parse", "--show-toplevel"]);
	if (
		fs.realpathSync(repository) !== root ||
		JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).name !== "showhow"
	)
		throw new Error("Unexpected repository identity");
	return {
		facts,
		tools,
		electronBinary,
		playwright,
		nodePath: process.execPath,
		electronVersion: require("electron/package.json").version,
		playwrightVersion: require("playwright/package.json").version,
	};
}

function sha256(file) {
	return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// Record PID birth times as well as ancestry. Never signal a PID after it has been reused.
function processes() {
	return checked("ps", ["-axo", "pid=,ppid=,lstart=,command="])
		.split("\n")
		.flatMap((line) => {
			const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(.*)$/);
			return match
				? [{ pid: Number(match[1]), ppid: Number(match[2]), birth: match[3], command: match[4] }]
				: [];
		});
}
function signalOwned(pid, signal) {
	try {
		process.kill(pid, signal);
	} catch (error) {
		if (error.code !== "ESRCH") throw error;
	}
}
function sameProcess(record, current) {
	return current?.pid === record.pid && current?.birth === record.birth;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitUntil(probe, timeout, label) {
	const deadline = Date.now() + timeout;
	do {
		if (await probe()) return;
		await pause(100);
	} while (Date.now() < deadline);
	throw new Error(`Timeout waiting for ${label}`);
}
async function bounded(action, timeout) {
	let timer;
	try {
		return await Promise.race([
			action(),
			new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error("Bounded operation timed out")), timeout);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

export async function runVerification(evidenceDirectory) {
	const root = fs.realpathSync(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
	const evidence = path.resolve(evidenceDirectory);
	const evidenceParent = fs.realpathSync(path.dirname(evidence));
	const evidenceRoot = fs.realpathSync(path.join(root, "artifacts/verification-recipe"));
	if (evidenceParent !== evidenceRoot && !inside(evidenceRoot, evidenceParent))
		throw new Error("Evidence directory must be inside lane artifacts/verification-recipe");
	// Reserving atomically is the only evidence mutation before doctor; collisions preserve earlier proof.
	reserveEvidence(evidence);
	const result = {
		schemaVersion: 1,
		started: new Date().toISOString(),
		platform: process.platform,
		saveDialogOverride: "pick-export-save-path only; production write-export-to-path untouched",
		harness:
			process.env.SHOWHOW_VERIFY_HARNESS ?? "shell (not asserted to be a Codex role profile)",
		roleShell: {
			role: process.env.BEDAR_TICKET_ROLE ?? null,
			zdotdir: process.env.ZDOTDIR ?? null,
			nativeCodexProfileLaunched: false,
		},
		assertions: [],
		fixture: {},
		cleanup: { processesGone: true, rootGone: true },
		journey: false,
	};
	let stage = "doctor";
	let app;
	let runRoot;
	let tracker;
	let bootstrap;
	let prereq;
	let trackingFailure;
	let editor;
	let stopped = false;
	const stop = () => {
		stopped = true;
		if (app) app.close().catch(() => undefined);
	};
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	const owned = new Map();
	const logs = [];
	const assertObserved = (label) => result.assertions.push({ status: "passed", label });
	function track() {
		try {
			const table = processes();
			// During launch failure, recover only the unique bootstrap child created by this invocation.
			for (const item of table) {
				if (
					bootstrap &&
					item.command.includes(bootstrap) &&
					item.command.includes(prereq.electronBinary)
				)
					owned.set(item.pid, item);
			}
			let changed;
			do {
				changed = false;
				for (const item of table) {
					const parent = owned.get(item.ppid);
					if (
						!owned.has(item.pid) &&
						parent &&
						sameProcess(
							parent,
							table.find((p) => p.pid === parent.pid),
						)
					) {
						owned.set(item.pid, item);
						changed = true;
					}
				}
			} while (changed);
		} catch (error) {
			trackingFailure = error.message;
		}
	}
	try {
		prereq = doctor(root);
		result.doctor = prereq;
		result.source = {
			sha: checked("git", ["-C", root, "rev-parse", "HEAD"]),
			dirty: checked("git", ["-C", root, "status", "--porcelain"]),
			files: Object.fromEntries(
				[
					"scripts/verify-showhow-export.mjs",
					"scripts/verify-showhow-export.node-test.mjs",
					"package.json",
				].map((file) => [file, sha256(path.join(root, file))]),
			),
		};
		const fixture = path.join(root, "tests/fixtures/sample.webm");
		if (
			checked("git", ["-C", root, "hash-object", "tests/fixtures/sample.webm"]) !==
			checked("git", ["-C", root, "rev-parse", "HEAD:tests/fixtures/sample.webm"])
		)
			throw new Error("Source fixture differs from committed synthetic fixture");
		result.fixture.before = sha256(fixture);
		result.fixture.bytes = fs.statSync(fixture).size;
		assertObserved("All prerequisites resolved before Electron launch");
		if (process.platform !== "darwin")
			throw new Error("This native recipe currently requires macOS");
		stage = "launch";
		runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "showhow-verify-"));
		fs.chmodSync(runRoot, 0o700);
		const paths = Object.fromEntries(
			["appData", "userData", "sessionData", "downloads", "temp", "logs", "crashDumps"].map(
				(key) => [key, path.join(runRoot, key)],
			),
		);
		for (const directory of Object.values(paths)) fs.mkdirSync(directory, { mode: 0o700 });
		bootstrap = path.join(runRoot, "isolated-bootstrap.mjs");
		fs.writeFileSync(bootstrap, makeBootstrap(path.join(root, "dist-electron/main.js"), paths));
		const env = {
			...process.env,
			TMPDIR: paths.temp,
			TMP: paths.temp,
			TEMP: paths.temp,
			HEADLESS: "false",
		};
		delete env.ELECTRON_RUN_AS_NODE;
		delete env.VITE_DEV_SERVER_URL;
		tracker = setInterval(track, 100);
		const { _electron } = await import("playwright");
		app = await launchAfterDoctor(prereq.facts, () =>
			_electron.launch({
				executablePath: prereq.electronBinary,
				args: [bootstrap, "--enable-unsafe-swiftshader"],
				cwd: root,
				env,
				timeout: 30_000,
			}),
		);
		if (stopped) throw new Error("Attempt stopped by signal");
		track();
		const child = app.process();
		const identity = processes().find((item) => item.pid === child.pid);
		if (!identity) throw new Error("Owned Electron child not present in process table");
		owned.set(identity.pid, identity);
		result.electronPid = child.pid;
		for (const stream of [child.stdout, child.stderr])
			stream?.on("data", (chunk) => {
				if (logs.join("").length < 128_000) logs.push(chunk.toString());
			});
		const hud = await app.firstWindow({ timeout: 30_000 });
		hud.setDefaultTimeout(15_000);
		await hud.waitForLoadState("domcontentloaded", { timeout: 30_000 });
		stage = "isolation";
		const runtime = await app.evaluate(() => globalThis.__showhowVerificationRuntime());
		for (const target of [
			...Object.values(runtime.paths),
			runtime.recordings,
			runtime.tmpdir,
			...runtime.locks.map((lock) => lock.path),
		]) {
			if (!inside(runRoot, target)) throw new Error(`Non-isolated runtime path: ${target}`);
		}
		if (
			runtime.paths.userData !== path.join(paths.appData, "Showhow") ||
			runtime.locks.some((lock) => lock.pid !== child.pid) ||
			runtime.pid !== child.pid
		)
			throw new Error("Unexpected production profile or lock owner");
		result.runtime = runtime;
		assertObserved(
			"Actual runtime profile, recordings, temp and both stable locks are contained; lock PIDs equal child PID",
		);
		stage = "editor";
		const clip = path.join(runtime.recordings, "verification-synthetic.webm");
		fs.copyFileSync(fixture, clip, fs.constants.COPYFILE_EXCL);
		if (sha256(clip) !== result.fixture.before) throw new Error("Synthetic clip copy mismatch");
		const response = await hud.evaluate(
			(video) => window.electronAPI.setCurrentVideoPath(video),
			clip,
		);
		if (!response.success)
			throw new Error(`Production fixture IPC rejected: ${JSON.stringify(response)}`);
		const editorEvent = app.waitForEvent("window", { timeout: 30_000 });
		// Keep a rejection handler attached while switch IPC closes the HUD.
		editorEvent.catch(() => undefined);
		try {
			await hud.evaluate(() => window.electronAPI.switchToEditor());
		} catch (error) {
			if (!hud.isClosed() || !/closed|destroyed/i.test(error.message)) throw error;
		}
		editor = await editorEvent;
		editor.on("console", (message) => {
			if (["error", "warning"].includes(message.type()))
				logs.push(`Renderer ${message.type()}: ${message.text()}\n`);
		});
		editor.on("pageerror", (error) => logs.push(`Renderer pageerror: ${error.message}\n`));
		editor.setDefaultTimeout(15_000);
		await editor.waitForLoadState("domcontentloaded", { timeout: 30_000 });
		if (!editor.url().includes("windowType=editor")) throw new Error("Unexpected editor window");
		result.initialCodecs = await editor.evaluate(() => ({
			videoDecoder: typeof VideoDecoder,
			videoEncoder: typeof VideoEncoder,
			secureContext: window.isSecureContext,
			url: document.URL,
		}));
		// Existing GIF e2e requires an editor reload: initial file load may lack WebCodecs.
		await editor.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
		await editor.waitForFunction(
			() => typeof VideoDecoder === "function" && typeof VideoEncoder === "function",
			null,
			{ timeout: 15_000 },
		);
		result.exportCodecs = await editor.evaluate(() => ({
			videoDecoder: typeof VideoDecoder,
			videoEncoder: typeof VideoEncoder,
			secureContext: window.isSecureContext,
			url: document.URL,
		}));
		assertObserved("Editor reload exposed actual WebCodecs decoder and encoder before export");
		await editor.waitForFunction(
			() =>
				[...document.querySelectorAll("video")].some(
					(video) =>
						video.readyState >= 2 &&
						Number.isFinite(video.duration) &&
						video.duration >= 1 &&
						video.duration <= 4,
				),
			null,
			{ timeout: 30_000 },
		);
		await editor.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
		result.video = await editor.evaluate(() =>
			[...document.querySelectorAll("video")]
				.filter((video) => video.readyState >= 2)
				.map((video) => ({
					duration: video.duration,
					width: video.videoWidth,
					height: video.videoHeight,
				})),
		);
		await editor.screenshot({ path: path.join(evidence, "editor.png") });
		assertObserved("Production IPC loaded synthetic video with finite duration and visible canvas");
		stage = "export";
		const output = path.join(paths.downloads, "verification-export.gif");
		await app.evaluate(({ ipcMain }, target) => {
			// The ONLY replaced handler: the production filesystem writer is never removed or wrapped.
			globalThis.__showhowPickerCalls = 0;
			ipcMain.removeHandler("pick-export-save-path");
			ipcMain.handle("pick-export-save-path", () => {
				globalThis.__showhowPickerCalls++;
				return { success: true, path: target, canceled: false };
			});
		}, output);
		await editor.getByTestId("testId-export-panel-button").click();
		await editor.getByTestId("testId-gif-format-button").click();
		// Production finally closes ExportDialog; the success toast is its completed UI.
		const completedUI = editor
			.getByText("GIF exported successfully", { exact: true })
			.waitFor({ state: "visible", timeout: 120_000 });
		completedUI.catch(() => undefined);
		await editor.getByTestId("testId-export-button").click();
		await Promise.all([
			completedUI,
			waitUntil(
				() => fs.existsSync(output) && fs.statSync(output).size > 1024,
				120_000,
				"production filesystem export",
			),
		]);
		result.completionUI = "GIF exported successfully";
		await editor.screenshot({
			path: path.join(evidence, "complete.png"),
			animations: "disabled",
			style:
				"[data-sonner-toast] { transition: none !important; } [data-description] { visibility: hidden !important; }",
			mask: [editor.locator("[data-description]")],
		});
		assertObserved("Renderer completed GIF export and production writer created real file");
		stage = "decode";
		const probe = JSON.parse(
			checked(prereq.tools.ffprobe.path, [
				"-v",
				"error",
				"-count_frames",
				"-select_streams",
				"v:0",
				"-show_entries",
				"stream=width,height,nb_read_frames,duration:format=duration",
				"-of",
				"json",
				output,
			]),
		);
		const decode = spawnSync(
			prereq.tools.ffmpeg.path,
			["-v", "error", "-xerror", "-i", output, "-f", "null", "-"],
			{ encoding: "utf8", timeout: 30_000, maxBuffer: 1024 * 1024 },
		);
		result.probe = probe;
		result.decode = {
			command: [
				prereq.tools.ffmpeg.path,
				"-v",
				"error",
				"-xerror",
				"-i",
				output,
				"-f",
				"null",
				"-",
			],
			exit: decode.status,
			stdout: decode.stdout,
			stderr: decode.stderr,
			signal: decode.signal,
			error: decode.error?.message ?? null,
		};
		result.media = validateGif(fs.readFileSync(output), probe, decode);
		result.media.sha256 = sha256(output);
		fs.copyFileSync(output, path.join(evidence, "export.gif"), fs.constants.COPYFILE_EXCL);
		result.journey = true;
		assertObserved("Independent ffprobe bounds and full FFmpeg decode passed");
	} catch (error) {
		if (editor && !editor.isClosed()) {
			try {
				result.diagnostics = {
					pickerCalls: await app.evaluate(() => globalThis.__showhowPickerCalls),
					renderer: await editor.evaluate(() => ({
						videoDecoder: typeof VideoDecoder,
						videoEncoder: typeof VideoEncoder,
						text: document.body.innerText.slice(-12000),
					})),
				};
				await editor.screenshot({ path: path.join(evidence, "failure.png"), timeout: 5000 });
			} catch (diagnosticError) {
				result.diagnosticFailure = diagnosticError.message;
			}
		}
		result.failure = { stage, message: error.message };
		result.assertions.push({ status: "failed", label: `${stage}: ${error.message}` });
	} finally {
		stage = "cleanup";
		if (runRoot) {
			track();
			try {
				if (app)
					await bounded(() => app.close(), 5000).catch((error) =>
						logs.push(`Close: ${error.message}\n`),
					);
				const live = () => {
					track();
					const table = processes();
					return [...owned.values()].filter((item) =>
						sameProcess(
							item,
							table.find((candidate) => candidate.pid === item.pid),
						),
					);
				};
				for (const signal of ["SIGTERM", "SIGKILL"]) {
					if (!live().length) break;
					for (const item of live()) signalOwned(item.pid, signal);
					await waitUntil(
						() => live().length === 0,
						5000,
						`owned process cleanup after ${signal}`,
					).catch(() => undefined);
				}
				const survivors = live();
				const unexplained = processes().filter(
					(item) => item.command.includes(runRoot) && !owned.has(item.pid),
				);
				result.cleanup = {
					owned: [...owned.values()].map(({ pid, ppid, birth }) => ({ pid, ppid, birth })),
					survivingPids: survivors.map((item) => item.pid),
					unexplainedPids: unexplained.map((item) => item.pid),
					processesGone: survivors.length === 0 && unexplained.length === 0 && !trackingFailure,
					trackingFailure: trackingFailure ?? null,
					rootGone: false,
				};
				if (result.cleanup.processesGone) fs.rmSync(runRoot, { recursive: true, force: false });
				result.cleanup.rootGone = !fs.existsSync(runRoot);
			} catch (error) {
				result.cleanup = {
					...result.cleanup,
					processesGone: false,
					rootGone: false,
					error: error.message,
				};
			}
		}
		clearInterval(tracker);
		process.removeListener("SIGINT", stop);
		process.removeListener("SIGTERM", stop);
		try {
			result.fixture.after = sha256(path.join(root, "tests/fixtures/sample.webm"));
		} catch (error) {
			result.fixture.error = error.message;
		}
		if (result.fixture.before === result.fixture.after && result.fixture.before)
			assertObserved("Committed synthetic fixture hash unchanged");
		else if (result.fixture.before)
			result.assertions.push({
				status: "failed",
				label: "Committed synthetic fixture hash changed",
			});
		if (result.cleanup.processesGone && result.cleanup.rootGone)
			assertObserved("All observed owned processes gone and private run root removed");
		else result.assertions.push({ status: "failed", label: "Owned cleanup incomplete" });
		result.success = accepted(result);
		result.finished = new Date().toISOString();
		const sanitize = (value) => {
			let text = value;
			for (const [from, to] of [
				[runRoot, "<run>"],
				[root, "<repo>"],
				[os.homedir(), "<home>"],
			])
				if (from) text = text.split(from).join(to);
			return text;
		};
		fs.writeFileSync(
			path.join(evidence, "result.json"),
			`${sanitize(JSON.stringify(result, null, 2))}\n`,
			{ flag: "wx" },
		);
		fs.writeFileSync(path.join(evidence, "electron.log"), sanitize(logs.join("")), { flag: "wx" });
	}
	return result.success ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	if (args.length !== 2 || args[0] !== "--evidence-dir") {
		console.error("Usage: npm run verify:export -- --evidence-dir <new-directory>");
		process.exitCode = 2;
	} else {
		try {
			process.exitCode = await runVerification(args[1]);
		} catch (error) {
			console.error(error.message);
			process.exitCode = 1;
		}
	}
}
