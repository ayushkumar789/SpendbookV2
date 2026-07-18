"use client";

import { useEffect, useState, type FormEvent } from "react";
import { History, X } from "lucide-react";
import {
  addSnapshot,
  formatBalance,
  formatBalanceTyping,
  getSnapshots,
  parseBalanceInput,
} from "@/lib/features/accounts";
import { formatDate } from "@/lib/helpers";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/Button";
import { FieldWrap, Input } from "@/components/ui/Input";
import { OVERLAY_STYLE, PANEL_STYLE, useBodyScrollLock } from "@/components/ui/overlay";
import type { AccountGroupWithDetails, AccountSnapshot } from "@/types/features";

/** Enter a fresh balance baseline. Older snapshots stay as history —
 *  the last three are shown here, expandable to the full list. */
export function UpdateBalanceOverlay({
  group,
  onClose,
  onSaved,
}: {
  group: AccountGroupWithDetails;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<AccountSnapshot[]>([]);
  const [showAll, setShowAll] = useState(false);
  useBodyScrollLock(true);

  useEffect(() => {
    getSnapshots(group.id)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [group.id]);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!user) return;
    const parsed = parseBalanceInput(amount);
    if (amount.trim() === "" || parsed < 0) {
      setError("Enter your current balance");
      return;
    }
    setBusy(true);
    try {
      await addSnapshot(user.id, group.id, parsed, note.trim() || null);
      toast("Balance updated", "success");
      await onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the balance", "error");
    } finally {
      setBusy(false);
    }
  };

  const visibleHistory = showAll ? history : history.slice(0, 3);

  return (
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div role="dialog" aria-modal="true" style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl tracking-tight text-ink">
            Update balance · <span className="text-brand-deep">{group.name}</span>
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
          <FieldWrap label="Current balance" error={error}>
            <div className="flex items-baseline gap-2 rounded-2xl border border-line bg-card px-5 py-4 transition-all focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-soft">
              <span className="font-display text-3xl text-brand-deep">₹</span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={amount}
                autoFocus
                onChange={(e) => {
                  setAmount(formatBalanceTyping(e.target.value));
                  setError(null);
                }}
                className="amount w-full bg-transparent text-3xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink3"
                aria-label="Current balance in rupees"
              />
            </div>
          </FieldWrap>

          <Input
            label="Note · optional"
            placeholder="e.g. Checked in HDFC app"
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
          />

          <Button type="submit" size="lg" loading={busy}>
            Save
          </Button>
        </form>

        {history.length > 0 ? (
          <div className="mt-6 border-t border-line pt-4">
            <p className="label-caps mb-2.5 flex items-center gap-1.5">
              <History className="h-3 w-3" /> Balance history
            </p>
            <div className="flex flex-col gap-2">
              {visibleHistory.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-card-hi px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink">
                      {formatDate(s.snapshot_date, "d MMM yyyy, h:mm a")}
                      {i === 0 && !showAll ? (
                        <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-brand-deep">
                          Current baseline
                        </span>
                      ) : null}
                    </p>
                    {s.note ? <p className="truncate text-xs text-ink3">{s.note}</p> : null}
                  </div>
                  <p className="amount shrink-0 text-sm font-semibold text-ink">{formatBalance(Number(s.balance))}</p>
                </div>
              ))}
            </div>
            {history.length > 3 ? (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="mt-2.5 text-xs font-semibold text-brand-deep hover:underline"
              >
                {showAll ? "Show less" : `Show all ${history.length} entries`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
