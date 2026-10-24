import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "design/brand/showhow-og.html");
const output = path.join(root, "site/public/og.png");
const browser = await chromium.launch();

try {
	const page = await browser.newPage({
		viewport: { width: 1200, height: 630 },
		deviceScaleFactor: 1,
		offline: true,
	});
	await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
	const loaded = await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(Array.from(document.images, (image) => image.decode()));
		const fonts = await Promise.all([
			document.fonts.load('400 24px "Inter"'),
			document.fonts.load('700 64px "Inter Tight"'),
		]);
		return {
			fonts: fonts.map((faces) => faces.length),
			images: Array.from(document.images, (image) => image.naturalWidth),
		};
	});
	if (
		loaded.fonts.some((count) => count === 0) ||
		loaded.images.length !== 2 ||
		loaded.images.some((width) => width === 0)
	) {
		throw new Error("The social image fonts or local artwork did not load.");
	}
	fs.writeFileSync(output, await page.screenshot({ type: "png" }));
} finally {
	await browser.close();
}

console.log(`Rendered ${path.relative(root, output)} from ${path.relative(root, source)}`);
