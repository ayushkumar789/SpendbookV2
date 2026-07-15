"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/helpers";

type Variant = "primary" | "ink" | "outline" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  /* Volt fill + traveling border light + glow that intensifies on hover */
  primary:
    "shimmer-border bg-brand text-on-brand shadow-[0_0_18px_-6px_var(--brand-glow)] hover:shadow-[0_0_30px_-6px_var(--brand-glow)] hover:scale-[1.02] active:scale-[0.98]",
  ink: "bg-ink text-canvas hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]",
  outline:
    "border border-line-strong bg-transparent text-ink hover:bg-card-hi hover:border-brand/40 hover:shadow-[0_0_20px_-8px_var(--brand-glow)]",
  ghost:
    "bg-transparent text-ink2 hover:bg-card-hi hover:text-ink hover:shadow-[0_0_20px_-8px_var(--brand-glow)]",
  danger: "bg-rose text-white hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]",
  soft: "bg-brand-soft text-brand-deep hover:bg-brand/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-xl",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-[52px] px-7 text-[15px] gap-2.5 rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, icon, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold tracking-tight transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});
