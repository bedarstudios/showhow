import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listRecordings } from "./recordingLibrary";

async function makeTempRoot(): Promise<string> {
	return mkdtemp(path.join(os.tmpdir(), "showhow-lib-"));
}

describe("listRecordings", () => {
	it("returns [] when the recordings root does not exist", async () => {
		const root = path.join(os.tmpdir(), `showhow-nonexistent-${Date.now()}`);
		const entries = await listRecordings(root);
		expect(entries).toEqual([]);
	});

	it("returns [] when the recordings root is empty", async () => {
		const root = await makeTempRoot();
		const entries = await listRecordings(root);
		expect(entries).toEqual([]);
	});

	it("throws when the recordings root fails to read with a non-ENOENT error", async () => {
		const root = await makeTempRoot();
		const notADirectoryPath = path.join(root, "not-a-directory");
		await writeFile(notADirectoryPath, "plain file");
		await expect(listRecordings(notADirectoryPath)).rejects.toMatchObject({ code: "ENOTDIR" });
	});

	it("skips directories whose meta.json is missing", async () => {
		const root = await makeTempRoot();
		await mkdir(path.join(root, "no-meta-dir"));
		const entries = await listRecordings(root);
		expect(entries).toEqual([]);
	});

	it("skips directories whose meta.json is not valid JSON", async () => {
		const root = await makeTempRoot();
		const dir = path.join(root, "bad-json");
		await mkdir(dir);
		await writeFile(path.join(dir, "meta.json"), "{ broken JSON");
		const entries = await listRecordings(root);
		expect(entries).toEqual([]);
	});

	it("skips directories whose meta.json is missing required fields", async () => {
		const root = await makeTempRoot();
		const dir = path.join(root, "incomplete-meta");
		await mkdir(dir);
		await writeFile(
			path.join(dir, "meta.json"),
			JSON.stringify({ schemaVersion: 1, title: "No source or createdAt" }),
		);
		const entries = await listRecordings(root);
		expect(entries).toEqual([]);
	});

	it("returns a single valid desktop bundle", async () => {
		const root = await makeTempRoot();
		const dir = path.join(root, "2026-07-11_164207-recording");
		await mkdir(dir);
		const createdAt = new Date(2026, 6, 11, 16, 42, 7).getTime();
		await writeFile(
			path.join(dir, "meta.json"),
			JSON.stringify({
				schemaVersion: 1,
				title: "Recording 2026-07-11 16:42",
				source: "desktop",
				createdAt,
				durationMs: 72_000,
				video: "video.webm",
				transcript: "transcript.txt",
				steps: null,
			}),
		);
		const entries = await listRecordings(root);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toEqual({
			bundleDir: dir,
			title: "Recording 2026-07-11 16:42",
			source: "desktop",
			createdAt,
			durationMs: 72_000,
		});
	});

	it("omits durationMs when not present in meta.json", async () => {
		const root = await makeTempRoot();
		const dir = path.join(root, "2026-07-11_164207-recording");
		await mkdir(dir);
		const createdAt = new Date(2026, 6, 11, 16, 42, 7).getTime();
		await writeFile(
			path.join(dir, "meta.json"),
			JSON.stringify({
				schemaVersion: 1,
				title: "Recording 2026-07-11 16:42",
				source: "desktop",
				createdAt,
				video: "video.webm",
				transcript: "transcript.txt",
				steps: null,
			}),
		);
		const entries = await listRecordings(root);
		expect(entries).toHaveLength(1);
		expect(entries[0].durationMs).toBeUndefined();
	});

	it("returns a browser-source bundle", async () => {
		const root = await makeTempRoot();
		const dir = path.join(root, "2026-07-12_100000-recording");
		await mkdir(dir);
		const createdAt = new Date(2026, 6, 12, 10, 0, 0).getTime();
		await writeFile(
			path.join(dir, "meta.json"),
			JSON.stringify({
				schemaVersion: 1,
				title: "Browser recording",
				source: "browser",
				createdAt,
				video: "video.webm",
				transcript: "transcript.txt",
				steps: null,
			}),
		);
		const entries = await listRecordings(root);
		expect(entries).toHaveLength(1);
		expect(entries[0].source).toBe("browser");
	});

	it("sorts entries newest-first by createdAt", async () => {
		const root = await makeTempRoot();
		const timestamps = [
			new Date(2026, 6, 11, 10, 0, 0).getTime(),
			new Date(2026, 6, 13, 10, 0, 0).getTime(),
			new Date(2026, 6, 12, 10, 0, 0).getTime(),
		];
		for (const [i, createdAt] of timestamps.entries()) {
			const dir = path.join(root, `rec-${i}`);
			await mkdir(dir);
			await writeFile(
				path.join(dir, "meta.json"),
				JSON.stringify({
					schemaVersion: 1,
					title: `Recording ${i}`,
					source: "desktop",
					createdAt,
					video: "video.webm",
					transcript: "transcript.txt",
					steps: null,
				}),
			);
		}
		const entries = await listRecordings(root);
		expect(entries).toHaveLength(3);
		expect(entries[0].createdAt).toBe(timestamps[1]); // newest
		expect(entries[1].createdAt).toBe(timestamps[2]);
		expect(entries[2].createdAt).toBe(timestamps[0]); // oldest
	});

	it("skips plain files in the recordings root (only scans subdirectories)", async () => {
		const root = await makeTempRoot();
		await writeFile(path.join(root, "stray-file.json"), JSON.stringify({ schemaVersion: 1 }));
		const entries = await listRecordings(root);
		expect(entries).toEqual([]);
	});
});
