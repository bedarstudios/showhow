import { describe, expect, it, vi } from "vitest";
import { createShowhowMediaUrl, fetchShowhowMedia } from "./mediaProtocol";

describe("createShowhowMediaUrl", () => {
	it("creates a renderer-loadable URL scoped to one recording bundle artifact", () => {
		expect(
			createShowhowMediaUrl(
				"/Users/mohamedb/Showhow/Recordings/2026-07-25_175438-recording",
				"screenshots/step-01.png",
			),
		).toBe("showhow-media://recordings/2026-07-25_175438-recording/screenshots/step-01.png");
	});

	it("rejects media paths that escape the selected recording bundle", () => {
		expect(() =>
			createShowhowMediaUrl(
				"/Users/mohamedb/Showhow/Recordings/2026-07-25_175438-recording",
				"../video.mp4",
			),
		).toThrow(/unsafe/i);
	});

	it("forwards Chromium's Range request to the local media fetch", async () => {
		const fetchLocalFile = vi.fn().mockResolvedValue(new Response(null, { status: 206 }));
		const request = new Request(
			"showhow-media://recordings/2026-07-25_175438-recording/video.mp4",
			{ headers: { Range: "bytes=1024-" } },
		);

		const response = await fetchShowhowMedia(
			"/Users/mohamedb/Showhow/Recordings",
			request,
			fetchLocalFile,
		);

		expect(response.status).toBe(206);
		expect(fetchLocalFile).toHaveBeenCalledWith(
			expect.stringMatching(/^file:/u),
			expect.objectContaining({ headers: { range: "bytes=1024-" } }),
		);
	});
});
