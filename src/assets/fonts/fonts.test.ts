import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fontsDirectory = resolve(process.cwd(), "src/assets/fonts");
const fontsCss = readFileSync(resolve(fontsDirectory, "fonts.css"), "utf8");
// Defensive read so the bundle-coverage assertions below fail as real
// assertions (empty content) instead of crashing the suite when the file is
// missing — a missing-file crash runs zero tests and proves nothing.
const annotationFontsCssPath = resolve(fontsDirectory, "annotation-fonts.css");
const annotationFontsCss = existsSync(annotationFontsCssPath)
	? readFileSync(annotationFontsCssPath, "utf8")
	: "";
const bundledFontCss = `${fontsCss}\n${annotationFontsCss}`;
const globalStylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

// The built-in annotation picker families the app promises to style offline
// (AnnotationSettingsPanel.tsx). Inter is bundled by the ds design tokens and
// system stacks need no font files.
const BUILT_IN_ANNOTATION_FAMILIES = [
	...[
		...readFileSync(
			resolve(process.cwd(), "src/components/video-editor/AnnotationSettingsPanel.tsx"),
			"utf8",
		).matchAll(/name: "([^"]+)"/g),
	].map((match) => match[1]),
].filter((family) => family !== "Inter");

describe("local font assets", () => {
	it("makes no runtime Google Fonts request from the global stylesheet", () => {
		expect(globalStylesheet).not.toMatch(/fonts\.googleapis\.com/);
		expect(bundledFontCss).not.toMatch(/fonts\.googleapis\.com/);
	});

	it("documents the exact license and copyright for every bundled family", () => {
		const license = readFileSync(resolve(fontsDirectory, "LICENSE.md"), "utf8");

		// Full license texts must be present, not just links.
		expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
		expect(license).toContain("This license is copied below, and is also available with a FAQ at:");
		expect(license).toContain("Apache License");
		expect(license).toContain("Version 2.0, January 2004");

		// Every family declared by the bundled CSS must have an attribution entry
		// carrying its package's own copyright line, plus its license type.
		const families = new Set(
			[...bundledFontCss.matchAll(/font-family:\s*"?([^";]+)"?\s*;/g)].map((match) => match[1]),
		);
		const APACHE_FAMILIES = new Set(["Permanent Marker"]);
		expect(families.size).toBe(19);

		for (const family of families) {
			const familySection = license
				.split(/(?=^## )/m)
				.find((section) => section.includes(`"${family}"`) || section.includes(`### ${family}`));
			expect(familySection, `${family} attribution section`).toBeDefined();
			expect(familySection, `${family} copyright notice`).toMatch(/Copyright/i);
			expect(familySection, `${family} license type`).toContain(
				APACHE_FAMILIES.has(family) ? "Apache-2.0" : "OFL-1.1",
			);
		}

		// Reserved Font Name declarations must survive verbatim.
		for (const reserved of ["Lora", "Merriweather", "Playfair Display"]) {
			expect(license).toMatch(new RegExp(`Copyright [^\\n]*${reserved} [^\\n]*Reserved Font Name`));
		}
	});

	it("bundles every built-in annotation family locally with regular and bold faces", () => {
		const bundledFamilies = new Set(
			[...bundledFontCss.matchAll(/font-family:\s*"([^"]+)"/g)].map((match) => match[1]),
		);

		for (const family of BUILT_IN_ANNOTATION_FAMILIES) {
			expect(bundledFamilies, `${family} has a local @font-face`).toContain(family);
		}

		for (const [, filename] of [...annotationFontsCss.matchAll(/url\("\.\/([^"\\]+\.woff2)"\)/g)]) {
			const font = readFileSync(resolve(fontsDirectory, filename));
			expect(font.length, filename).toBeGreaterThan(10_000);
			expect(font.subarray(0, 4).toString("ascii"), filename).toBe("wOF2");
		}

		// Every referenced file must exist on disk (no dangling entries).
		const available = new Set(readdirSync(fontsDirectory));
		for (const [, filename] of [...annotationFontsCss.matchAll(/url\("\.\/([^"\\]+\.woff2)"\)/g)]) {
			expect(available.has(filename), `${filename} exists`).toBe(true);
		}
	});

	it("ships the bundled fonts and their licenses in packaged builds", () => {
		const builderConfig = readFileSync(resolve(process.cwd(), "electron-builder.json5"), "utf8");
		expect(builderConfig).toMatch(/"from":\s*"src\/assets\/fonts"/);
		expect(builderConfig).toMatch(/"to":\s*"font-licenses"/);
		// Only the consolidated license document is copied: the woff2 binaries are
		// already bundled into dist by Vite; duplicating them via extraResources
		// would ship every font twice.
		expect(builderConfig).toMatch(/"filter":\s*\[\s*"LICENSE\.md"\s*\]/);
	});
});
