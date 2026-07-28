import { describe, expect, it, vi } from "vitest";
import { copyShowhowBundlePath } from "./showhowLibrary";

describe("copyShowhowBundlePath", () => {
	it("writes the exact local bundle path through Electron's clipboard service", () => {
		const clipboard = { writeText: vi.fn() };
		const bundleDir = "/Users/mohamedb/Showhow/Recordings/2026-07-25_175438-recording";

		expect(copyShowhowBundlePath(clipboard, bundleDir)).toEqual({ success: true });
		expect(clipboard.writeText).toHaveBeenCalledWith(bundleDir);
	});
});
