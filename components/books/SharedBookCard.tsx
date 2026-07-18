"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Share2, X } from "lucide-react";
import { bookColorHex } from "@/lib/constants";
import { cn, formatCurrencyCompact } from "@/lib/helpers";
import type { SavedSharedBookCard } from "@/types/features";

const LEVEL_LABEL = { view: "View", details: "Details", edit: "Edit" } as const;

/** Card for a book someone shared with the user. Tap opens the shared view;
 *  long-press (or the corner ×) offers "Remove from home". */
export function SharedBookCard({
  card,
  index,
  onRemove,
}: {
  card: SavedSharedBookCard;
  index: number;
  onRemove: (card: SavedSharedBookCard) => void;
}) {
  const router = useRouter();
  const live = card.live;
  const name = live?.name ?? card.book_name ?? "Shared book";
  const emoji = live?.icon_emoji ?? card.book_emoji ?? "📒";
  const hex = bookColorHex(live?.color_tag ?? card.book_color ?? "");

  const longPress = useRef<number | null>(null);
  const suppressTap = useRef(false);

  const startPress = (): void => {
    suppressTap.current = false;
    longPress.current = window.setTimeout(() => {
      suppressTap.current = true;
      if (navigator.vibrate) navigator.vibrate(12);
      onRemove(card);
    }, 600);
  };
  const cancelPress = (): void => {
    if (longPress.current !== null) {
      window.clearTimeout(longPress.current);
      longPress.current = null;
    }
  };

  const open = (): void => {
    if (suppressTap.current) {
      suppressTap.current = false;
      return;
    }
    if (live) router.push(`/shared/${card.share_id_used}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") open();
      }}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      className={cn(
        "card-surface card-lift group relative block cursor-pointer overflow-hidden rounded-3xl p-5 text-left animate-fade-up",
        !live && "opacity-80"
      )}
      style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-24 h-64 w-64 rounded-full opacity-[0.18] blur-3xl"
        style={{ background: `radial-gradient(circle, ${hex}, transparent 68%)` }}
      />

      {/* Shared badge + remove */}
      <div className="absolute right-4 top-4 flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink2 border border-line">
          <Share2 className="h-2.5 w-2.5" /> Shared
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(card);
          }}
          aria-label="Remove from home"
          title="Remove from home"
          className="press flex h-6 w-6 items-center justify-center rounded-full text-ink3 opacity-0 transition-opacity hover:bg-rose-soft hover:text-rose focus:opacity-100 group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative flex items-start gap-4 pr-20">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
          style={{
            background: `color-mix(in srgb, ${hex} 16%, var(--card-hi))`,
            border: `1px solid color-mix(in srgb, ${hex} 38%, transparent)`,
          }}
        >
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-[22px] tracking-tight text-ink">{name}</h3>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
              style={
                card.access_level === "edit"
                  ? { background: "var(--jade-soft)", color: "var(--jade)" }
                  : card.access_level === "details"
                    ? { background: "var(--sky-soft)", color: "var(--sky)" }
                    : { background: "var(--sunken)", color: "var(--ink3)", border: "1px solid var(--line)" }
              }
            >
              {LEVEL_LABEL[card.access_level]}
            </span>
          </div>
          <p className="truncate text-[13px] text-ink3">by {card.owner_display_name ?? "a SpendBook user"}</p>
        </div>
      </div>

      {live ? (
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-jade-soft px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-jade">
              <ArrowDownLeft className="h-3 w-3" /> In
            </p>
            <p className="amount mt-0.5 truncate text-[15px] font-semibold text-jade">
              {formatCurrencyCompact(live.stats.cashIn)}
            </p>
          </div>
          <div className="rounded-xl bg-rose-soft px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-rose">
              <ArrowUpRight className="h-3 w-3" /> Out
            </p>
            <p className="amount mt-0.5 truncate text-[15px] font-semibold text-rose">
              {formatCurrencyCompact(live.stats.cashOut)}
            </p>
          </div>
          <div className="rounded-xl bg-card-hi px-3 py-2.5 border border-line">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink3">Net</p>
            <p className={cn("amount mt-0.5 truncate text-[15px] font-semibold", live.stats.net < 0 ? "text-rose" : "text-ink")}>
              {formatCurrencyCompact(live.stats.net)}
            </p>
          </div>
        </div>
      ) : (
        <div className="relative mt-5 flex items-center justify-between gap-3 rounded-xl border border-line bg-sunken px-3.5 py-3">
          <p className="text-[13px] font-medium text-ink3">Sharing stopped by the owner</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(card);
            }}
            className="press shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-rose hover:bg-rose-soft"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
