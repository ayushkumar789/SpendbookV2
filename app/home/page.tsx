"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { BookCard } from "@/components/books/BookCard";
import { SharedBookCard } from "@/components/books/SharedBookCard";
import { BookCardSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PullIndicator, usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useBooks } from "@/hooks/useBooks";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { getTransferTotalsByBook } from "@/lib/features/insights";
import { clearPrimaryBook, getPrimaryBook, setPrimaryBook } from "@/lib/features/accounts";
import { getSavedSharedBookCards, removeSavedSharedBook } from "@/lib/features/sharing";
import type { SavedSharedBookCard } from "@/types/features";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  return (
    <AppShell>
      <HomeContent />
    </AppShell>
  );
}

function HomeContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { books, loading, error, refresh } = useBooks();
  const router = useRouter();

  // Books other people shared with this user (saved via shared links/codes).
  const [sharedCards, setSharedCards] = useState<SavedSharedBookCard[]>([]);
  const [pendingRemove, setPendingRemove] = useState<SavedSharedBookCard | null>(null);
  const loadShared = useMemo(
    () => async () => {
      if (!user) return;
      try {
        setSharedCards(await getSavedSharedBookCards(user.id));
      } catch {
        setSharedCards([]);
      }
    },
    [user]
  );
  useEffect(() => {
    void loadShared();
  }, [loadShared]);

  // The primary book: the one book balance calculations track.
  const [primaryBookId, setPrimaryBookId] = useState<string | null>(null);
  const [primaryBusy, setPrimaryBusy] = useState(false);
  const [pendingUnsetPrimary, setPendingUnsetPrimary] = useState<{ id: string; name: string } | null>(null);
  const loadPrimary = useMemo(
    () => async () => {
      if (!user) return;
      try {
        setPrimaryBookId((await getPrimaryBook(user.id))?.id ?? null);
      } catch {
        setPrimaryBookId(null);
      }
    },
    [user]
  );
  useEffect(() => {
    void loadPrimary();
  }, [loadPrimary]);

  const handleTogglePrimary = (book: { id: string; name: string }): void => {
    if (!user || primaryBusy) return;
    if (book.id === primaryBookId) {
      setPendingUnsetPrimary(book);
      return;
    }
    if (primaryBookId !== null) return; // stars are locked while another book is primary
    setPrimaryBusy(true);
    setPrimaryBook(user.id, book.id)
      .then(() => {
        setPrimaryBookId(book.id);
        toast(`Primary book set. Balance will now track ${book.name}.`, "success");
      })
      .catch((e: unknown) =>
        toast(e instanceof Error ? e.message : "Could not set the primary book", "error")
      )
      .finally(() => setPrimaryBusy(false));
  };

  const refreshAll = useMemo(
    () => async () => {
      await Promise.all([refresh(), loadShared(), loadPrimary()]);
    },
    [refresh, loadShared, loadPrimary]
  );
  const { pull, refreshing } = usePullToRefresh(refreshAll);

  // The frozen book-stats query counts self transfers as Cash Out;
  // strip them back out so the cards show true totals.
  const [transferTotals, setTransferTotals] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!user) return;
    getTransferTotalsByBook(user.id)
      .then(setTransferTotals)
      .catch(() => setTransferTotals(new Map()));
  }, [user, books]);

  const adjustedBooks = useMemo(
    () =>
      books.map((b) => {
        const transfers = transferTotals.get(b.id) ?? 0;
        if (transfers === 0) return b;
        const cashOut = b.stats.cashOut - transfers;
        return { ...b, stats: { ...b.stats, cashOut, net: b.stats.cashIn - cashOut } };
      }),
    [books, transferTotals]
  );

  // Desktop shortcut: N → new book
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        router.push("/book/create");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const firstName = ((user?.user_metadata.full_name as string | undefined) ?? "").split(" ")[0];

  return (
    <>
      <PullIndicator pull={pull} refreshing={refreshing} />
      <Header
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        subtitle="Your ledgers, at a glance"
        hero
        actions={
          <>
            <Link
              href="/shared/enter-code"
              title="Open a shared book"
              className="press flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink2 transition-colors hover:text-ink"
            >
              <KeyRound className="h-[17px] w-[17px]" />
            </Link>
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
              onClick={() => router.push("/book/create")}
              className="hidden sm:inline-flex"
              title="New book (N)"
            >
              New book
            </Button>
          </>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {error ? (
          <div className="rounded-2xl border border-line bg-rose-soft px-4 py-3 text-sm font-medium text-rose">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <BookCardSkeleton />
            <BookCardSkeleton />
            <BookCardSkeleton />
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            illustration="books"
            title="Start your first book"
            message="A book is one ledger — Home Expenses, Trip to Goa, the family business. Keep each story separate."
            action={
              <Button size="lg" icon={<Plus className="h-4 w-4" strokeWidth={2.5} />} onClick={() => router.push("/book/create")}>
                Create a book
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {adjustedBooks.map((b, i) => (
              <BookCard
                key={b.id}
                book={b}
                index={i}
                primary={{
                  isPrimary: b.id === primaryBookId,
                  hasPrimary: primaryBookId !== null,
                  onToggle: () => handleTogglePrimary(b),
                }}
              />
            ))}
          </div>
        )}

        {/* Shared with me — hidden entirely when nothing is saved */}
        {sharedCards.length > 0 ? (
          <section className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-ink3" />
              <h2 className="label-caps">Shared with me</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sharedCards.map((c, i) => (
                <SharedBookCard key={c.id} card={c} index={i} onRemove={setPendingRemove} />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <ConfirmDialog
        open={pendingUnsetPrimary !== null}
        onClose={() => setPendingUnsetPrimary(null)}
        title="Remove primary book?"
        message="Balance calculations will pause until you select a new primary book."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!user) return;
          await clearPrimaryBook(user.id);
          setPrimaryBookId(null);
          toast("Primary book removed. Balance tracking is paused.", "info");
        }}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        title="Remove from home?"
        message={`"${pendingRemove?.live?.name ?? pendingRemove?.book_name ?? "This book"}" disappears from your home page. The owner's sharing is unaffected — you can add it back with the same link.`}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!pendingRemove || !user) return;
          await removeSavedSharedBook(user.id, pendingRemove.book_id);
          setPendingRemove(null);
          toast("Removed from your home page", "info");
          await loadShared();
        }}
      />

      {/* Mobile FAB */}
      <button
        onClick={() => router.push("/book/create")}
        aria-label="New book"
        className="shimmer-border press fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-nav transition-transform hover:scale-105 md:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>
    </>
  );
}
