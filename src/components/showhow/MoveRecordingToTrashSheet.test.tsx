// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { cleanup, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { MoveRecordingToTrashSheet } from "./MoveRecordingToTrashSheet";

const render = (node: ReactNode) => rtlRender(node, { wrapper: I18nProvider });

afterEach(cleanup);

describe("MoveRecordingToTrashSheet", () => {
	it("starts with focus on Cancel, the safe action", async () => {
		render(
			<MoveRecordingToTrashSheet
				open
				title="A take"
				onOpenChange={() => undefined}
				onConfirm={() => undefined}
			/>,
		);
		const dialog = await screen.findByRole("dialog", { name: "Move to Trash?" });
		await waitFor(() =>
			expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus(),
		);
	});

	it("hands focus back to its opener when it closes, because it has no trigger of its own", async () => {
		const onCloseAutoFocus = vi.fn((event: Event) => event.preventDefault());
		const onOpenChange = vi.fn();
		const sheet = (open: boolean) => (
			<MoveRecordingToTrashSheet
				open={open}
				title="A take"
				onOpenChange={onOpenChange}
				onConfirm={() => undefined}
				onCloseAutoFocus={onCloseAutoFocus}
			/>
		);
		const { rerender } = render(sheet(true));
		await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
		rerender(sheet(false));
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
		await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledOnce());
	});
});
