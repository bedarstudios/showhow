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
	return (
		<Sheet
			open={open}
			onOpenChange={(nextOpen) => {
				if (!busy) onOpenChange(nextOpen);
			}}
			onCloseAutoFocus={onCloseAutoFocus}
			eyebrow={t("showhowTrash.eyebrow")}
			title={t("showhowTrash.title")}
			description={t("showhowTrash.body", { title })}
			footer={
				<>
					{/* Focus starts on Cancel, the safe action. The ring shows on plain :focus too: a
					    sheet opened with the mouse would otherwise hide where focus starts. The style is
					    an arbitrary property because tailwind-merge 3 drops Tailwind 3's `outline`
					    utility beside `outline-2`. */}
					<Button
						variant="secondary"
						disabled={busy}
						autoFocus
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
