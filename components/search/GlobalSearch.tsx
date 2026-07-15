"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CornerDownLeft, Search } from "lucide-react";
import { searchTransactions } from "@/lib/features/search";
import { cn, formatCurrency, formatDate } from "@/lib/helpers";
import { useAuth } from "@/hooks/useAuth";
import type { SearchHit } from "@/types/features";

/**
 * Command-palette style global search across every book's transactions.
 * Ctrl/Cmd+K or the header icon opens it; arrows navigate, Enter jumps
 * to the transaction inside its book.
 */
export function GlobalSearch() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number>(0);

  // Global shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setSelected(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Debounced live search
  useEffect(() => {
    if (!open || !user) return;
    window.clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setHits([]);
      return;
    }
    setSearching(true);
    debounceRef.current = window.setTimeout(() => {
      searchTransactions(user.id, query)
        .then((results) => {
          setHits(results);
          setSelected(0);
        })
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 220);
  }, [query, open, user]);

  // Keep keyboard order == render order: group hits by book
  const groups = useMemo(() => {
    const byBook = new Map<string, { name: string; emoji: string; items: SearchHit[] }>();
    for (const h of hits) {
      const key = h.book?.id ?? h.book_id;
      const g = byBook.get(key) ?? { name: h.book?.name ?? "Unknown book", emoji: h.book?.icon_emoji ?? "📒", items: [] };
      g.items.push(h);
      byBook.set(key, g);
    }
    return [...byBook.values()];
  }, [hits]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const goTo = useCallback(
    (hit: SearchHit): void => {
      setOpen(false);
      router.push(`/book/${hit.book_id}?tx=${hit.id}`);
    },
    [router]
  );

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && flat[selected]) {
      goTo(flat[selected]);
    }
  };

  let runningIndex = -1;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search transactions (Ctrl+K)"
        title="Search (Ctrl+K)"
        className="press flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink2 transition-all hover:text-ink hover:shadow-[0_0_18px_-6px_var(--brand-glow)]"
      >
        <Search className="h-[17px] w-[17px]" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-md animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="card-surface backlit relative z-10 w-full max-w-xl overflow-hidden rounded-3xl shadow-pop animate-scale-in">
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <Search className="h-5 w-5 shrink-0 text-brand" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes, categories, amounts…"
                className="w-full bg-transparent text-lg text-ink outline-none placeholder:text-ink3"
                aria-label="Search all transactions"
              />
              <kbd className="hidden shrink-0 rounded-md border border-line bg-sunken px-2 py-0.5 text-[11px] font-semibold text-ink3 sm:block">
                ESC
              </kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto overscroll-contain">
              {query.trim() === "" ? (
                <p className="px-5 py-10 text-center text-sm text-ink3">
                  Type to search across every book — try a note, a category or an exact amount.
                </p>
              ) : searching && hits.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-ink3">Searching…</p>
              ) : flat.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-ink3">No matches for “{query}”.</p>
              ) : (
                groups.map((g) => (
                  <div key={g.name} className="pb-1">
                    <p className="label-caps sticky top-0 z-10 bg-card px-5 pb-1.5 pt-3.5">
                      {g.emoji} {g.name}
                    </p>
                    {g.items.map((hit, idx) => {
                      runningIndex += 1;
                      const i = runningIndex;
                      const isIn = hit.type === "in";
                      return (
                        <button
                          key={hit.id}
                          onClick={() => goTo(hit)}
                          onMouseEnter={() => setSelected(i)}
                          className={cn(
                            "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors animate-fade-up",
                            i === selected ? "bg-brand-soft" : "hover:bg-card-hi"
                          )}
                          style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                            style={{ background: isIn ? "var(--jade-soft)" : "var(--rose-soft)" }}
                          >
                            {isIn ? (
                              <ArrowDownLeft className="h-3.5 w-3.5" style={{ color: "var(--jade)" }} />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5" style={{ color: "var(--rose)" }} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {hit.category}
                              {hit.note ? <span className="font-normal text-ink2"> · {hit.note}</span> : null}
                            </span>
                            <span className="block text-xs text-ink3">{formatDate(hit.date)}</span>
                          </span>
                          <span className={cn("amount shrink-0 text-sm font-semibold", isIn ? "text-jade" : "text-rose")}>
                            {isIn ? "+" : "−"}
                            {formatCurrency(Number(hit.amount))}
                          </span>
                          {i === selected ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink3" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
