import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-teal text-white shadow-sm hover:bg-teal/90 focus-visible:ring-teal/30 disabled:bg-slate-300",
  secondary:
    "bg-coral text-white shadow-sm hover:bg-coral/90 focus-visible:ring-coral/30 disabled:bg-slate-300",
  ghost:
    "bg-transparent text-slate hover:bg-slate-100 focus-visible:ring-slate/20"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
});
