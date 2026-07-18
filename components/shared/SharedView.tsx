"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Eye,
  LogIn,
  Pencil,
  Plus,
  ScanEye,
  Trash2,
  X,
} from "lucide-react";
import {
  createTransaction,
  deleteTransaction,
  getSharedTransactions,
  subscribeToSharedBook,
  updateTransaction,
} from "@/lib/database";
import {
  getSharedContacts,
  getSharedPaymentMethods,
  rememberReturnPath,
  resolveShareAccess,
  saveSharedBook,
} from "@/lib/features/sharing";
import { isSupabaseConfigured } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/constants";
import { cn, formatCurrency, formatDate, methodLabel, todayISO } from "@/lib/helpers";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldWrap, Textarea } from "@/components/ui/Input";
import { SplashScreen } from "@/components/ui/LoadingSpinner";
import { OVERLAY_STYLE, PANEL_STYLE, useBodyScrollLock } from "@/components/ui/overlay";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { SpendingBarChart } from "@/components/dashboard/SpendingBarChart";
import { CategoryPieChart } from "@/components/dashboard/CategoryPieChart";
import { SetupNotice } from "@/components/layout/AppShell";
import type { PaymentMethod, Transaction } from "@/types";
import type { Contact, SharedBookAccess, TransactionV4 } from "@/types/features";

/** Live view of a shared book. Renders one of three access levels:
 *  view (redacted, read-only) · details (full read) · edit (read + write,
 *  sign-in required). */
export function SharedView({ shareId }: { shareId: string }) {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  const [access, setAccess] = useState<SharedBookAccess | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "gone" | "signin">("loading");

  const [editorOpen, setEditorOpen] = useState<{ txn: TransactionV4 | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const savedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      const a = await resolveShareAccess(shareId);
      if (!a) {
        setState("gone");
        return;
      }
      setAccess(a);
      if (a.access_level === "edit" && !user) {
        setState("signin");
        return;
      }
      const txns = await getSharedTransactions(a.book_id);
      setTransactions(txns);
      if (a.access_level !== "view") {
        const [pm, cts] = await Promise.all([getSharedPaymentMethods(txns), getSharedContacts(txns)]);
        setMethods(pm);
        setContacts(cts);
      }
      setState("ready");
    } catch {
      setState("gone");
    }
  }, [shareId, user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [load, authLoading]);

  // Logged-in visitors get the book pinned to their home page automatically.
  useEffect(() => {
    if (!user || !access || access.owner_id === user.id || savedOnce.current) return;
    savedOnce.current = true;
    saveSharedBook(shareId)
      .then((added) => {
        if (added) toast("Added to your home page", "success");
      })
      .catch(() => undefined);
  }, [user, access, shareId, toast]);

  useEffect(() => {
    if (!access || state !== "ready") return;
    return subscribeToSharedBook(access.book_id, () => void load());
  }, [access?.book_id, state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSupabaseConfigured()) return <SetupNotice />;
  if (state === "loading" || authLoading) return <SplashScreen />;

  if (state === "gone" || !access) {
    return (
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
        <EmptyState
          illustration="notfound"
          title="This book is no longer shared"
          message="The owner stopped sharing it, paused this link, or reset it."
          action={
            <Button icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.push("/")}>
              Back to SpendBook
            </Button>
          }
        />
      </div>
    );
  }

  if (state === "signin") {
    return (
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="card-surface flex flex-col items-center gap-4 rounded-3xl p-8 text-center">
            <span className="text-4xl">{access.icon_emoji}</span>
            <div>
              <h1 className="font-display text-2xl tracking-tight text-ink">Sign in required</h1>
              <p className="mt-2 text-sm leading-relaxed text-ink2">
                <span className="font-semibold text-ink">{access.name}</span> was shared with edit access.
                Sign in to your SpendBook account to add and change transactions.
              </p>
            </div>
            <Button
              size="lg"
              icon={<LogIn className="h-4 w-4" />}
              onClick={() => {
                rememberReturnPath(`/shared/${shareId}`);
                void signInWithGoogle().catch((e) =>
                  toast(e instanceof Error ? e.message : "Sign-in failed", "error")
                );
              }}
            >
              Sign in with Google
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const level = access.access_level;
  const canEdit = level === "edit" && !!user;
  const cashIn = transactions.filter((t) => t.type === "in").reduce((s, t) => s + Number(t.amount), 0);
  const cashOut = transactions.filter((t) => t.type === "out").reduce((s, t) => s + Number(t.amount), 0);
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const editorName =
    ((user?.user_metadata.full_name as string | undefined) ?? user?.email ?? "").split("@")[0];

  return (
    <div className="relative z-10 min-h-screen pb-16">
      <header className="glass-surface sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8">
          <span className="text-2xl">{access.icon_emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-lg tracking-tight text-ink md:text-xl">{access.name}</h1>
              <AccessBadge level={level} editorName={canEdit ? editorName : undefined} />
            </div>
            <p className="truncate text-xs text-ink3">
              Shared by {access.owner_display_name ?? "a SpendBook user"}
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:px-8">
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-brand-soft px-4 py-3 text-sm font-medium text-brand-deep animate-fade-in">
          {level === "edit" ? <Pencil className="h-4 w-4 shrink-0" /> : level === "details" ? <ScanEye className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
          {level === "edit"
            ? "You can add, edit and delete entries in this shared book. It updates in real time."
            : level === "details"
              ? "You're viewing the full ledger — payment methods, contacts and notes included."
              : "You're viewing a read-only ledger. It updates in real time."}
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
              message="Entries will appear the moment they're added."
            />
          ) : (
            <div className="divide-y divide-line">
              {transactions.map((t) => (
                <SharedTransactionRow
                  key={t.id}
                  txn={t as TransactionV4}
                  level={level}
                  methods={methods}
                  contact={contactById.get((t as TransactionV4).contact_id ?? "") ?? null}
                  onEdit={canEdit ? (txn) => setEditorOpen({ txn }) : undefined}
                  onDelete={canEdit ? setPendingDelete : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {canEdit ? (
        <button
          onClick={() => setEditorOpen({ txn: null })}
          aria-label="Add transaction"
          className="shimmer-border press fixed bottom-8 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-nav transition-transform hover:scale-105"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      ) : null}

      {canEdit && editorOpen ? (
        <SharedTransactionEditor
          bookId={access.book_id}
          initial={editorOpen.txn}
          onClose={() => setEditorOpen(null)}
          onSaved={async () => {
            setEditorOpen(null);
            toast(editorOpen.txn ? "Transaction updated" : "Transaction added", "success");
            await load();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this transaction?"
        message="This entry will be removed from the shared book permanently."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteTransaction(pendingDelete.id);
          setPendingDelete(null);
          toast("Transaction deleted", "info");
          await load();
        }}
      />
    </div>
  );
}

/* ————— Access level badge ————— */

function AccessBadge({ level, editorName }: { level: "view" | "details" | "edit"; editorName?: string }) {
  if (level === "view") return <Badge tone="neutral">View only</Badge>;
  if (level === "details") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ background: "var(--sky-soft)", color: "var(--sky)" }}
      >
        Full details
      </span>
    );
  }
  return <Badge tone="jade">Editor{editorName ? ` · ${editorName}` : ""}</Badge>;
}

/* ————— Transaction row with per-level redaction ————— */

function SharedTransactionRow({
  txn,
  level,
  methods,
  contact,
  onEdit,
  onDelete,
}: {
  txn: TransactionV4;
  level: "view" | "details" | "edit";
  methods: PaymentMethod[];
  contact: Contact | null;
  onEdit?: (txn: TransactionV4) => void;
  onDelete?: (txn: Transaction) => void;
}) {
  const type = txn.type as "in" | "out" | "transfer";
  const isTransfer = type === "transfer";
  const isIn = type === "in";
  const accent = isTransfer ? "var(--sky)" : isIn ? "var(--jade)" : "var(--rose)";
  const accentChart = isTransfer ? "var(--sky-chart)" : isIn ? "var(--jade-chart)" : "var(--rose-chart)";
  const accentSoft = isTransfer ? "var(--sky-soft)" : isIn ? "var(--jade-soft)" : "var(--rose-soft)";
  const redacted = level === "view";

  const methodText = (id: string | null | undefined): string => {
    if (redacted) return id ? "Hidden" : "Cash";
    return methodLabel(id ?? null, methods);
  };
  const personText = contact ? (redacted ? "Hidden" : contact.name) : null;

  const details: string[] = [formatDate(txn.date)];
  if (isTransfer) {
    details.push(redacted ? "Between own accounts" : `${methodText(txn.payment_method_id)} → ${methodText(txn.transfer_to_payment_method_id)}`);
  } else {
    details.push(methodText(txn.payment_method_id));
    if (personText) details.push(personText);
    if (!redacted && txn.note) details.push(txn.note);
  }

  return (
    <div className="row-sweep relative flex items-center gap-3 py-3.5 pl-3.5 pr-4" style={{ boxShadow: `inset 3px 0 0 ${accentChart}` }}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: accentSoft }}>
        {isTransfer ? (
          <ArrowLeftRight size={18} style={{ color: "var(--sky)" }} />
        ) : isIn ? (
          <ArrowDownLeft size={18} style={{ color: "var(--jade)" }} />
        ) : (
          <ArrowUpRight size={18} style={{ color: "var(--rose)" }} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{isTransfer ? "Transfer" : txn.category}</p>
        <p className="mt-0.5 truncate text-xs text-ink3">{details.join(" · ")}</p>
      </div>

      <p className="amount shrink-0 text-[15px] font-semibold" style={{ color: accent }}>
        {isTransfer ? "" : isIn ? "+" : "−"}
        {formatCurrency(Number(txn.amount))}
      </p>

      {onEdit && !isTransfer ? (
        <button
          onClick={() => onEdit(txn)}
          aria-label="Edit transaction"
          className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink3 transition-colors hover:bg-card-hi hover:text-ink"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {onDelete ? (
        <button
          onClick={() => onDelete(txn)}
          aria-label="Delete transaction"
          className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink3 transition-colors hover:bg-rose-soft hover:text-rose"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/* ————— Compact add/edit form for editors ————— */
/* Editors record plain in/out entries (no transfers, splits, receipts or
 * recurrence — those lean on the owner's private data). Rows are written
 * with the editor's own user id so RLS accepts them. */

function SharedTransactionEditor({
  bookId,
  initial,
  onClose,
  onSaved,
}: {
  bookId: string;
  initial: TransactionV4 | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [type, setType] = useState<"in" | "out">(initial?.type === "in" ? "in" : "out");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [category, setCategory] = useState(initial?.category ?? (CATEGORIES[0] as string));
  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useBodyScrollLock(true);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const parsed = Number(amount.replace(/,/g, "")) || 0;
    if (parsed <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (!user) return;
    setBusy(true);
    try {
      if (initial) {
        await updateTransaction(initial.id, { type, amount: parsed, category, note: note.trim() || null, date });
      } else {
        await createTransaction(user.id, {
          book_id: bookId,
          type,
          amount: parsed,
          category,
          payment_method_id: null,
          note: note.trim() || null,
          date,
          is_recurring: false,
          recurrence_interval: null,
          next_recurrence_date: null,
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div role="dialog" aria-modal="true" style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl tracking-tight text-ink">
            {initial ? "Edit transaction" : "Add transaction"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press -mr-1 -mt-1 rounded-full p-2 text-ink3 transition-colors hover:bg-sunken hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 rounded-2xl border border-line bg-sunken p-1">
            {(
              [
                { key: "in" as const, label: "Cash In" },
                { key: "out" as const, label: "Cash Out" },
              ]
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className={cn(
                  "press rounded-xl py-2.5 text-[14px] font-bold tracking-tight transition-colors",
                  type === t.key ? "text-white" : "text-ink3 hover:text-ink"
                )}
                style={type === t.key ? { background: t.key === "in" ? "var(--jade-chart)" : "var(--rose-chart)" } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>

          <FieldWrap label="Amount" error={error}>
            <div className="flex items-baseline gap-2 rounded-2xl border border-line bg-card px-5 py-3.5 focus-within:border-brand">
              <span className="font-display text-2xl" style={{ color: type === "in" ? "var(--jade)" : "var(--rose)" }}>
                ₹
              </span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={amount}
                autoFocus
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^\d.,]/g, ""));
                  setError(null);
                }}
                className="amount w-full bg-transparent text-2xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink3"
                aria-label="Amount in rupees"
              />
            </div>
          </FieldWrap>

          <FieldWrap label="Category">
            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "press shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all",
                    category === c
                      ? "border-transparent bg-brand text-on-brand"
                      : "border-line bg-card text-ink2 hover:border-line-strong"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </FieldWrap>

          <Textarea
            label="Note · optional"
            placeholder="e.g. Groceries from DMart"
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
          />

          <FieldWrap label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-line bg-card px-4 py-3 text-[15px] text-ink focus:border-brand focus:outline-none"
            />
          </FieldWrap>

          <Button type="submit" size="lg" loading={busy}>
            {initial ? "Save changes" : "Add transaction"}
          </Button>
        </form>
      </div>
    </div>
  );
}
