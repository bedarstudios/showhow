import { spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
mkdirSync(dir, { recursive: true });
let bytes = 0;
for (const name of ["static", "scroll", "motion"]) {
	const height = name === "scroll" ? 2160 : name === "motion" ? 120 : 1080;
	const lines = Array.from(
		{ length: Math.floor(height / 70) },
		(_, i) =>
			`<text x="80" y="${50 + i * 70}" font-family="Arial" font-size="28" fill="white">Showhow row ${i + 1} — 0123456789 ABC xyz Readable text</text>`,
	).join("");
	await sharp(
		Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="${height}"><rect width="100%" height="100%" fill="#182030"/>${lines}</svg>`,
		),
	)
		.png()
		.toFile(`${dir}${name}.png`);
	const videoInputs =
		name === "motion"
			? [
					"-f",
					"lavfi",
					"-i",
					"testsrc2=size=1920x1080:rate=60",
					"-loop",
					"1",
					"-framerate",
					"60",
					"-i",
					`${dir}${name}.png`,
				]
			: ["-loop", "1", "-framerate", "60", "-i", `${dir}${name}.png`];
	const filter =
		name === "motion"
			? ["-filter_complex", "[0:v][1:v]overlay=0:0[v]", "-map", "[v]", "-map", "2:a"]
			: name === "scroll"
				? ["-vf", "crop=1920:1080:0:t*200"]
				: [];
	const result = spawnSync(
		"ffmpeg",
		[
			"-v",
			"error",
			"-n",
			...videoInputs,
			"-f",
			"lavfi",
			"-i",
			"sine=frequency=880:sample_rate=48000",
			"-t",
			"3",
			...filter,
			"-c:v",
			"libx264",
			"-preset",
			"veryfast",
			"-crf",
			"20",
			"-pix_fmt",
			"yuv420p",
			"-c:a",
			"aac",
			"-b:a",
			"96k",
			"-movflags",
			"+faststart",
			`${dir}${name}.mp4`,
		],
		{ timeout: 60000, encoding: "utf8" },
	);
	if (result.status !== 0) throw new Error(result.stderr || String(result.error));
	bytes += statSync(`${dir}${name}.mp4`).size;
	if (bytes > 10_000_000) throw new Error("Fixture size budget exceeded");
}
console.log(JSON.stringify({ fixtures: 3, secondsEach: 3, bytes }));
