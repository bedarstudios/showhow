import "@/index.css";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { I18nProvider } from "@/contexts/I18nContext";
import type { RecordingLibraryEntry } from "@/lib/showhow/recordingLibrary";
import { RecordingLibrary } from "./RecordingLibrary";

describe("RecordingLibrary Sidebar titlebar inset in Chromium", () => {
	it("moves only the logo for macOS inset, zero inset, and missing inset", async () => {
		await page.viewport(1280, 800);

		const root = document.documentElement;
		const previousInset = root.style.getPropertyValue("--titlebar-inset-left");
		const previousElectronApi = Object.getOwnPropertyDescriptor(window, "electronAPI");
		root.style.setProperty("--titlebar-inset-left", "68px");
		Object.defineProperty(window, "electronAPI", {
			configurable: true,
			value: {
				showhowListRecordings: vi.fn(async () => []),
				switchToHud: vi.fn(async () => undefined),
			},
		});

		const { unmount } = render(
			<I18nProvider>
				<RecordingLibrary />
			</I18nProvider>,
		);

		try {
			await screen.findByText("No recordings yet. Start one to see it here.");

			const sidebar = screen.getByRole("complementary");
			const logo = screen.getByRole("img", { name: "Showhow" });
			const primaryAction = screen.getByRole("button", { name: "New recording" });
			const settingsAction = screen.getByRole("button", { name: "Settings" });
			const leftInSidebar = (element: HTMLElement) =>
				Math.round(element.getBoundingClientRect().left - sidebar.getBoundingClientRect().left);
			const actionGeometry = () => ({
				primaryLeft: leftInSidebar(primaryAction),
				primaryWidth: Math.round(primaryAction.getBoundingClientRect().width),
				settingsLeft: leftInSidebar(settingsAction),
				settingsWidth: Math.round(settingsAction.getBoundingClientRect().width),
			});

			let baselineActionGeometry: ReturnType<typeof actionGeometry> | undefined;
			for (const inset of [
				{ cssValue: "68px", expectedLogoLeft: 86 },
				{ cssValue: "0px", expectedLogoLeft: 18 },
				{ cssValue: undefined, expectedLogoLeft: 18 },
			]) {
				if (inset.cssValue === undefined) {
					root.style.removeProperty("--titlebar-inset-left");
				} else {
					root.style.setProperty("--titlebar-inset-left", inset.cssValue);
				}

				await waitFor(() => {
					expect(leftInSidebar(logo)).toBe(inset.expectedLogoLeft);
					expect(leftInSidebar(primaryAction)).toBe(18);
					expect(leftInSidebar(settingsAction)).toBe(18);
				});

				expect(settingsAction.getBoundingClientRect().width).toBeGreaterThan(0);
				const currentActionGeometry = actionGeometry();
				if (baselineActionGeometry) {
					expect(currentActionGeometry).toEqual(baselineActionGeometry);
				} else {
					baselineActionGeometry = currentActionGeometry;
				}
			}
		} finally {
			unmount();
			if (previousInset) root.style.setProperty("--titlebar-inset-left", previousInset);
			else root.style.removeProperty("--titlebar-inset-left");
			if (previousElectronApi) {
				Object.defineProperty(window, "electronAPI", previousElectronApi);
			} else {
				Reflect.deleteProperty(window, "electronAPI");
			}
		}
	});

	it("enters a generated summary from four pixels over 240ms", async () => {
		await page.viewport(1280, 800);
		const previousElectronApi = Object.getOwnPropertyDescriptor(window, "electronAPI");
		const summaryText = "A brief generated summary.";
		const entry: RecordingLibraryEntry = {
			bundleDir: "/Users/user/Showhow/Recordings/2026-07-12_100000-recording",
			title: "A titled recording",
			source: "desktop",
			createdAt: new Date(2026, 6, 12, 10, 0, 0).getTime(),
			summary: summaryText,
		};
		Object.defineProperty(window, "electronAPI", {
			configurable: true,
			value: {
				showhowListRecordings: async () => [entry],
				switchToHud: async () => undefined,
			},
		});
		const { unmount } = render(
			<I18nProvider>
				<RecordingLibrary />
			</I18nProvider>,
		);

		try {
			const summary = await screen.findByText(summaryText);
			const style = getComputedStyle(summary);
			expect(style.animationDuration).toBe("0.24s");
			expect(style.animationTimingFunction).toBe("cubic-bezier(0.23, 1, 0.32, 1)");
			expect(style.fontSize).toBe("14px");
			expect(style.maxWidth).toBe("640px");
			expect(style.getPropertyValue("-webkit-line-clamp")).toBe("2");
			const animation = summary.getAnimations()[0];
			if (!animation) throw new Error("Summary entrance animation is missing");
			animation.currentTime = 0;
			expect(new DOMMatrixReadOnly(getComputedStyle(summary).transform).m42).toBe(4);
		} finally {
			unmount();
			if (previousElectronApi) {
				Object.defineProperty(window, "electronAPI", previousElectronApi);
			} else {
				Reflect.deleteProperty(window, "electronAPI");
			}
		}
	});
});

describe("RecordingLibrary guide step editing in Chromium", () => {
	it("fills the step text column, wraps long instructions, and keeps keyboard actions", async () => {
		await page.viewport(1440, 900);

		const previousElectronApi = Object.getOwnPropertyDescriptor(window, "electronAPI");
		const instructionText =
			"Click into the document, review the instructions, and press Save after confirming the final paragraph. "
				.repeat(8)
				.trim();
		const entry: RecordingLibraryEntry = {
			bundleDir: "/Users/user/Showhow/Recordings/2026-10-24_100000-guide-width",
			title: "A guide with a long instruction",
			source: "desktop",
			createdAt: new Date(2026, 9, 24, 10, 0, 0).getTime(),
			steps: [{ label: instructionText, ts: 1_000, screenshot: "" }],
		};
		const updateWorkflowDocument = vi.fn(async () => ({ success: true }));
		Object.defineProperty(window, "electronAPI", {
			configurable: true,
			value: {
				showhowListRecordings: async () => [entry],
				showhowUpdateWorkflowDocument: updateWorkflowDocument,
				switchToHud: async () => undefined,
			},
		});
		const { unmount } = render(
			<I18nProvider>
				<RecordingLibrary />
			</I18nProvider>,
		);

		try {
			await screen.findByRole("heading", { level: 1, name: entry.title });
			await userEvent.click(screen.getByRole("button", { name: "Edit step 1" }));

			const instruction = await screen.findByRole("textbox", { name: "Step 1 instruction" });
			const textColumn = instruction.closest("article")?.querySelector("h3")?.parentElement;
			if (!textColumn) throw new Error("Guide step text column is missing");
			const columnWidth = textColumn.getBoundingClientRect().width;
			expect(columnWidth).toBeGreaterThan(0);
			expect(instruction.getBoundingClientRect().width).toBeGreaterThanOrEqual(columnWidth);
			expect(instruction.tagName).toBe("TEXTAREA");

			const lineHeight = Number.parseFloat(getComputedStyle(instruction).lineHeight);
			expect(instruction.clientHeight).toBeGreaterThan(lineHeight);
			expect(instruction.scrollHeight).toBeGreaterThan(instruction.clientHeight);
			const fieldBottom = instruction.getBoundingClientRect().bottom;
			for (const name of ["Save step", "Cancel"]) {
				expect(
					screen.getByRole("button", { name }).getBoundingClientRect().top,
				).toBeGreaterThanOrEqual(fieldBottom);
			}

			await userEvent.keyboard("{Enter}");
			await waitFor(() =>
				expect(screen.queryByRole("textbox", { name: "Step 1 instruction" })).toBeNull(),
			);
			expect(updateWorkflowDocument).toHaveBeenCalledWith(entry.bundleDir, {
				type: "step",
				index: 0,
				label: instructionText,
			});

			await userEvent.click(screen.getByRole("button", { name: "Edit step 1" }));
			const reopenedInstruction = await screen.findByRole("textbox", {
				name: "Step 1 instruction",
			});
			await userEvent.clear(reopenedInstruction);
			await userEvent.type(reopenedInstruction, "Discard this edit");
			await userEvent.keyboard("{Escape}");
			await waitFor(() =>
				expect(screen.queryByRole("textbox", { name: "Step 1 instruction" })).toBeNull(),
			);
			expect(updateWorkflowDocument).toHaveBeenCalledOnce();
			expect(screen.getByText(instructionText)).toBeInTheDocument();
		} finally {
			unmount();
			if (previousElectronApi) {
				Object.defineProperty(window, "electronAPI", previousElectronApi);
			} else {
				Reflect.deleteProperty(window, "electronAPI");
			}
		}
	});
});
