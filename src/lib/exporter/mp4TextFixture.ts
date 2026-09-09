import { BufferTarget, CanvasSource, Mp4OutputFormat, Output } from "mediabunny";

// Native 4K glyphs: 24px text stays 24px, never an upscaled 1080p source.
export const TEXT_WIDTH = 3840;
export const TEXT_HEIGHT = 2160;
const ALPHABET = "0123456789ABCDEFGHJKM";
const SCALE = 0.992; // FrameRenderer's padding=2: 1 - 2/100 * 0.4.
const OFFSET_X = (TEXT_WIDTH * (1 - SCALE)) / 2;
const OFFSET_Y = (TEXT_HEIGHT * (1 - SCALE)) / 2;

export function textCanvas() {
	const canvas = document.createElement("canvas");
	canvas.width = TEXT_WIDTH;
	canvas.height = TEXT_HEIGHT;
	return canvas;
}

export function drawTextFixture(canvas: HTMLCanvasElement, frame: number) {
	const context = canvas.getContext("2d")!;
	context.fillStyle = "#141414";
	context.fillRect(0, 0, TEXT_WIDTH, TEXT_HEIGHT);
	// Dense native-size text across the frame, with scrolling and moving panels.
	context.font = "24px monospace";
	context.textBaseline = "top";
	context.fillStyle = "#eeeeee";
	for (let row = 0; row < 45; row++) {
		for (let column = 0; column < 100; column++) {
			context.fillText(ALPHABET[column % ALPHABET.length], 64 + column * 32 + frame, 64 + row * 40);
		}
	}
	for (let i = 0; i < 20; i++) {
		context.fillStyle = `hsl(${i * 18 + frame * 3} 75% 50%)`;
		context.fillRect((i * 200 + frame * 15) % TEXT_WIDTH, 1900, 160, 180);
	}
}

export async function createNativeTextVideo() {
	const canvas = textCanvas();
	const target = new BufferTarget();
	const output = new Output({ target, format: new Mp4OutputFormat() });
	const source = new CanvasSource(canvas, {
		codec: "avc",
		bitrate: 80_000_000,
		latencyMode: "quality",
		bitrateMode: "variable",
	});
	output.addVideoTrack(source, { frameRate: 60 });
	await output.start();
	for (let frame = 0; frame < 60; frame++) {
		drawTextFixture(canvas, frame);
		await source.add(frame / 60, 1 / 60);
	}
	await output.finalize();
	canvas.width = canvas.height = 1;
	const blob = new Blob([target.buffer!], { type: "video/mp4" });
	if (blob.size >= 5_000_000) throw new Error("4K fixture exceeds 5MB budget");
	return blob;
}

function glyphRectangle(column: number, row: number, frame: number) {
	const x = Math.round(OFFSET_X + (64 + column * 32 + frame) * SCALE);
	const y = Math.round(OFFSET_Y + (64 + row * 40) * SCALE);
	return { x, y, width: 24, height: 30 };
}

function pixels(canvas: HTMLCanvasElement, column: number, row: number, frame: number) {
	const { x, y, width, height } = glyphRectangle(column, row, frame);
	if (x < 0 || y < 0 || x + width > canvas.width || y + height > canvas.height) {
		throw new Error("Glyph cell lies outside the reference frame");
	}
	const data = canvas.getContext("2d")!.getImageData(x, y, width, height).data;
	return Array.from({ length: data.length / 4 }, (_, index) => data[index * 4]);
}

function contrast(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length * 0.95)] - sorted[Math.floor(sorted.length * 0.1)];
}

export function textCrop(canvas: HTMLCanvasElement, frame: number) {
	const crop = document.createElement("canvas");
	// Include the 21 complete scaled cells, not the start of the next repeat.
	crop.width = Math.ceil(ALPHABET.length * 32 * SCALE);
	crop.height = 80;
	for (const [index, row] of [0, 30].entries()) {
		crop
			.getContext("2d")!
			.drawImage(
				canvas,
				OFFSET_X + (64 + frame) * SCALE,
				OFFSET_Y + (64 + row * 40) * SCALE,
				crop.width,
				36,
				0,
				index * 40,
				crop.width,
				36,
			);
	}
	const result = crop.toDataURL("image/png").split(",")[1];
	crop.width = crop.height = 1;
	return result;
}

export function renderTextReference(frame: number) {
	const source = textCanvas();
	drawTextFixture(source, frame);
	const expected = textCanvas();
	const context = expected.getContext("2d")!;
	context.fillStyle = "#141414";
	context.fillRect(0, 0, TEXT_WIDTH, TEXT_HEIGHT);
	context.drawImage(source, OFFSET_X, OFFSET_Y, TEXT_WIDTH * SCALE, TEXT_HEIGHT * SCALE);
	source.width = source.height = 1;
	return expected;
}

export function scoreText(
	actual: HTMLCanvasElement,
	frame: number,
	captureReference?: (canvas: HTMLCanvasElement) => void,
	templateRow: "first" | "matched" = "matched",
) {
	const expected = renderTextReference(frame);
	captureReference?.(expected);
	let correct = 0;
	let minimumContrastRatio = Infinity;
	const mismatches: {
		row: number;
		column: number;
		expected: string;
		recognized: string;
		rectangle: ReturnType<typeof glyphRectangle>;
	}[] = [];
	// Two separated text rows, all distinct characters at each time.
	// Padding places rows 0/30 at y=72.128/1262.528: their raster phases
	// differ by .4 px. Use the corresponding reference row for both frame
	// phases; retain "first" only to reproduce the historical diagnostic.
	for (const row of [0, 30]) {
		const templates = Array.from(ALPHABET, (_, column) =>
			pixels(expected, column, templateRow === "matched" ? row : 0, frame),
		);
		for (let column = 0; column < ALPHABET.length; column++) {
			const observed = pixels(actual, column, row, frame);
			const reference = pixels(expected, column, row, frame);
			let best = -1;
			let distance = Infinity;
			// The fixture has a known numeric run followed by a known alphabetic run.
			// Compare within that run so codec noise cannot turn a readable B into 8.
			const firstCandidate = column < 10 ? 0 : 10;
			const lastCandidate = column < 10 ? 10 : templates.length;
			for (let candidate = firstCandidate; candidate < lastCandidate; candidate++) {
				const error = observed.reduce(
					(sum, value, index) => sum + (value - templates[candidate][index]) ** 2,
					0,
				);
				if (error < distance) {
					best = candidate;
					distance = error;
				}
			}
			if (best === column) correct++;
			else
				mismatches.push({
					row,
					column,
					expected: ALPHABET[column],
					recognized: ALPHABET[best],
					rectangle: glyphRectangle(column, row, frame),
				});
			minimumContrastRatio = Math.min(
				minimumContrastRatio,
				contrast(observed) / contrast(reference),
			);
		}
	}
	expected.width = expected.height = 1;
	return { correct, total: ALPHABET.length * 2, minimumContrastRatio, mismatches };
}
