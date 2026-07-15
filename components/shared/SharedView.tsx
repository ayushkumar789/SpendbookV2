"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { getSharedBook, getSharedTransactions, subscribeToSharedBook } from "@/lib/database";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SplashScreen } from "@/components/ui/LoadingSpinner";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { SpendingBarChart } from "@/components/dashboard/SpendingBarChart";
import { CategoryPieChart } from "@/components/dashboard/CategoryPieChart";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { SetupNotice } from "@/components/layout/AppShell";
import type { SharedBook, Transaction } from "@/types";

/** Public, read-only, realtime view of a shared book. No login required. */
export function SharedView({ shareId }: { shareId: string }) {
  const router = useRouter();
  const [book, setBook] = useState<SharedBook | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "gone">("loading");

  const load = useCallback(async () => {
    try {
      const b = await getSharedBook(shareId);
      if (!b || !b.is_shared) {
        setState("gone");
        return;
      }
      setBook(b);
      setTransactions(await getSharedTransactions(b.id));
      setState("ready");
    } catch {
      setState("gone");
    }
  }, [shareId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!book) return;
    return subscribeToSharedBook(book.id, () => void load());
  }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSupabaseConfigured()) return <SetupNotice />;
  if (state === "loading") return <SplashScreen />;

  if (state === "gone" || !book) {
    return (
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
        <EmptyState
          illustration="notfound"
          title="This book is no longer shared"
          message="The owner stopped sharing it, or the link has been reset."
          action={
            <Button icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.push("/")}>
              Back to SpendBook
            </Button>
          }
        />
      </div>
    );
  }

  const cashIn = transactions.filter((t) => t.type === "in").reduce((s, t) => s + Number(t.amount), 0);
  const cashOut = transactions.filter((t) => t.type === "out").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="relative z-10 min-h-screen pb-16">
      <header className="glass-surface sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8">
          <span className="text-2xl">{book.icon_emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-lg tracking-tight text-ink md:text-xl">
                {book.name}
              </h1>
              <Badge tone="live">Live</Badge>
            </div>
            <p className="truncate text-xs text-ink3">
              Shared by {book.owner?.display_name ?? "a SpendBook user"}
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:px-8">
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-brand-soft px-4 py-3 text-sm font-medium text-brand-deep animate-fade-in">
          <Eye className="h-4 w-4 shrink-0" />
          You&apos;re viewing a read-only ledger. It updates in real time.
        </div>

        <SummaryCards cashIn={cashIn} cashOut={cashOut} />
        <SpendingBarChart transactions={transactions} />
        <CategoryPieChart transactions={transactions} />

        <div className="card-surface overflow-hidden rounded-3xl">
          <p className="label-caps border-b border-line px-4 py-3">
            {transactions.length} {transactions.length === 1 ? "transaction" : "transactions"}
          </p>
          {transactions.length === 0 ? (
            <EmptyState
              illustration="transactions"
              title="Nothing here yet"
              message="Entries will appear the moment the owner adds them."
            />
          ) : (
            <div className="divide-y divide-line">
              {transactions.map((t) => (
                <TransactionRow key={t.id} txn={t} methods={[]} readOnly />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
