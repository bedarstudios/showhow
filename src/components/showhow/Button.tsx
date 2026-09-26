import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center gap-2 px-[14px] py-[10px] rounded-[4px] font-ds-label text-[11px] font-medium tracking-[0.6px] uppercase cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ds-accent disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				primary: "bg-ds-accent text-ds-on-accent hover:bg-ds-accent-200",
				secondary: "bg-ds-chip text-ds-ink",
				ghost: "border border-ds-line bg-transparent text-ds-ink",
				dark: "bg-ds-panel text-ds-on-panel",
				sidebar: "w-full justify-start bg-ds-on-panel-hover text-ds-on-panel",
				toolbar: "gap-1.5 bg-transparent px-2 py-1.5 text-ds-on-panel-soft",
			},
		},
		defaultVariants: { variant: "primary" },
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
	icon?: LucideIcon;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, asChild = false, icon: Icon, children, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp className={cn(buttonVariants({ variant, className }))} ref={ref} {...props}>
				{Icon && (
					<Icon
						aria-hidden="true"
						className={cn(variant === "toolbar" ? "size-[13px]" : "size-[14px]", "shrink-0")}
					/>
				)}
				{children}
			</Comp>
		);
	},
);
Button.displayName = "ShowhowButton";

export { Button, buttonVariants };
