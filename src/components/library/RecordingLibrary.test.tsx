import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordingLibraryEntry } from "@/lib/showhow/recordingLibrary";
import { RecordingLibrary } from "./RecordingLibrary";

// Mock window.electronAPI
const mockShowhowListRecordings = vi.fn<() => Promise<RecordingLibraryEntry[]>>();
const mockSwitchToHud = vi.fn<() => Promise<void>>();

beforeEach(() => {
	vi.resetAllMocks();
	mockSwitchToHud.mockResolvedValue();
	Object.defineProperty(window, "electronAPI", {
		value: {
			showhowListRecordings: mockShowhowListRecordings,
			switchToHud: mockSwitchToHud,
		},
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
