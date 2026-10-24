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
					<Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
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
