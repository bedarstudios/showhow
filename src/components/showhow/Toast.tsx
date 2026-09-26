import { Toaster, toast } from "sonner";

const showhowToastClass =
	"rounded-[4px] px-4 py-[10px] font-ds-label text-[11px] font-medium tracking-[0.6px] uppercase bg-ds-ink text-ds-surface shadow-[0_16px_40px_rgba(20,15,8,0.2)]";

export function ShowhowToaster() {
	return (
		<Toaster position="bottom-right" toastOptions={{ classNames: { toast: showhowToastClass } }} />
	);
}

export function showhowToast(message: string) {
	toast(message, { className: showhowToastClass });
}
