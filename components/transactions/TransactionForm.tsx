"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Banknote,
  BookUser,
  Camera,
  ChevronRight,
  Plus,
  Repeat,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { BANKS, CATEGORIES, PAYMENT_TYPE_LABEL } from "@/lib/constants";
import { cn, formatCurrency, methodLabel, todayISO } from "@/lib/helpers";
import { nextDate } from "@/lib/recurring";
import { getReceiptSignedUrl } from "@/lib/features/receipts";
import { getContact } from "@/lib/features/contacts";
import { Button } from "@/components/ui/Button";
import { FieldWrap, Textarea } from "@/components/ui/Input";
import { AdaptiveDialog } from "@/components/ui/Modal";
import { InitialBadge } from "@/components/ui/Badge";
import { ContactAvatar, ContactPicker } from "@/components/contacts/ContactPicker";
import type { PaymentMethod, RecurrenceInterval } from "@/types";
import type {
  Contact,
  NewTransactionInputV4,
  SplitDraft,
  TransactionExtras,
  TransactionTypeV4,
  TransactionV4,
} from "@/types/features";

interface TransactionFormProps {
  bookId: string;
  initial?: TransactionV4;
  initialSplits?: SplitDraft[];
  initialReceiptPath?: string | null;
  methods: PaymentMethod[];
  submitLabel: string;
  onSubmit: (input: NewTransactionInputV4, extras: TransactionExtras) => Promise<void>;
}

const INTERVALS: RecurrenceInterval[] = ["daily", "weekly", "monthly", "yearly"];

function formatAmountTyping(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [intPart = "", ...rest] = cleaned.split(".");
  const decimals = rest.length > 0 ? "." + rest.join("").slice(0, 2) : "";
  const grouped = intPart ? new Intl.NumberFormat("en-IN").format(Number(intPart.slice(0, 12))) : "";
  return grouped + decimals;
}

function parseAmount(display: string): number {
  return Number(display.replace(/,/g, "")) || 0;
}

function equalShares(total: number, n: number): number[] {
  if (n === 0) return [];
  const base = Math.floor((total / n) * 100) / 100;
  const shares = Array.from({ length: n }, () => base);
  shares[0] = Math.round((total - base * (n - 1)) * 100) / 100;
  return shares;
}

export function TransactionForm({
  bookId,
  initial,
  initialSplits = [],
  initialReceiptPath = null,
  methods,
  submitLabel,
  onSubmit,
}: TransactionFormProps) {
  // The DB may hold 'transfer' even though the frozen core type only knows in|out.
  const initialType = (initial?.type as TransactionTypeV4 | undefined) ?? "out";
  const [type, setType] = useState<TransactionTypeV4>(initialType);
  const [amount, setAmount] = useState(initial ? formatAmountTyping(String(initial.amount)) : "");
  const [category, setCategory] = useState(
    initial && initial.category !== "Transfer" ? initial.category : (CATEGORIES[0] as string)
  );
  const [methodId, setMethodId] = useState<string | null>(
    initialType !== "transfer" ? (initial?.payment_method_id ?? null) : null
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [recurring, setRecurring] = useState(initial?.is_recurring ?? false);
  const [interval, setInterval] = useState<RecurrenceInterval>(initial?.recurrence_interval ?? "monthly");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; date?: string; split?: string; transfer?: string }>({});
  const [busy, setBusy] = useState(false);

  /* ————— Self transfer (v4) ————— */
  const [transferFrom, setTransferFrom] = useState<string | null>(
    initialType === "transfer" ? (initial?.payment_method_id ?? null) : null
  );
  const [transferTo, setTransferTo] = useState<string | null>(initial?.transfer_to_payment_method_id ?? null);
  const [transferPicker, setTransferPicker] = useState<"from" | "to" | null>(null);
  const isTransfer = type === "transfer";

  /* ————— Contact tag (v4) ————— */
  const [contact, setContact] = useState<Contact | null>(null);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [splitContactPickerOpen, setSplitContactPickerOpen] = useState(false);

  useEffect(() => {
    const cid = initial?.contact_id;
    if (!cid) return;
    getContact(cid)
      .then((c) => setContact(c))
      .catch(() => undefined);
  }, [initial?.contact_id]);

  /* ————— Splits ————— */
  const [splitOn, setSplitOn] = useState(initialSplits.length > 0);
  const [splits, setSplits] = useState<SplitDraft[]>(initialSplits);
  const [personName, setPersonName] = useState("");
  const manualShares = useRef(false);

  const total = parseAmount(amount);
  const splitSum = useMemo(() => splits.reduce((s, p) => s + (Number(p.amount) || 0), 0), [splits]);

  // Keep shares equal until the user edits one by hand.
  useEffect(() => {
    if (!splitOn || manualShares.current || splits.length === 0) return;
    const shares = equalShares(total, splits.length);
    setSplits((prev) => prev.map((p, i) => ({ ...p, amount: shares[i] ?? 0 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, splits.length, splitOn]);

  const addPerson = (): void => {
    const name = personName.trim();
    if (!name) return;
    setSplits((prev) => [...prev, { person_name: name, amount: 0, paid_back: false }]);
    setPersonName("");
    setErrors((p) => ({ ...p, split: undefined }));
  };

  /* ————— Receipt ————— */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [existingReceipt, setExistingReceipt] = useState<string | null>(initialReceiptPath);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    if (receiptFile) {
      const url = URL.createObjectURL(receiptFile);
      setReceiptPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    if (existingReceipt && !removeExisting) {
      let cancelled = false;
      getReceiptSignedUrl(existingReceipt)
        .then((url) => {
          if (!cancelled) setReceiptPreview(url);
        })
        .catch(() => setReceiptPreview(null));
      return () => {
        cancelled = true;
      };
    }
    setReceiptPreview(null);
    return undefined;
  }, [receiptFile, existingReceipt, removeExisting]);

  const selectedLabel = useMemo(() => methodLabel(methodId, methods), [methodId, methods]);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const parsed = parseAmount(amount);
    const nextErrors: typeof errors = {};
    if (parsed <= 0) nextErrors.amount = "Enter an amount greater than zero";
    if (!date) nextErrors.date = "Pick a date";
    if (isTransfer) {
      if (!transferFrom || !transferTo) nextErrors.transfer = "Pick both the From and To accounts";
      else if (transferFrom === transferTo) nextErrors.transfer = "From and To cannot be the same account";
    }
    const activeSplits = splitOn && type === "out" ? splits : [];
    if (activeSplits.length > 0 && Math.abs(splitSum - parsed) > 0.01) {
      nextErrors.split = `Shares add up to ${formatCurrency(splitSum)} — they must equal ${formatCurrency(parsed)}`;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      await onSubmit(
        {
          book_id: bookId,
          type,
          amount: parsed,
          category: isTransfer ? "Transfer" : category,
          payment_method_id: isTransfer ? transferFrom : methodId,
          note: note.trim() || null,
          date,
          // The frozen recurring engine can't copy the To-account column,
          // so transfers are never recurring.
          is_recurring: !isTransfer && recurring,
          recurrence_interval: !isTransfer && recurring ? interval : null,
          next_recurrence_date: !isTransfer && recurring ? nextDate(date, interval) : null,
          transfer_to_payment_method_id: isTransfer ? transferTo : null,
          contact_id: isTransfer ? null : (contact?.id ?? null),
        },
        {
          splits: activeSplits,
          receiptFile: isTransfer ? null : receiptFile,
          removeExistingReceipt: removeExisting && !receiptFile,
        }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
      {/* In / Out / Transfer toggle */}
      <div className="relative grid grid-cols-3 rounded-2xl border border-line bg-sunken p-1">
        {(() => {
          const idx = type === "in" ? 0 : type === "out" ? 1 : 2;
          const activeColor =
            type === "in" ? "var(--jade-chart)" : type === "out" ? "var(--rose-chart)" : "var(--sky-chart)";
          return (
            <span
              className="absolute bottom-1 top-1 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                width: "calc((100% - 0.5rem) / 3)",
                left: `calc(0.25rem + ${idx} * ((100% - 0.5rem) / 3))`,
                background: activeColor,
                boxShadow: `0 0 22px -4px ${activeColor}`,
              }}
            />
          );
        })()}
        {(
          [
            { key: "in", label: "Cash In" },
            { key: "out", label: "Cash Out" },
            { key: "transfer", label: "Transfer" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={cn(
              "press relative z-10 rounded-xl py-3 text-[14px] font-bold tracking-tight transition-colors duration-300",
              type === t.key ? "text-white" : "text-ink3 hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Amount */}
      <FieldWrap label="Amount" error={errors.amount}>
        <div
          className={cn(
            "flex items-baseline gap-2 rounded-2xl border bg-card px-5 py-4 transition-all duration-200 focus-within:ring-4",
            errors.amount
              ? "border-rose focus-within:ring-rose-soft"
              : "border-line focus-within:border-brand focus-within:ring-brand-soft focus-within:shadow-[0_0_24px_-8px_var(--brand-glow)]"
          )}
        >
          <span className="font-display text-3xl" style={{ color: type === "in" ? "var(--jade)" : "var(--rose)" }}>
            ₹
          </span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={amount}
            autoFocus={!initial}
            onChange={(e) => {
              setAmount(formatAmountTyping(e.target.value));
              if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            className="amount w-full bg-transparent text-3xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink3"
            aria-label="Amount in rupees"
          />
        </div>
      </FieldWrap>

      {/* Category chips — not needed for transfers */}
      {!isTransfer ? (
      <FieldWrap label="Category">
        <div className="relative -mx-1">
          <div
            className="hide-scrollbar flex gap-2 overflow-x-auto px-1 pb-1 pr-10"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "press shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                  category === c
                    ? "border-transparent bg-brand text-on-brand shadow-[0_0_16px_-6px_var(--brand-glow)]"
                    : "border-line bg-card text-ink2 hover:border-line-strong hover:bg-card-hi"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10"
            style={{ background: "linear-gradient(to right, transparent, var(--bg))" }}
          />
        </div>
      </FieldWrap>
      ) : null}

      {/* Transfer: From / To accounts */}
      {isTransfer ? (
        methods.length === 0 ? (
          <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-4 animate-fade-in">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--sky-soft)" }}>
              <ArrowLeftRight className="h-5 w-5" style={{ color: "var(--sky)" }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Add a payment method first</p>
              <p className="text-xs text-ink3">Transfers move money between two of your saved accounts.</p>
            </div>
            <Link
              href="/payment-methods"
              className="press shrink-0 rounded-full bg-brand px-3.5 py-2 text-[13px] font-bold text-on-brand"
            >
              Add
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-fade-in">
            {(
              [
                { key: "from" as const, label: "From account", value: transferFrom },
                { key: "to" as const, label: "To account", value: transferTo },
              ]
            ).map(({ key, label, value }) => (
              <FieldWrap key={key} label={label} error={key === "to" ? errors.transfer : undefined}>
                <button
                  type="button"
                  onClick={() => setTransferPicker(key)}
                  className={cn(
                    "press row-sweep flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-line-strong",
                    errors.transfer ? "border-rose" : "border-line"
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--sky-soft)" }}>
                    <ArrowLeftRight className="h-4 w-4" style={{ color: "var(--sky)" }} />
                  </span>
                  <span className={cn("flex-1 truncate text-sm font-semibold", value ? "text-ink" : "text-ink3")}>
                    {value ? methodLabel(value, methods) : `Choose the ${key === "from" ? "source" : "destination"} account`}
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink3" />
                </button>
              </FieldWrap>
            ))}
          </div>
        )
      ) : null}

      {/* Payment method */}
      {!isTransfer ? (
      <FieldWrap label="Paid via">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="press row-sweep flex w-full items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left transition-colors hover:border-line-strong"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft">
            <Banknote className="h-4 w-4 text-brand-deep" />
          </span>
          <span className="flex-1 truncate text-sm font-semibold text-ink">{selectedLabel}</span>
          <ChevronRight className="h-4 w-4 text-ink3" />
        </button>
      </FieldWrap>
      ) : null}

      {/* Person tag — hidden for transfers between your own accounts */}
      {!isTransfer ? (
        <FieldWrap label={type === "in" ? "Received from · optional" : "Paid to · optional"}>
          <button
            type="button"
            onClick={() => setContactPickerOpen(true)}
            className="press row-sweep flex w-full items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left transition-colors hover:border-line-strong"
          >
            {contact ? (
              <ContactAvatar name={contact.name} color={contact.avatar_color} />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sunken">
                <UserRound className="h-4 w-4 text-ink3" />
              </span>
            )}
            <span className={cn("flex-1 truncate text-sm font-semibold", contact ? "text-ink" : "text-ink3")}>
              {contact
                ? contact.name
                : type === "in"
                  ? "Who paid you? (optional)"
                  : "Who did you pay? (optional)"}
            </span>
            <ChevronRight className="h-4 w-4 text-ink3" />
          </button>
        </FieldWrap>
      ) : null}

      <Textarea
        label="Note · optional"
        placeholder="e.g. Groceries from DMart"
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
      />

      <FieldWrap label="Date" error={errors.date}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-[15px] text-ink transition-all duration-200 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-soft"
        />
      </FieldWrap>

      {/* Split expense — Cash Out only */}
      {type === "out" ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <button
            type="button"
            onClick={() => setSplitOn(!splitOn)}
            className="flex w-full items-center gap-3"
            aria-pressed={splitOn}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--jade-soft)" }}>
              <Users className="h-4 w-4" style={{ color: "var(--jade)" }} />
            </span>
            <span className="flex-1 text-left">
              <span className="block text-sm font-semibold text-ink">Split this expense</span>
              <span className="block text-xs text-ink3">Track who owes you their share</span>
            </span>
            <Toggle on={splitOn} />
          </button>

          {splitOn ? (
            <div className="mt-4 flex flex-col gap-2.5 animate-fade-in">
              <div className="flex gap-2">
                <input
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPerson();
                    }
                  }}
                  placeholder="Add a person and press Enter"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-card-hi px-3.5 text-sm text-ink outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand-soft"
                />
                <button
                  type="button"
                  onClick={() => setSplitContactPickerOpen(true)}
                  aria-label="Choose from contacts"
                  title="Choose from contacts"
                  className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-card-hi text-ink2 transition-colors hover:border-brand hover:text-brand-deep"
                >
                  <BookUser className="h-4 w-4" />
                </button>
                <Button type="button" variant="soft" size="md" icon={<Plus className="h-4 w-4" />} onClick={addPerson}>
                  Add
                </Button>
              </div>

              {splits.map((p, i) => (
                <div key={`${p.person_name}-${i}`} className="flex items-center gap-2.5 rounded-xl border border-line bg-card-hi px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-deep">
                    {p.person_name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p.person_name}</span>
                  <div className="amount flex items-center gap-1 text-sm text-ink">
                    ₹
                    <input
                      inputMode="decimal"
                      value={String(p.amount)}
                      onChange={(e) => {
                        manualShares.current = true;
                        const v = Number(e.target.value.replace(/[^\d.]/g, "")) || 0;
                        setSplits((prev) => prev.map((x, xi) => (xi === i ? { ...x, amount: v } : x)));
                        setErrors((prev) => ({ ...prev, split: undefined }));
                      }}
                      className="amount w-20 rounded-lg border border-line bg-card px-2 py-1 text-right text-sm outline-none focus:border-brand"
                      aria-label={`${p.person_name}'s share`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSplits((prev) => prev.map((x, xi) => (xi === i ? { ...x, paid_back: !x.paid_back } : x)))
                    }
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors",
                      p.paid_back ? "text-white" : "bg-sunken text-ink3 border border-line"
                    )}
                    style={p.paid_back ? { background: "var(--jade-chart)" } : undefined}
                  >
                    {p.paid_back ? "Paid back" : "Owes"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${p.person_name}`}
                    onClick={() => {
                      setSplits((prev) => prev.filter((_, xi) => xi !== i));
                      if (splits.length <= 1) manualShares.current = false;
                    }}
                    className="press shrink-0 rounded-full p-1.5 text-ink3 hover:bg-rose-soft hover:text-rose"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {splits.length > 0 ? (
                <div className="flex items-center justify-between px-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      manualShares.current = false;
                      const shares = equalShares(total, splits.length);
                      setSplits((prev) => prev.map((p, i) => ({ ...p, amount: shares[i] ?? 0 })));
                      setErrors((prev) => ({ ...prev, split: undefined }));
                    }}
                    className="font-semibold text-brand-deep hover:underline"
                  >
                    Split equally
                  </button>
                  <span className={cn("amount font-semibold", Math.abs(splitSum - total) > 0.01 ? "text-rose" : "text-ink3")}>
                    {formatCurrency(splitSum)} / {formatCurrency(total)}
                  </span>
                </div>
              ) : null}
              {errors.split ? <p className="animate-fade-in text-[13px] font-medium text-rose">{errors.split}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Recurring — hidden for transfers (the recurring engine can't copy the To account) */}
      {!isTransfer ? (
      <div className="rounded-2xl border border-line bg-card p-4">
        <button type="button" onClick={() => setRecurring(!recurring)} className="flex w-full items-center gap-3" aria-pressed={recurring}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft">
            <Repeat className="h-4 w-4 text-brand-deep" />
          </span>
          <span className="flex-1 text-left">
            <span className="block text-sm font-semibold text-ink">Repeat this transaction</span>
            <span className="block text-xs text-ink3">Rent, subscriptions, pocket money…</span>
          </span>
          <Toggle on={recurring} />
        </button>
        {recurring ? (
          <div className="mt-4 grid grid-cols-4 gap-1.5 animate-fade-in">
            {INTERVALS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInterval(i)}
                className={cn(
                  "press rounded-xl border px-2 py-2 text-[12px] font-semibold capitalize transition-all",
                  interval === i ? "border-brand bg-brand-soft text-brand-deep" : "border-line text-ink3 hover:text-ink"
                )}
              >
                {i}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      ) : null}

      {/* Receipt — attach to spends/incomes, not internal transfers */}
      {!isTransfer ? (
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft">
            <Camera className="h-4 w-4 text-brand-deep" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Receipt</span>
            <span className="block text-xs text-ink3">Attach a photo of the bill</span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            {receiptPreview ? "Replace" : "Attach receipt"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f) {
                setReceiptFile(f);
                setRemoveExisting(false);
              }
              e.target.value = "";
            }}
          />
        </div>
        {receiptPreview ? (
          <div className="mt-3 flex items-center gap-3 animate-fade-in">
            <button type="button" onClick={() => setViewerOpen(true)} className="press overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptPreview} alt="Receipt" className="h-20 w-20 object-cover" />
            </button>
            <button
              type="button"
              onClick={() => {
                setReceiptFile(null);
                if (existingReceipt) setRemoveExisting(true);
              }}
              className="press flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-rose hover:bg-rose-soft"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        ) : null}
      </div>
      ) : null}

      <Button type="submit" size="lg" loading={busy}>
        {submitLabel}
      </Button>

      {/* Full-screen receipt viewer */}
      {viewerOpen && receiptPreview ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in" onClick={() => setViewerOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={receiptPreview} alt="Receipt full view" className="max-h-full max-w-full rounded-2xl object-contain animate-scale-in" />
        </div>
      ) : null}

      {/* Method picker */}
      <AdaptiveDialog open={pickerOpen} onClose={() => setPickerOpen(false)} title="Paid via">
        <div className="flex flex-col gap-1.5">
          <MethodOption
            selected={methodId === null}
            onClick={() => {
              setMethodId(null);
              setPickerOpen(false);
            }}
            title="Cash / Not specified"
            subtitle="No payment method"
            badge={<InitialBadge text="₹" hex="#6D7365" size={38} />}
          />
          {methods.map((m) => {
            const bank = BANKS.find((b) => b.key === m.bank_key);
            return (
              <MethodOption
                key={m.id}
                selected={methodId === m.id}
                onClick={() => {
                  setMethodId(m.id);
                  setPickerOpen(false);
                }}
                title={`${m.bank_name} ····${m.last_four_digits}`}
                subtitle={m.payment_type === "upi" ? `UPI · ${m.upi_app_name ?? ""}` : PAYMENT_TYPE_LABEL[m.payment_type]}
                badge={<InitialBadge text={m.bank_name.slice(0, 2).toUpperCase()} hex={bank?.hex ?? "#6D7365"} size={38} />}
              />
            );
          })}
          {methods.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-ink3">
              No saved methods yet — add one from the Payment Methods tab.
            </p>
          ) : null}
        </div>
      </AdaptiveDialog>

      {/* Transfer From/To account picker */}
      <AdaptiveDialog
        open={transferPicker !== null}
        onClose={() => setTransferPicker(null)}
        title={transferPicker === "from" ? "From account" : "To account"}
      >
        <div className="flex flex-col gap-1.5">
          {methods.map((m) => {
            const bank = BANKS.find((b) => b.key === m.bank_key);
            const selected = (transferPicker === "from" ? transferFrom : transferTo) === m.id;
            return (
              <MethodOption
                key={m.id}
                selected={selected}
                onClick={() => {
                  if (transferPicker === "from") setTransferFrom(m.id);
                  else setTransferTo(m.id);
                  setErrors((prev) => ({ ...prev, transfer: undefined }));
                  setTransferPicker(null);
                }}
                title={`${m.bank_name} ····${m.last_four_digits}`}
                subtitle={m.payment_type === "upi" ? `UPI · ${m.upi_app_name ?? ""}` : PAYMENT_TYPE_LABEL[m.payment_type]}
                badge={<InitialBadge text={m.bank_name.slice(0, 2).toUpperCase()} hex={bank?.hex ?? "#6D7365"} size={38} />}
              />
            );
          })}
        </div>
      </AdaptiveDialog>

      {/* Person tag picker — titled by transaction direction */}
      <ContactPicker
        open={contactPickerOpen}
        onClose={() => setContactPickerOpen(false)}
        onSelect={setContact}
        selectedId={contact?.id ?? null}
        txnType={type === "in" ? "in" : "out"}
      />

      {/* Splits: pick a contact to pre-fill the name */}
      <ContactPicker
        open={splitContactPickerOpen}
        onClose={() => setSplitContactPickerOpen(false)}
        onSelect={(c) => {
          if (c) setPersonName(c.name);
        }}
        allowNone={false}
        title="Choose from contacts"
      />
    </form>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-all duration-200",
        on ? "bg-brand shadow-[0_0_14px_-2px_var(--brand-glow)]" : "border border-line-strong bg-sunken"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-all duration-200",
          on ? "left-[calc(100%-1.625rem)]" : "left-0.5"
        )}
      />
    </span>
  );
}

function MethodOption({
  selected,
  onClick,
  title,
  subtitle,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  badge: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press row-sweep flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200",
        selected ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-line-strong"
      )}
    >
      {badge}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-ink3">{subtitle}</span>
      </span>
      <span
        className={cn("shrink-0 rounded-full border-2 transition-all", selected ? "border-brand bg-brand" : "border-line-strong")}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}
