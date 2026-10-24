// @vitest-environment jsdom
import "@/index.css";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { I18nProvider } from "@/contexts/I18nContext";
import { Button } from "./Button";
import { MoveRecordingToTrashSheet } from "./MoveRecordingToTrashSheet";

function Harness() {
	const [open, setOpen] = useState(false);
	return (
		<I18nProvider>
			<Button onClick={() => setOpen(true)}>Open</Button>
			<MoveRecordingToTrashSheet
				open={open}
				title="A take"
				onOpenChange={setOpen}
				onConfirm={() => setOpen(false)}
			/>
		</I18nProvider>
	);
}

describe("MoveRecordingToTrashSheet in a browser", () => {
	it("shows a focus ring on Cancel even when the sheet was opened with the mouse", async () => {
		render(<Harness />);
		// A real pointer click puts Chromium in mouse modality, where script-moved focus gets
		// no :focus-visible ring. The safe action still has to show where focus starts.
		await userEvent.click(screen.getByRole("button", { name: "Open" }));
		const dialog = await screen.findByRole("dialog", { name: "Move to Trash?" });
		const cancel = within(dialog).getByRole("button", { name: "Cancel" });
		await waitFor(() => expect(cancel).toHaveFocus());
		const ring = window.getComputedStyle(cancel);
		expect(ring.outlineStyle).toBe("solid");
		expect(ring.outlineWidth).toBe("2px");
	});
});
