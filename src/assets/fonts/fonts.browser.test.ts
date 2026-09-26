import "@/index.css";
import { describe, expect, it } from "vitest";

// Representative built-in annotation families must load from the bundled local
// faces — no network request to Google. If these were still backed by the old
// global Google CSS import, document.fonts would have no local face to load
// and the check would report an unavailable family in the offline harness.
describe("bundled annotation fonts", () => {
	it("loads a representative built-in family offline", async () => {
		await document.fonts.load('700 16px "Manrope"');
		expect(document.fonts.check('700 16px "Manrope"')).toBe(true);
	});

	it("loads a representative single-weight display family offline", async () => {
		await document.fonts.load('400 16px "Bebas Neue"');
		expect(document.fonts.check('400 16px "Bebas Neue"')).toBe(true);
	});
});
