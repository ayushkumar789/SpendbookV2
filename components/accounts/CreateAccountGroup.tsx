"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { BANKS, BOOK_COLORS, PAYMENT_TYPE_LABEL } from "@/lib/constants";
import {
  createAccountGroup,
  formatBalanceTyping,
  parseBalanceInput,
  setGroupMembers,
  updateAccountGroup,
} from "@/lib/features/accounts";
import { cn } from "@/lib/helpers";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/Button";
import { FieldWrap, Input } from "@/components/ui/Input";
import { InitialBadge } from "@/components/ui/Badge";
import { OVERLAY_STYLE, PANEL_STYLE, useBodyScrollLock } from "@/components/ui/overlay";
import type { PaymentMethod } from "@/types";
import type { AccountGroupWithDetails } from "@/types/features";

function localNowForInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Three-step create flow (details → members → starting balance).
 *  In edit mode (existing group) the balance step is skipped — balances
 *  are updated from the card instead. */
export function CreateAccountGroup({
  existing,
  methods,
  groupedMap,
  onClose,
  onSaved,
}: {
  existing: AccountGroupWithDetails | null;
  methods: PaymentMethod[];
  /** methodId → owning group, to grey out methods already grouped elsewhere */
  groupedMap: Map<string, { groupId: string; groupName: string }>;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = existing !== null;
  const lastStep = isEdit ? 2 : 3;

  const [step, setStep] = useState(1);
  const [name, setName] = useState(existing?.name ?? "");
  const [bankKey, setBankKey] = useState(existing?.bank_key ?? "");
  const [color, setColor] = useState(existing?.color ?? BOOK_COLORS[0].hex);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(existing?.members.map((m) => m.id) ?? [])
  );
  const [balance, setBalance] = useState("");
  const [asOf, setAsOf] = useState(localNowForInput());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useBodyScrollLock(true);

  // Auto-suggest: banks the user actually has methods with come first.
  const bankList = useMemo(() => {
    const owned = new Set(methods.map((m) => m.bank_key));
    return [...BANKS].sort((a, b) => Number(owned.has(b.key)) - Number(owned.has(a.key)));
  }, [methods]);

  const toggleMethod = (id: string): void => {
    const taken = groupedMap.get(id);
    if (taken && taken.groupId !== existing?.id) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError(null);
  };

  const next = (): void => {
    if (step === 1) {
      if (!name.trim()) {
        setError("Give the account a name");
        return;
      }
      if (!bankKey) {
        setError("Pick the bank");
        return;
      }
    }
    if (step === 2 && selected.size === 0) {
      setError("Select at least one payment method");
      return;
    }
    setError(null);
    if (step < lastStep) {
      setStep(step + 1);
      return;
    }
    void save();
  };

  const save = async (): Promise<void> => {
    if (!user) return;
    const bank = BANKS.find((b) => b.key === bankKey);
    if (!isEdit) {
      const parsed = parseBalanceInput(balance);
      if (balance.trim() === "" || parsed < 0) {
        setError("Enter your current balance");
        return;
      }
    }
    setBusy(true);
    try {
      const input = {
        name: name.trim(),
        bank_key: bankKey,
        bank_name: bank?.name ?? bankKey,
        color,
      };
      if (isEdit) {
        await updateAccountGroup(existing.id, input);
        await setGroupMembers(user.id, existing.id, [...selected]);
        toast("Account updated", "success");
      } else {
        await createAccountGroup(user.id, input, [...selected], {
          balance: parseBalanceInput(balance),
          asOf: new Date(asOf).toISOString(),
          note: note.trim() || null,
        });
        toast("Account created — balance is now live", "success");
      }
      await onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save the account", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div role="dialog" aria-modal="true" style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl tracking-tight text-ink">
            {isEdit ? "Edit account" : "Create account"}
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
        <p className="mb-5 text-xs font-semibold text-ink3">
          Step {step} of {lastStep} ·{" "}
          {step === 1 ? "Account details" : step === 2 ? "Payment methods" : "Starting balance"}
        </p>

        {step === 1 ? (
          <div className="flex flex-col gap-5">
            <Input
              label="Account name"
              placeholder="e.g. HDFC Main Account"
              value={name}
              maxLength={60}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              error={error}
            />
            <FieldWrap label="Bank">
              <div className="hide-scrollbar grid max-h-[190px] grid-cols-3 gap-2 overflow-y-auto pr-1">
                {bankList.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => {
                      setBankKey(b.key);
                      setError(null);
                    }}
                    aria-pressed={bankKey === b.key}
                    className={cn(
                      "press flex items-center gap-2 rounded-xl border p-2 text-left transition-all",
                      bankKey === b.key ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-line-strong"
                    )}
                  >
                    <InitialBadge text={b.name.slice(0, 2).toUpperCase()} hex={b.hex} size={28} />
                    <span className="min-w-0 truncate text-xs font-semibold text-ink">{b.name}</span>
                  </button>
                ))}
              </div>
            </FieldWrap>
            <FieldWrap label="Color">
              <div className="flex flex-wrap gap-2.5">
                {BOOK_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    title={c.name}
                    onClick={() => setColor(c.hex)}
                    aria-pressed={color === c.hex}
                    className={cn(
                      "press flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200",
                      color === c.hex ? "scale-110" : "hover:scale-105"
                    )}
                    style={{
                      background: `linear-gradient(145deg, ${c.hex}, color-mix(in srgb, ${c.hex} 70%, #0b0c0a))`,
                      boxShadow: color === c.hex ? `0 0 16px -2px ${c.hex}` : undefined,
                    }}
                  >
                    {color === c.hex ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : null}
                  </button>
                ))}
              </div>
            </FieldWrap>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-ink2">
              Select every payment method that spends from this bank account. A method can belong to only
              one account.
            </p>
            {error ? <p className="text-[13px] font-medium text-rose">{error}</p> : null}
            <div className="flex max-h-[44vh] flex-col gap-1.5 overflow-y-auto overscroll-contain">
              {methods.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-ink3">
                  No saved payment methods yet — add one from the Payment Methods tab first.
                </p>
              ) : (
                methods.map((m) => {
                  const bank = BANKS.find((b) => b.key === m.bank_key);
                  const taken = groupedMap.get(m.id);
                  const lockedElsewhere = !!taken && taken.groupId !== existing?.id;
                  const isSelected = selected.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMethod(m.id)}
                      disabled={lockedElsewhere}
                      className={cn(
                        "press flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200",
                        lockedElsewhere
                          ? "cursor-not-allowed border-line bg-sunken opacity-50"
                          : isSelected
                            ? "border-brand bg-brand-soft"
                            : "border-line bg-card hover:border-line-strong"
                      )}
                    >
                      <InitialBadge text={m.bank_name.slice(0, 2).toUpperCase()} hex={bank?.hex ?? "#6D7365"} size={38} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {m.bank_name} ····{m.last_four_digits}
                        </span>
                        <span className="block truncate text-xs text-ink3">
                          {lockedElsewhere
                            ? `In "${taken.groupName}"`
                            : m.payment_type === "upi"
                              ? `UPI · ${m.upi_app_name ?? ""}`
                              : PAYMENT_TYPE_LABEL[m.payment_type]}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border-2 transition-all",
                          isSelected ? "border-brand bg-brand" : "border-line-strong"
                        )}
                        style={{ width: 18, height: 18 }}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-5">
            <FieldWrap label="What is your current balance?" error={error}>
              <div className="flex items-baseline gap-2 rounded-2xl border border-line bg-card px-5 py-4 transition-all focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-soft">
                <span className="font-display text-3xl text-brand-deep">₹</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={balance}
                  autoFocus
                  onChange={(e) => {
                    setBalance(formatBalanceTyping(e.target.value));
                    setError(null);
                  }}
                  className="amount w-full bg-transparent text-3xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink3"
                  aria-label="Current balance in rupees"
                />
              </div>
            </FieldWrap>
            <FieldWrap label="As of">
              <input
                type="datetime-local"
                value={asOf}
                max={localNowForInput()}
                onChange={(e) => setAsOf(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-4 py-3 text-[15px] text-ink transition-all focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-soft"
              />
            </FieldWrap>
            <Input
              label="Note · optional"
              placeholder="e.g. Checked in HDFC app"
              value={note}
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            icon={step > 1 ? <ArrowLeft className="h-4 w-4" /> : undefined}
            onClick={() => {
              setError(null);
              if (step > 1) setStep(step - 1);
              else onClose();
            }}
            disabled={busy}
          >
            {step > 1 ? "Back" : "Cancel"}
          </Button>
          <Button
            type="button"
            icon={step < lastStep ? <ArrowRight className="h-4 w-4" /> : undefined}
            onClick={next}
            loading={busy}
          >
            {step < lastStep ? "Next" : isEdit ? "Save changes" : "Create account"}
          </Button>
        </div>
      </div>
    </div>
  );
}
