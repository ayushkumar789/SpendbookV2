"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/helpers";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "brand" | "jade" | "rose" | "live";
  className?: string;
}

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-sunken text-ink2 border border-line",
  brand: "bg-brand-soft text-brand-deep border border-transparent",
  jade: "bg-jade-soft text-jade border border-transparent",
  rose: "bg-rose-soft text-rose border border-transparent",
  live: "bg-jade-soft text-jade border border-transparent",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
        tones[tone],
        className
      )}
    >
      {tone === "live" ? <span className="h-1.5 w-1.5 rounded-full bg-jade animate-pulse-dot" /> : null}
      {children}
    </span>
  );
}

/** Colored initials avatar used for banks and UPI apps. */
export function InitialBadge({
  text,
  hex,
  size = 40,
}: {
  text: string;
  hex: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-2xl font-display font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.28)_inset,0_4px_10px_-4px_rgba(0,0,0,0.4)]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(145deg, ${hex}, color-mix(in srgb, ${hex} 72%, #1a120a))`,
      }}
    >
      {text}
    </span>
  );
}
