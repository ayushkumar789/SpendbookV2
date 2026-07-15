"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/helpers";
import type { ThemePreference } from "@/types";

/** Compact header toggle — cycles light → dark → system. */
export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  const next: ThemePreference = preference === "light" ? "dark" : preference === "dark" ? "system" : "light";
  const Icon = preference === "system" ? Monitor : resolved === "dark" ? Moon : Sun;

  return (
    <button
      onClick={() => setPreference(next)}
      aria-label={`Theme: ${preference}. Switch to ${next}.`}
      title={`Theme: ${preference}`}
      className="press flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink2 transition-colors hover:text-ink"
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

/** Segmented Light / Dark / System control used in Settings. */
export function ThemeSegmented() {
  const { preference, setPreference } = useTheme();
  const options: { key: ThemePreference; label: string; icon: typeof Sun }[] = [
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
    { key: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-sunken p-1">
      {options.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setPreference(key)}
          className={cn(
            "press flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
            preference === key ? "bg-card text-ink shadow-card" : "text-ink3 hover:text-ink2"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
