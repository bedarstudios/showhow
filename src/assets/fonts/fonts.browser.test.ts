import "@/index.css";
import { describe, expect, it } from "vitest";

// Representative built-in annotation families must load from bundled local faces.
// check() alone can return true when no matching @font-face is declared.
async function expectFaceLoaded(font: string, text?: string) {
	const faces = await document.fonts.load(font, text);
	expect(faces.length).toBeGreaterThan(0);
	expect(faces.every((face) => face.status === "loaded")).toBe(true);
	expect(document.fonts.check(font, text)).toBe(true);
}

describe("bundled annotation fonts", () => {
	it("loads a representative built-in family offline", async () => {
		await expectFaceLoaded('700 16px "Manrope"');
	});

	it("loads a representative single-weight display family offline", async () => {
		await expectFaceLoaded('400 16px "Bebas Neue"');
	});

	it("loads an italic annotation face offline", async () => {
		await expectFaceLoaded('italic 400 16px "Playfair Display"', "Café");
	});

	it("loads a non-Latin annotation subset offline", async () => {
		await expectFaceLoaded('400 16px "Oswald"', "Ж");
	});

	it("loads Fira Code box-drawing symbols from its local symbols2 subset", async () => {
		await expectFaceLoaded('400 16px "Fira Code"', "─");
	});
});
