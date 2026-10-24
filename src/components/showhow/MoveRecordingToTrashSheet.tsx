import { useRef } from "react";
import { Button } from "@/components/showhow/Button";
import { Sheet, type SheetProps } from "@/components/showhow/Sheet";
import { useScopedT } from "@/contexts/I18nContext";

export interface MoveRecordingToTrashSheetProps {
	open: boolean;
	title: string;
	busy?: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	/**
	 * The sheet opens from a menu item or a shortcut, never from a trigger of its own, so the
	 * opener says where focus goes when it closes; without this, focus falls to the document.
	 */
	onCloseAutoFocus?: SheetProps["onCloseAutoFocus"];
}

export function MoveRecordingToTrashSheet({
	open,
	title,
	busy = false,
	onOpenChange,
	onConfirm,
	onCloseAutoFocus,
}: MoveRecordingToTrashSheetProps) {
	const t = useScopedT("common");
	const cancelButton = useRef<HTMLButtonElement>(null);
	return (
		<Sheet
			open={open}
			onOpenChange={(nextOpen) => {
				if (!busy) onOpenChange(nextOpen);
			}}
			// Focus starts on Cancel, the safe action. It goes through the focus trap's own hook
			// rather than `autoFocus`, so the trap records it: the ⋯ menu that opened the sheet
			// returns focus to its trigger a tick later, and the trap pulls focus back to Cancel.
			onOpenAutoFocus={(event) => {
				event.preventDefault();
				cancelButton.current?.focus();
			}}
			onCloseAutoFocus={onCloseAutoFocus}
			eyebrow={t("showhowTrash.eyebrow")}
			title={t("showhowTrash.title")}
			description={t("showhowTrash.body", { title })}
			footer={
				<>
					{/* The ring shows on plain :focus too: a sheet opened with the mouse would otherwise
					    hide where focus starts. The style is an arbitrary property because
					    tailwind-merge 3 drops Tailwind 3's `outline` utility beside `outline-2`. */}
					<Button
						ref={cancelButton}
						variant="secondary"
						disabled={busy}
						className="focus:[outline-style:solid] focus:outline-2 focus:outline-offset-2 focus:outline-ds-ink"
						onClick={() => onOpenChange(false)}
					>
						{t("actions.cancel")}
					</Button>
					<Button variant="rec" disabled={busy} onClick={onConfirm}>
						{t("showhowTrash.move")}
					</Button>
				</>
			}
		/>
	);
}
