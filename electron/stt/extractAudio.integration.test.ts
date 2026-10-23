import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extractMono16kPcm } from "./extractAudio";

const exec = promisify(execFile);
const ffmpeg = (() => {
	try {
		const command = process.platform === "win32" ? "where" : "which";
		return execFileSync(command, ["ffmpeg"], { encoding: "utf8" }).trim().split(/\r?\n/)[0];
	} catch {
		return null;
	}
})();

let scratch = "";
let oneTrack = "";
let silentThenTone = "";
let toneThenSilent = "";
let bothTones = "";
let loudTones = "";
let noAudio = "";
const previousFfmpegPath = process.env.OPENSCREEN_FFMPEG_PATH;

describe.runIf(ffmpeg !== null)("extracting real multi-track media", () => {
	beforeAll(async () => {
		if (!ffmpeg) throw new Error("ffmpeg path was not resolved");
		process.env.OPENSCREEN_FFMPEG_PATH = ffmpeg;
		scratch = await mkdtemp(path.join(os.tmpdir(), "showhow-stt-extract-"));
		oneTrack = path.join(scratch, "one-track.m4a");
		silentThenTone = path.join(scratch, "silent-first-tone-second.m4a");
		toneThenSilent = path.join(scratch, "tone-first-silent-second.m4a");
		bothTones = path.join(scratch, "both-tones.m4a");
		loudTones = path.join(scratch, "loud-tones.m4a");
		noAudio = path.join(scratch, "no-audio.mp4");
		await createAudioFixture(oneTrack, ["sine=frequency=440:sample_rate=48000:duration=1"]);
		await createAudioFixture(silentThenTone, [
			"anullsrc=r=48000:cl=mono:d=1.5",
			"sine=frequency=440:sample_rate=48000:duration=0.5",
		]);
		await createAudioFixture(toneThenSilent, [
			"sine=frequency=440:sample_rate=48000:duration=0.5",
			"anullsrc=r=48000:cl=mono:d=1.5",
		]);
		await createAudioFixture(bothTones, [
			"sine=frequency=440:sample_rate=48000:duration=1.25",
			"sine=frequency=880:sample_rate=48000:duration=0.75",
		]);
		await createAudioFixture(loudTones, [
			"sine=frequency=440:sample_rate=48000:duration=0.75,volume=8",
			"sine=frequency=440:sample_rate=48000:duration=0.75,volume=8",
		]);
		await exec(ffmpeg, [
			"-hide_banner",
			"-loglevel",
			"error",
			"-y",
			"-f",
			"lavfi",
			"-i",
			"color=c=black:s=32x32:r=10:d=0.5",
			"-an",
			"-c:v",
			"mpeg4",
			noAudio,
		]);
	});

	afterAll(async () => {
		if (previousFfmpegPath === undefined) delete process.env.OPENSCREEN_FFMPEG_PATH;
		else process.env.OPENSCREEN_FFMPEG_PATH = previousFfmpegPath;
		if (scratch) await rm(scratch, { recursive: true, force: true });
	});

	it("extracts a one-track file as mono 16 kHz PCM", async () => {
		const samples = await extractMono16kPcm(oneTrack);
		expect(samples.length / 16_000).toBeGreaterThan(0.9);
		expect(rms(samples)).toBeGreaterThan(0.02);
	});

	it("keeps signal from a later track and the longest track duration", async () => {
		const samples = await extractMono16kPcm(silentThenTone);

		expect(rms(samples)).toBeGreaterThan(0.005);
		expect(samples.length / 16_000).toBeGreaterThan(1.4);
	});

	it("does not attenuate speech when the companion track is silent", async () => {
		const control = await extractMono16kPcm(oneTrack);
		const mixed = await extractMono16kPcm(silentThenTone);
		const controlLevel = rms(control.subarray(1_600, 6_400));
		const mixedLevel = rms(mixed.subarray(1_600, 6_400));

		expect(mixedLevel / controlLevel).toBeGreaterThan(0.8);
	});

	it("keeps signal from the first track when a later track is silent", async () => {
		const samples = await extractMono16kPcm(toneThenSilent);

		expect(rms(samples)).toBeGreaterThan(0.005);
		expect(samples.length / 16_000).toBeGreaterThan(1.4);
	});

	it("mixes both non-silent tracks and keeps the longer duration", async () => {
		const samples = await extractMono16kPcm(bothTones);

		expect(toneAmplitude(samples, 440)).toBeGreaterThan(0.01);
		expect(toneAmplitude(samples, 880)).toBeGreaterThan(0.01);
		expect(samples.length / 16_000).toBeGreaterThan(1.2);
	});

	it("keeps a multi-track peak below clipping", async () => {
		const samples = await extractMono16kPcm(loudTones);
		const peak = samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);

		expect(peak).toBeLessThanOrEqual(0.951);
	});

	it("keeps NoAudioTrackError for a file with no audio stream", async () => {
		await expect(extractMono16kPcm(noAudio)).rejects.toMatchObject({ name: "NoAudioTrackError" });
	});
});

async function createAudioFixture(filePath: string, sources: string[]): Promise<void> {
	const args = ["-hide_banner", "-loglevel", "error", "-y"];
	for (const source of sources) args.push("-f", "lavfi", "-i", source);
	for (let i = 0; i < sources.length; i++) args.push("-map", `${i}:a:0`);
	args.push("-c:a", "aac", filePath);
	if (!ffmpeg) throw new Error("ffmpeg path was not resolved");
	await exec(ffmpeg, args);
}

function rms(samples: Float32Array): number {
	return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
}

function toneAmplitude(samples: Float32Array, frequency: number): number {
	let real = 0;
	let imaginary = 0;
	for (let i = 0; i < samples.length; i++) {
		const phase = (2 * Math.PI * frequency * i) / 16_000;
		real += samples[i] * Math.cos(phase);
		imaginary += samples[i] * Math.sin(phase);
	}
	return (2 * Math.hypot(real, imaginary)) / samples.length;
}
