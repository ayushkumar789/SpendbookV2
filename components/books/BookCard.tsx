"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Share2 } from "lucide-react";
import { bookColorHex } from "@/lib/constants";
import { cn, formatCurrencyCompact } from "@/lib/helpers";
import type { BookWithStats } from "@/types";

export function BookCard({ book, index }: { book: BookWithStats; index: number }) {
  const hex = bookColorHex(book.color_tag);
  const negative = book.stats.net < 0;

  return (
    <Link
      href={`/book/${book.id}`}
      className="card-surface card-lift shimmer-card group relative block overflow-hidden rounded-3xl p-5 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
    >
      {/* The book's color tag becomes a large soft glow living inside the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-24 h-64 w-64 rounded-full opacity-[0.22] blur-3xl transition-all duration-500 group-hover:opacity-[0.38] group-hover:scale-110"
        style={{ background: `radial-gradient(circle, ${hex}, transparent 68%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full opacity-[0.1] blur-3xl"
        style={{ background: `radial-gradient(circle, ${hex}, transparent 70%)` }}
      />

      <div className="relative flex items-start gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl transition-transform duration-300 group-hover:scale-105"
          style={{
            background: `color-mix(in srgb, ${hex} 16%, var(--card-hi))`,
            border: `1px solid color-mix(in srgb, ${hex} 38%, transparent)`,
            boxShadow: `0 0 22px -8px ${hex}`,
          }}
        >
          {book.icon_emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-[22px] tracking-tight text-ink">{book.name}</h3>
            {book.is_shared ? <Share2 className="h-3.5 w-3.5 shrink-0 text-jade" /> : null}
          </div>
          <p className="truncate text-[13px] text-ink3">
            {book.description || `${book.stats.count} ${book.stats.count === 1 ? "entry" : "entries"}`}
          </p>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-jade-soft px-3 py-2.5">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-jade">
            <ArrowDownLeft className="h-3 w-3" /> In
          </p>
          <p className="amount mt-0.5 truncate text-[15px] font-semibold text-jade">
            {formatCurrencyCompact(book.stats.cashIn)}
          </p>
        </div>
        <div className="rounded-xl bg-rose-soft px-3 py-2.5">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-rose">
            <ArrowUpRight className="h-3 w-3" /> Out
          </p>
          <p className="amount mt-0.5 truncate text-[15px] font-semibold text-rose">
            {formatCurrencyCompact(book.stats.cashOut)}
          </p>
        </div>
        <div className="rounded-xl bg-card-hi px-3 py-2.5 border border-line">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink3">Net</p>
          <p className={cn("amount mt-0.5 truncate text-[15px] font-semibold", negative ? "text-rose" : "text-ink")}>
            {formatCurrencyCompact(book.stats.net)}
          </p>
        </div>
      </div>
    </Link>
  );
}
