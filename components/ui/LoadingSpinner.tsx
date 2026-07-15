"use client";

import { cn } from "@/lib/helpers";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-brand",
        className
      )}
    />
  );
}

/** Full-screen branded splash shown while auth resolves — never a blank screen. */
export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-canvas overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl animate-pulse-dot"
        style={{ background: "radial-gradient(circle, var(--brand-glow), transparent 65%)" }}
      />
      <div className="backlit relative flex h-20 w-20 items-center justify-center rounded-[26px] border border-line bg-card-hi shadow-pop">
        <span className="font-display text-4xl text-brand">₹</span>
      </div>
      <div className="relative text-center">
        <p className="font-display text-3xl tracking-tight text-ink">SpendBook</p>
        <p className="mt-1.5 text-sm text-ink3">Opening your ledgers…</p>
      </div>
    </div>
  );
}
