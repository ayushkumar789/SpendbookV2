"use client";

import { WifiOff } from "lucide-react";

/** Service-worker fallback page when there's no connection and no cache. */
export default function OfflinePage() {
  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-sunken">
        <WifiOff className="h-7 w-7 text-ink3" />
      </span>
      <div>
        <h1 className="font-display text-2xl tracking-tight text-ink">You&apos;re offline</h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink2">
          SpendBook couldn&apos;t reach the internet. Your data is safe — reconnect and pull to refresh.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="press rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-canvas"
      >
        Try again
      </button>
    </main>
  );
}
