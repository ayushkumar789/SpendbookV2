"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, FileText, HandCoins, Pencil, Plus, Share2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { SpendingBarChart } from "@/components/dashboard/SpendingBarChart";
import { CategoryPieChart } from "@/components/dashboard/CategoryPieChart";
import { FilterBar } from "@/components/transactions/FilterBar";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdaptiveDialog } from "@/components/ui/Modal";
import { RowSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { ShareModal } from "@/components/shared/ShareModal";
import { PullIndicator, usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useTransactions } from "@/hooks/useTransactions";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { deleteTransaction, getBook } from "@/lib/database";
import { getBookSplitSummary, type BookSplitSummary } from "@/lib/features/splits";
import { getContacts } from "@/lib/features/contacts";
import { exportBookExcel, exportBookPdf } from "@/lib/export";
import { bookColorHex } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { formatCurrency } from "@/lib/helpers";
import { SplashScreen } from "@/components/ui/LoadingSpinner";
import type { Book, Transaction } from "@/types";
import type { Contact, TransactionFiltersV4, TransactionV4 } from "@/types/features";

const PAGE_SIZE = 30;

export default function BookDetailPage() {
  return (
    <AppShell>
      <Suspense fallback={<SplashScreen />}>
        <BookDetailContent />
      </Suspense>
    </AppShell>
  );
}

function BookDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("tx");
  const { toast } = useToast();

  const { user } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [splitSummary, setSplitSummary] = useState<BookSplitSummary | null>(null);
  const { transactions, loading: txLoading, refresh } = useTransactions(params.id);
  const { methods } = usePaymentMethods();

  const [filters, setFilters] = useState<TransactionFiltersV4>({ type: "all", category: "all", from: null, to: null });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadBook = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([getBook(params.id), getBookSplitSummary(params.id).catch(() => null)]);
      setBook(b);
      setSplitSummary(s);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load book", "error");
    } finally {
      setBookLoading(false);
    }
  }, [params.id, toast]);

  useEffect(() => {
    void loadBook();
  }, [loadBook]);

  useEffect(() => {
    if (!user) return;
    getContacts(user.id)
      .then(setContacts)
      .catch(() => setContacts([]));
  }, [user]);

  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), loadBook()]);
  }, [refresh, loadBook]);
  const { pull, refreshing } = usePullToRefresh(refreshAll);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filters.type !== "all" && t.type !== filters.type) return false;
      if (filters.category !== "all" && t.category !== filters.category) return false;
      if (filters.from && t.date < filters.from) return false;
      if (filters.to && t.date > filters.to) return false;
      return true;
    });
  }, [transactions, filters]);

  // Reset the window when filters change; grow it via the scroll sentinel.
  useEffect(() => setVisibleCount(PAGE_SIZE), [filters]);

  // Arriving from global search: make sure the row is rendered, then scroll to it.
  useEffect(() => {
    if (!highlightId || transactions.length === 0) return;
    const idx = filtered.findIndex((t) => t.id === highlightId);
    if (idx >= 0) {
      setVisibleCount((c) => Math.max(c, idx + PAGE_SIZE));
      window.setTimeout(() => {
        document
          .querySelector(`[data-txn-id="${highlightId}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 350);
    }
  }, [highlightId, transactions.length, filtered]);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisibleCount((c) => c + PAGE_SIZE);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [filtered.length]);

  const cashIn = useMemo(
    () => transactions.filter((t) => t.type === "in").reduce((s, t) => s + Number(t.amount), 0),
    [transactions]
  );
  const cashOut = useMemo(
    () => transactions.filter((t) => t.type === "out").reduce((s, t) => s + Number(t.amount), 0),
    [transactions]
  );

  const rangeLabel = useMemo(() => {
    if (filters.from || filters.to) {
      const fromLabel = filters.from ? format(parseISO(filters.from), "d MMM yyyy") : "beginning";
      const toLabel = filters.to ? format(parseISO(filters.to), "d MMM yyyy") : "today";
      return `${fromLabel} — ${toLabel}`;
    }
    return "All time";
  }, [filters.from, filters.to]);

  const handleExport = (kind: "pdf" | "excel"): void => {
    if (!book) return;
    try {
      const ctx = { book, transactions: filtered, methods, rangeLabel };
      if (kind === "pdf") exportBookPdf(ctx);
      else exportBookExcel(ctx);
      setExportOpen(false);
      toast(kind === "pdf" ? "PDF downloaded" : "Excel downloaded", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed", "error");
    }
  };

  const hex = book ? bookColorHex(book.color_tag) : "var(--brand)";

  return (
    <>
      <PullIndicator pull={pull} refreshing={refreshing} />
      <Header
        title={book ? `${book.icon_emoji}  ${book.name}` : "…"}
        subtitle={book?.description ?? undefined}
        back
        actions={
          <>
            <button
              onClick={() => setExportOpen(true)}
              aria-label="Export"
              title="Export"
              className="press flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink2 transition-colors hover:text-ink"
            >
              <Download className="h-[17px] w-[17px]" />
            </button>
            <button
              onClick={() => setShareOpen(true)}
              aria-label="Share"
              title="Share"
              className="press flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink2 transition-colors hover:text-ink"
              style={book?.is_shared ? { color: "var(--jade)", borderColor: "var(--jade)" } : undefined}
            >
              <Share2 className="h-[17px] w-[17px]" />
            </button>
            <button
              onClick={() => router.push(`/book/${params.id}/edit`)}
              aria-label="Edit book"
              title="Edit book"
              className="press flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink2 transition-colors hover:text-ink"
            >
              <Pencil className="h-[17px] w-[17px]" />
            </button>
          </>
        }
      />

      {/* Book color signature under the header */}
      <div aria-hidden className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${hex}, transparent 70%)` }} />

      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:px-8">
        {bookLoading || txLoading ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
            <Skeleton className="h-64 rounded-3xl" />
            <div className="card-surface rounded-3xl">
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </div>
          </>
        ) : !book ? (
          <EmptyState illustration="notfound" title="Book not found" message="It may have been deleted." />
        ) : (
          <>
            <SummaryCards cashIn={cashIn} cashOut={cashOut} />
            {book.monthly_budget && book.monthly_budget > 0 ? (
              <BudgetProgress budget={Number(book.monthly_budget)} transactions={transactions} />
            ) : null}

            {splitSummary && splitSummary.owedToYou > 0 ? (
              <div className="card-surface backlit flex items-center gap-3.5 rounded-2xl p-4 animate-fade-up">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--jade-soft)" }}>
                  <HandCoins className="h-5 w-5" style={{ color: "var(--jade)" }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    You are owed <span className="amount text-jade">{formatCurrency(splitSummary.owedToYou)}</span>
                  </p>
                  <p className="text-xs text-ink3">
                    {splitSummary.unpaidCount} unpaid {splitSummary.unpaidCount === 1 ? "share" : "shares"} from split
                    expenses in this book
                  </p>
                </div>
              </div>
            ) : null}

            {transactions.length === 0 ? (
              <EmptyState
                illustration="transactions"
                title="A fresh page"
                message="Record your first cash in or cash out — the charts will bloom as the story grows."
                action={
                  <Button
                    size="lg"
                    icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
                    onClick={() => router.push(`/transaction/add?bookId=${params.id}`)}
                  >
                    Add transaction
                  </Button>
                }
              />
            ) : (
              <>
                <SpendingBarChart transactions={transactions} />
                <CategoryPieChart transactions={transactions} />

                <div className="card-surface overflow-hidden rounded-3xl">
                  <div className="border-b border-line p-4">
                    <FilterBar filters={filters} onChange={setFilters} />
                  </div>
                  {filtered.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-ink3">No transactions match these filters.</p>
                  ) : (
                    <div className="divide-y divide-line">
                      {filtered.slice(0, visibleCount).map((t) => (
                        <TransactionRow
                          key={t.id}
                          txn={t}
                          methods={methods}
                          contact={contactById.get((t as TransactionV4).contact_id ?? "") ?? null}
                          hasSplit={splitSummary?.transactionIds.has(t.id) ?? false}
                          highlight={t.id === highlightId}
                          onEdit={(txn) => router.push(`/transaction/${txn.id}/edit?bookId=${params.id}`)}
                          onDelete={setPendingDelete}
                        />
                      ))}
                      {visibleCount < filtered.length ? (
                        <div ref={sentinelRef} className="flex justify-center py-4">
                          <RowSkeleton />
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Add transaction — FAB on mobile, pinned button on desktop */}
      {book ? (
        <>
          <button
            onClick={() => router.push(`/transaction/add?bookId=${params.id}`)}
            aria-label="Add transaction"
            className="shimmer-border press fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-nav transition-transform hover:scale-105 md:hidden"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>
          <div className="fixed bottom-8 right-8 z-40 hidden md:block">
            <Button
              size="lg"
              icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
              onClick={() => router.push(`/transaction/add?bookId=${params.id}`)}
              className="shadow-nav"
            >
              Add transaction
            </Button>
          </div>
        </>
      ) : null}

      {book ? <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} book={book} onBookChange={setBook} /> : null}

      <AdaptiveDialog open={exportOpen} onClose={() => setExportOpen(false)} title="Export this book">
        <p className="mb-4 text-sm leading-relaxed text-ink2">
          Exports the <span className="font-semibold text-ink">{filtered.length}</span> transactions currently in
          view ({rangeLabel}) with summary totals.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleExport("pdf")}
            className="press flex flex-col items-center gap-2.5 rounded-2xl border border-line bg-card p-5 transition-all hover:border-brand hover:bg-brand-soft"
          >
            <FileText className="h-7 w-7 text-rose" />
            <span className="text-sm font-bold text-ink">PDF</span>
            <span className="text-xs text-ink3">Clean printable report</span>
          </button>
          <button
            onClick={() => handleExport("excel")}
            className="press flex flex-col items-center gap-2.5 rounded-2xl border border-line bg-card p-5 transition-all hover:border-brand hover:bg-brand-soft"
          >
            <FileSpreadsheet className="h-7 w-7 text-jade" />
            <span className="text-sm font-bold text-ink">Excel</span>
            <span className="text-xs text-ink3">Full data as .xlsx</span>
          </button>
        </div>
      </AdaptiveDialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this transaction?"
        message="This entry will be removed from the book permanently."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteTransaction(pendingDelete.id);
          setPendingDelete(null);
          toast("Transaction deleted", "info");
          await refresh();
        }}
      />
    </>
  );
}
