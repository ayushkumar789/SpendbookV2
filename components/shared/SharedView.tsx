"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  BookUser,
  CalendarDays,
  Camera,
  Eye,
  LogIn,
  Pencil,
  Plus,
  Repeat,
  ScanEye,
  StickyNote,
  Users,
  X,
} from "lucide-react";
import { getSharedTransactions, subscribeToSharedBook } from "@/lib/database";
import {
  getSharedContacts,
  getSharedPaymentMethods,
  rememberReturnPath,
  resolveShareAccess,
  saveSharedBook,
} from "@/lib/features/sharing";
import { getSplitsForTransaction } from "@/lib/features/splits";
import { getReceiptSignedUrl } from "@/lib/features/receipts";
import { isSupabaseConfigured } from "@/lib/supabase";
import { PAYMENT_TYPE_LABEL } from "@/lib/constants";
import { formatCurrency, formatDate, methodLabel } from "@/lib/helpers";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SplashScreen } from "@/components/ui/LoadingSpinner";
import { OVERLAY_STYLE, PANEL_STYLE, useBodyScrollLock } from "@/components/ui/overlay";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { SpendingBarChart } from "@/components/dashboard/SpendingBarChart";
import { CategoryPieChart } from "@/components/dashboard/CategoryPieChart";
import { SetupNotice } from "@/components/layout/AppShell";
import type { PaymentMethod, Transaction } from "@/types";
import type { Contact, SharedBookAccess, Split, TransactionV4 } from "@/types/features";

/** Live view of a shared book. Renders one of three access levels:
 *  view (redacted, read-only) · details (full read + drill-down) ·
 *  edit (full-page add/edit, sign-in required). */
export function SharedView({ shareId }: { shareId: string }) {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  const [access, setAccess] = useState<SharedBookAccess | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "gone" | "signin">("loading");
  const [detailTxn, setDetailTxn] = useState<TransactionV4 | null>(null);
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

  // view: rows are inert · details: tap opens the detail overlay ·
  // edit: tap opens the full-page editor (same form as the owner's).
  const handleRowTap = (txn: TransactionV4): void => {
    if (level === "details") setDetailTxn(txn);
    else if (canEdit) router.push(`/shared/${shareId}/transaction/${txn.id}/edit`);
  };

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
              ? "You're viewing the full ledger — tap any entry for its complete details."
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
                  onTap={level === "view" ? undefined : handleRowTap}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {canEdit ? (
        <button
          onClick={() => router.push(`/shared/${shareId}/transaction/add`)}
          aria-label="Add transaction"
          className="shimmer-border press fixed bottom-8 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-nav transition-transform hover:scale-105"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      ) : null}

      {detailTxn ? (
        <SharedTransactionDetail
          txn={detailTxn}
          methods={methods}
          contact={contactById.get(detailTxn.contact_id ?? "") ?? null}
          onClose={() => setDetailTxn(null)}
        />
      ) : null}
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
  onTap,
}: {
  txn: TransactionV4;
  level: "view" | "details" | "edit";
  methods: PaymentMethod[];
  contact: Contact | null;
  onTap?: (txn: TransactionV4) => void;
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
    <div
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
      onClick={onTap ? () => onTap(txn) : undefined}
      onKeyDown={
        onTap
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onTap(txn);
            }
          : undefined
      }
      className={`row-sweep relative flex items-center gap-3 py-3.5 pl-3.5 pr-4 ${onTap ? "cursor-pointer" : ""}`}
      style={{ boxShadow: `inset 3px 0 0 ${accentChart}` }}
    >
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
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">{isTransfer ? "Transfer" : txn.category}</span>
          {txn.is_recurring ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-deep">
              <Repeat className="h-2.5 w-2.5" /> {txn.recurrence_interval}
            </span>
          ) : null}
          {!redacted && txn.receipt_url ? (
            <Camera className="h-3.5 w-3.5 shrink-0 text-ink3" aria-label="Receipt attached" />
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink3">{details.join(" · ")}</p>
      </div>

      <p className="amount shrink-0 text-[15px] font-semibold" style={{ color: accent }}>
        {isTransfer ? "" : isIn ? "+" : "−"}
        {formatCurrency(Number(txn.amount))}
      </p>
    </div>
  );
}

/* ————— Full detail overlay (Details access) ————— */

function SharedTransactionDetail({
  txn,
  methods,
  contact,
  onClose,
}: {
  txn: TransactionV4;
  methods: PaymentMethod[];
  contact: Contact | null;
  onClose: () => void;
}) {
  const type = txn.type as "in" | "out" | "transfer";
  const isTransfer = type === "transfer";
  const isIn = type === "in";
  const accent = isTransfer ? "var(--sky)" : isIn ? "var(--jade)" : "var(--rose)";
  const accentSoft = isTransfer ? "var(--sky-soft)" : isIn ? "var(--jade-soft)" : "var(--rose-soft)";

  const [splits, setSplits] = useState<Split[]>([]);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  useBodyScrollLock(true);

  useEffect(() => {
    getSplitsForTransaction(txn.id)
      .then(setSplits)
      .catch(() => setSplits([]));
    if (txn.receipt_url) {
      getReceiptSignedUrl(txn.receipt_url)
        .then(setReceiptUrl)
        .catch(() => setReceiptUrl(null));
    }
  }, [txn.id, txn.receipt_url]);

  const methodFor = (id: string | null | undefined): PaymentMethod | null =>
    id ? (methods.find((m) => m.id === id) ?? null) : null;

  const methodDetail = (m: PaymentMethod | null, fallbackId: string | null | undefined): string => {
    if (!m) return fallbackId ? "Deleted method" : "Cash / Not specified";
    const kind = m.payment_type === "upi" ? `UPI · ${m.upi_app_name ?? "UPI"}` : PAYMENT_TYPE_LABEL[m.payment_type];
    return `${m.bank_name} · ${kind} · ····${m.last_four_digits}`;
  };

  return (
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div role="dialog" aria-modal="true" style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ background: accentSoft, color: accent }}
          >
            {isTransfer ? (
              <ArrowLeftRight className="h-3 w-3" />
            ) : isIn ? (
              <ArrowDownLeft className="h-3 w-3" />
            ) : (
              <ArrowUpRight className="h-3 w-3" />
            )}
            {isTransfer ? "Transfer" : isIn ? "Cash In" : "Cash Out"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press -mr-1 -mt-1 rounded-full p-2 text-ink3 transition-colors hover:bg-sunken hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Amount */}
        <p className="amount text-center font-display text-4xl font-semibold tracking-tight" style={{ color: accent }}>
          {isTransfer ? "" : isIn ? "+" : "−"}
          {formatCurrency(Number(txn.amount))}
        </p>
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-sm text-ink3">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(txn.date, "EEEE, d MMMM yyyy")}
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {/* Category + recurring */}
          <div className="flex flex-wrap items-center gap-2">
            {!isTransfer ? (
              <span className="rounded-full border border-transparent bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-on-brand">
                {txn.category}
              </span>
            ) : null}
            {txn.is_recurring ? (
              <span className="flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-deep">
                <Repeat className="h-3 w-3" /> Repeats {txn.recurrence_interval}
              </span>
            ) : null}
          </div>

          {/* Payment method — full details at this access level */}
          {isTransfer ? (
            <>
              <DetailRow
                icon={<Banknote className="h-4 w-4 text-brand-deep" />}
                label="From account"
                value={methodDetail(methodFor(txn.payment_method_id), txn.payment_method_id)}
              />
              <DetailRow
                icon={<Banknote className="h-4 w-4 text-brand-deep" />}
                label="To account"
                value={methodDetail(methodFor(txn.transfer_to_payment_method_id), txn.transfer_to_payment_method_id)}
              />
            </>
          ) : (
            <DetailRow
              icon={<Banknote className="h-4 w-4 text-brand-deep" />}
              label="Paid via"
              value={methodDetail(methodFor(txn.payment_method_id), txn.payment_method_id)}
            />
          )}

          {contact ? (
            <DetailRow
              icon={<BookUser className="h-4 w-4 text-brand-deep" />}
              label={isIn ? "Received from" : "Paid to"}
              value={contact.name}
            />
          ) : null}

          {txn.note ? (
            <DetailRow icon={<StickyNote className="h-4 w-4 text-brand-deep" />} label="Note" value={txn.note} />
          ) : null}

          {/* Splits */}
          {splits.length > 0 ? (
            <div className="rounded-2xl border border-line bg-card-hi p-3.5">
              <p className="label-caps mb-2.5 flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Split between {splits.length}
              </p>
              <div className="flex flex-col gap-2">
                {splits.map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-deep">
                      {s.person_name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.person_name}</span>
                    <span className="amount text-sm text-ink2">{formatCurrency(Number(s.amount))}</span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
                      style={
                        s.paid_back
                          ? { background: "var(--jade-soft)", color: "var(--jade)" }
                          : { background: "var(--sunken)", color: "var(--ink3)" }
                      }
                    >
                      {s.paid_back ? "Paid back" : "Owes"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Receipt */}
          {txn.receipt_url ? (
            receiptUrl ? (
              <button
                type="button"
                onClick={() => setReceiptOpen(true)}
                className="press w-fit overflow-hidden rounded-xl border border-line"
                aria-label="View receipt"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptUrl} alt="Receipt" className="h-24 w-24 object-cover" />
              </button>
            ) : (
              <DetailRow
                icon={<Camera className="h-4 w-4 text-brand-deep" />}
                label="Receipt"
                value="Attached — loading…"
              />
            )
          ) : null}
        </div>

        {/* Full-screen receipt viewer */}
        {receiptOpen && receiptUrl ? (
          <div
            style={{ ...OVERLAY_STYLE, backgroundColor: "rgba(0,0,0,0.9)" }}
            onClick={(e) => {
              e.stopPropagation();
              setReceiptOpen(false);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receiptUrl} alt="Receipt full view" className="max-h-full max-w-full rounded-2xl object-contain" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card-hi px-3.5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="label-caps">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
