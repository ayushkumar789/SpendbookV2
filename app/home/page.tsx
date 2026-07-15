"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { BookCard } from "@/components/books/BookCard";
import { BookCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PullIndicator, usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useBooks } from "@/hooks/useBooks";
import { useAuth } from "@/hooks/useAuth";

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
  const { books, loading, error, refresh } = useBooks();
  const router = useRouter();
  const { pull, refreshing } = usePullToRefresh(refresh);

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
            {books.map((b, i) => (
              <BookCard key={b.id} book={b} index={i} />
            ))}
          </div>
        )}
      </main>

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
