import type { ReactNode } from "react";

export interface GuideStepProps {
	number: number;
	title: string;
	quote?: string;
	shot?: ReactNode;
	timestamp?: string;
	actions?: ReactNode;
	flag?: ReactNode;
}

export function GuideStep({
	number,
	title,
	quote,
	shot,
	timestamp,
	actions,
	flag,
}: GuideStepProps) {
	return (
		<article className="flex w-full gap-5 border-t border-ds-line py-5">
			<div className="w-9 shrink-0">
				<span className="font-ds-label text-[11px] font-medium tracking-[0.6px] text-ds-ink">
					{String(number).padStart(2, "0")}
				</span>
			</div>
			<div className="flex h-[136px] w-[240px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-ds-panel">
				{shot}
			</div>
			<div className="flex flex-1 flex-col gap-2">
				<h3 className="font-ds-body text-[15px] font-medium text-ds-ink">{title}</h3>
				{quote && (
					<blockquote className="font-ds-serif text-[15px] italic leading-[1.5] text-ds-ink-soft">
						{quote}
					</blockquote>
				)}
				<div className="flex items-center gap-3 pt-1">
					{timestamp && (
						<span className="font-ds-label text-[11px] tracking-[0.6px] text-ds-ink">
							{timestamp}
						</span>
					)}
					{actions}
					{flag}
				</div>
			</div>
		</article>
	);
}
