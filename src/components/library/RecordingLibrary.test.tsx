import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordingLibraryEntry } from "@/lib/showhow/recordingLibrary";
import { RecordingLibrary } from "./RecordingLibrary";

// Mock window.electronAPI
const mockShowhowListRecordings = vi.fn<() => Promise<RecordingLibraryEntry[]>>();
const mockSwitchToHud = vi.fn<() => Promise<void>>();
const mockClipboardWriteText = vi.fn<(text: string) => Promise<void>>();
const mockShowhowCopyPath = vi.fn<(bundleDir: string) => Promise<{ success: boolean }>>();

beforeEach(() => {
	vi.resetAllMocks();
	mockSwitchToHud.mockResolvedValue();
	mockClipboardWriteText.mockResolvedValue(undefined);
	mockShowhowCopyPath.mockResolvedValue({ success: true });
	Object.defineProperty(window, "electronAPI", {
		value: {
			showhowListRecordings: mockShowhowListRecordings,
			showhowCopyPath: mockShowhowCopyPath,
			switchToHud: mockSwitchToHud,
		},
		writable: true,
		configurable: true,
	});
	// jsdom does not ship navigator.clipboard; provide a minimal mock so the
	// Copy path action can be exercised without touching production code.
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText: mockClipboardWriteText },
		writable: true,
		configurable: true,
	});
});

const desktopEntry: RecordingLibraryEntry = {
	bundleDir: "/Users/user/Showhow/Recordings/2026-07-11_164207-recording",
	title: "Recording 2026-07-11 16:42",
	source: "desktop",
	createdAt: new Date(2026, 6, 11, 16, 42, 7).getTime(),
	durationMs: 72_000,
};

const browserEntry: RecordingLibraryEntry = {
	bundleDir: "/Users/user/Showhow/Recordings/2026-07-12_100000-recording",
	title: "Browser recording",
	source: "browser",
	createdAt: new Date(2026, 6, 12, 10, 0, 0).getTime(),
	durationMs: 154_000,
};

// ---- Issue #23: workflow document view ---------------------------------------
//
// The Phase 2 doc engine writes `steps.json` (see `electron/showhow/bundle.ts`)
// with one `Step` per captured click: `{ label, ts, coords, screenshot, ... }`.
// The library document view is expected to surface, for the selected bundle:
// the built-in video player, the title/source tag/exact folder path, a Copy
// path action, and the numbered steps (screenshot + instruction + timestamp
// chip that seeks the player). These tests pin that behavior; they fail today
// because `RecordingLibrary` does not yet render the document view.

interface WorkflowStep {
	/** Instruction label (from transcript-matched step label). */
	label: string;
	/** Click time in milliseconds (source of truth for the timestamp chip). */
	ts: number;
	/** `step-NN.png` filename inside the bundle's `screenshots/` directory. */
	screenshot: string;
}

interface WorkflowDocumentEntry extends RecordingLibraryEntry {
	/** Bundle video filename, mirroring `ShowhowMeta.video`. */
	video: "video.mp4" | "video.webm";
	/** Steps parsed from the bundle's `steps.json`. Empty for transcript-only docs. */
	steps: WorkflowStep[];
}

const desktopDocEntry: WorkflowDocumentEntry = {
	...desktopEntry,
	video: "video.mp4",
	steps: [
		{ label: "Open the products page", ts: 3_000, screenshot: "step-01.png" },
		{ label: "Click Add product", ts: 12_000, screenshot: "step-02.png" },
		{ label: "Enter the product title", ts: 21_000, screenshot: "step-03.png" },
	],
};

const browserDocEntry: WorkflowDocumentEntry = {
	...browserEntry,
	video: "video.webm",
	steps: [{ label: "Open account settings", ts: 5_000, screenshot: "step-01.png" }],
};

describe("RecordingLibrary", () => {
	it("renders the approved empty state when no recordings exist", async () => {
		mockShowhowListRecordings.mockResolvedValue([]);
		render(<RecordingLibrary />);
		await waitFor(() => {
			expect(screen.getByTestId("empty-library-state")).toBeInTheDocument();
		});
		expect(screen.getByText("No recordings yet")).toBeInTheDocument();
	});

	it("renders the sidebar empty message when no recordings exist", async () => {
		mockShowhowListRecordings.mockResolvedValue([]);
		render(<RecordingLibrary />);
		await waitFor(() => {
			expect(screen.getByText("No recordings yet. Start one to see it here.")).toBeInTheDocument();
		});
	});

	it("renders a desktop recording row with monitor icon label", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopEntry]);
		render(<RecordingLibrary />);
		await waitFor(() => {
			// Title appears in both sidebar row and main panel
			expect(screen.getAllByText(desktopEntry.title).length).toBeGreaterThan(0);
		});
		expect(screen.getByText(/Desktop · 1:12/)).toBeInTheDocument();
	});

	it("renders a browser recording row with globe icon", async () => {
		mockShowhowListRecordings.mockResolvedValue([browserEntry]);
		render(<RecordingLibrary />);
		await waitFor(() => {
			expect(screen.getAllByText(browserEntry.title).length).toBeGreaterThan(0);
		});
		expect(screen.getByText(/Browser · 2:34/)).toBeInTheDocument();
	});

	it("marks the first entry as active on load", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopEntry, browserEntry]);
		render(<RecordingLibrary />);
		await waitFor(() => {
			expect(
				screen.getAllByRole("button").find((b) => b.getAttribute("aria-pressed") === "true"),
			).toBeTruthy();
		});
		const activeBtn = screen
			.getAllByRole("button")
			.find((b) => b.getAttribute("aria-pressed") === "true");
		expect(activeBtn).toHaveTextContent(desktopEntry.title);
	});

	it("selects a different entry when its row is clicked", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopEntry, browserEntry]);
		render(<RecordingLibrary />);
		await waitFor(() => {
			expect(screen.getByText(browserEntry.title)).toBeInTheDocument();
		});
		const browserBtn = screen
			.getAllByRole("button")
			.find((b) => b.textContent?.includes(browserEntry.title));
		expect(browserBtn).toBeDefined();
		await act(async () => {
			await userEvent.click(browserBtn!);
		});
		expect(browserBtn).toHaveAttribute("aria-pressed", "true");
	});

	it("shows the active recording's folder path", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopEntry]);
		render(<RecordingLibrary />);
		await waitFor(() => {
			expect(screen.getByText(desktopEntry.bundleDir)).toBeInTheDocument();
		});
	});

	it("shows the active recording's title in the main panel", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopEntry]);
		render(<RecordingLibrary />);
		await waitFor(() => {
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(desktopEntry.title);
		});
	});

	it("shows the source tag on the active recording", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopEntry]);
		render(<RecordingLibrary />);
		await waitFor(() => {
			expect(screen.getByText("Desktop recording")).toBeInTheDocument();
		});
	});

	it("shows a distinct error state when the IPC load fails", async () => {
		mockShowhowListRecordings.mockRejectedValue(new Error("IPC error"));
		render(<RecordingLibrary />);
		await waitFor(() => {
			expect(screen.getByTestId("recording-library-error-state")).toBeInTheDocument();
		});
		expect(screen.queryByTestId("empty-library-state")).not.toBeInTheDocument();
		expect(screen.queryByText("No recordings yet")).not.toBeInTheDocument();
	});

	it("renders the Library section heading in the sidebar", async () => {
		mockShowhowListRecordings.mockResolvedValue([]);
		render(<RecordingLibrary />);
		// The sidebar "LIBRARY" heading is always present
		expect(screen.getByText("Library")).toBeInTheDocument();
	});

	it("returns to the recorder from the library", async () => {
		mockShowhowListRecordings.mockResolvedValue([]);
		render(<RecordingLibrary />);

		await screen.findByTestId("empty-library-state");
		await userEvent.click(screen.getByRole("button", { name: "Back to recorder" }));

		expect(mockSwitchToHud).toHaveBeenCalledTimes(1);
	});
});

describe("RecordingLibrary — workflow document view (issue #23)", () => {
	it("renders a built-in video player for the selected bundle", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopDocEntry]);
		const { container } = render(<RecordingLibrary />);

		await waitFor(() => {
			expect(container.querySelector("video")).not.toBeNull();
		});
		const video = container.querySelector("video");
		// The player src must reference the bundle's video file.
		expect(video?.getAttribute("src") ?? "").toMatch(/video\.mp4/u);
	});

	it("shows the title, source tag, and exact folder path for the selected bundle", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopDocEntry]);
		render(<RecordingLibrary />);

		await waitFor(() => {
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(desktopDocEntry.title);
		});
		// Source tag.
		expect(screen.getByText("Desktop recording")).toBeInTheDocument();
		// Exact folder path (not a truncated/derived label).
		expect(screen.getByText(desktopDocEntry.bundleDir)).toBeInTheDocument();
	});

	it("renders numbered steps with screenshot and instruction content from steps data", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopDocEntry]);
		const { container } = render(<RecordingLibrary />);

		// Wait for the first step instruction to appear.
		await waitFor(() => {
			expect(screen.getByText("Open the products page")).toBeInTheDocument();
		});

		// Every step instruction is rendered, in order.
		expect(screen.getByText("Open the products page")).toBeInTheDocument();
		expect(screen.getByText("Click Add product")).toBeInTheDocument();
		expect(screen.getByText("Enter the product title")).toBeInTheDocument();

		// Step numbers 1, 2, 3 are rendered (one per step).
		for (const num of ["1", "2", "3"]) {
			expect(screen.getAllByText(num).length).toBeGreaterThan(0);
		}

		// Each step surfaces its screenshot image, referencing the bundle screenshot
		// filename so the doc view is driven by the steps data.
		const imgs = container.querySelectorAll("img");
		expect(imgs.length).toBeGreaterThanOrEqual(3);
		const srcs = Array.from(imgs).map((img) => img.getAttribute("src") ?? "");
		expect(srcs.some((src) => src.includes("step-01.png"))).toBe(true);
		expect(srcs.some((src) => src.includes("step-02.png"))).toBe(true);
		expect(srcs.some((src) => src.includes("step-03.png"))).toBe(true);
	});

	it("copies the bundle folder path to the clipboard via the Copy path action", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopDocEntry]);
		render(<RecordingLibrary />);

		// The title renders in both the sidebar row and the main-panel heading;
		// wait for the heading (unique) so the detail panel has mounted.
		await waitFor(() => {
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(desktopDocEntry.title);
		});
		await userEvent.click(screen.getByRole("button", { name: /Copy path/iu }));

		expect(mockShowhowCopyPath).toHaveBeenCalledTimes(1);
		expect(mockShowhowCopyPath).toHaveBeenCalledWith(desktopDocEntry.bundleDir);
		expect(mockClipboardWriteText).not.toHaveBeenCalled();
	});

	it("seeks the built-in player to the step time when a timestamp chip is clicked", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopDocEntry]);
		const { container } = render(<RecordingLibrary />);

		await waitFor(() => {
			expect(screen.getByText("Open the products page")).toBeInTheDocument();
		});
		const video = container.querySelector("video") as HTMLVideoElement;
		expect(video).not.toBeNull();
		// Sanity: the player starts at the beginning.
		expect(video.currentTime).toBe(0);

		// The second step is at 12000 ms -> formatted chip "0:12".
		const chip = screen.getByText("0:12");
		await act(async () => {
			await userEvent.click(chip);
		});

		// Clicking the chip seeks the built-in player to the step's time (seconds).
		expect(video.currentTime).toBe(12);
	});

	it("does not apply a queued seek after selecting another recording", async () => {
		mockShowhowListRecordings.mockResolvedValue([desktopDocEntry, browserDocEntry]);
		const { container } = render(<RecordingLibrary />);

		await screen.findByText("Open the products page");
		const firstVideo = container.querySelector("video") as HTMLVideoElement;
		Object.defineProperty(firstVideo, "readyState", {
			configurable: true,
			value: HTMLMediaElement.HAVE_NOTHING,
		});
		await userEvent.click(screen.getByText("0:12"));

		const browserRow = screen
			.getAllByRole("button")
			.find((button) => button.textContent?.includes(browserDocEntry.title));
		expect(browserRow).toBeDefined();
		await userEvent.click(browserRow!);
		await screen.findByText("Open account settings");

		const secondVideo = container.querySelector("video") as HTMLVideoElement;
		secondVideo.currentTime = 0;
		fireEvent.loadedMetadata(secondVideo);

		expect(secondVideo.currentTime).toBe(0);
	});
});
