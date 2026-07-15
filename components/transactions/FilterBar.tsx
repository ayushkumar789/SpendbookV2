"use client";

import { CalendarRange, X } from "lucide-react";
import { useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/helpers";
import type { TransactionFilters, TransactionType } from "@/types";

interface FilterBarProps {
  filters: TransactionFilters;
  onChange: (next: TransactionFilters) => void;
}

const TYPE_TABS: { key: TransactionType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in", label: "Cash In" },
  { key: "out", label: "Cash Out" },
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [showRange, setShowRange] = useState(Boolean(filters.from || filters.to));
  const rangeActive = Boolean(filters.from || filters.to);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
        <div className="flex shrink-0 rounded-full border border-line bg-sunken p-0.5">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onChange({ ...filters, type: t.key })}
              className={cn(
                "press rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200",
                filters.type === t.key
                  ? t.key === "in"
                    ? "bg-jade text-white shadow-card"
                    : t.key === "out"
                      ? "bg-rose text-white shadow-card"
                      : "bg-ink text-canvas shadow-card"
                  : "text-ink3 hover:text-ink"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
          className={cn(
            "h-9 shrink-0 cursor-pointer rounded-full border border-line bg-card pl-3.5 pr-8 text-[13px] font-semibold text-ink2 outline-none transition-colors focus:border-brand",
            filters.category !== "all" && "border-brand bg-brand-soft text-brand-deep"
          )}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            if (showRange) onChange({ ...filters, from: null, to: null });
            setShowRange(!showRange);
          }}
          className={cn(
            "press flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
            rangeActive || showRange
              ? "border-brand bg-brand-soft text-brand-deep"
              : "border-line bg-card text-ink3 hover:text-ink"
          )}
        >
          {showRange ? <X className="h-3.5 w-3.5" /> : <CalendarRange className="h-3.5 w-3.5" />}
          Dates
        </button>
      </div>

      {showRange ? (
        <div className="flex items-center gap-2 animate-fade-in">
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => onChange({ ...filters, from: e.target.value || null })}
            className="h-10 flex-1 rounded-xl border border-line bg-card px-3 text-[13px] text-ink outline-none focus:border-brand"
            aria-label="From date"
          />
          <span className="text-xs text-ink3">to</span>
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => onChange({ ...filters, to: e.target.value || null })}
            className="h-10 flex-1 rounded-xl border border-line bg-card px-3 text-[13px] text-ink outline-none focus:border-brand"
            aria-label="To date"
          />
        </div>
      ) : null}
    </div>
  );
}
