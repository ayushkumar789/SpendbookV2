"use client";

import { useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Camera, Repeat, Trash2, Users } from "lucide-react";
import { cn, formatCurrency, formatDate, methodLabel } from "@/lib/helpers";
import type { PaymentMethod, Transaction } from "@/types";
import type { TransactionV2 } from "@/types/features";

interface TransactionRowProps {
  txn: Transaction;
  methods: PaymentMethod[];
  onEdit?: (txn: Transaction) => void;
  onDelete?: (txn: Transaction) => void;
  readOnly?: boolean;
  /** show the "Split" badge */
  hasSplit?: boolean;
  /** flash-highlight (arrived via global search) */
  highlight?: boolean;
}

/** Tap to edit · swipe left or long-press to delete (mobile). */
export function TransactionRow({
  txn,
  methods,
  onEdit,
  onDelete,
  readOnly = false,
  hasSplit = false,
  highlight = false,
}: TransactionRowProps) {
  const isIn = txn.type === "in";
  const receiptPath = (txn as TransactionV2).receipt_url;
  const [dragX, setDragX] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const longPress = useRef<number | null>(null);
  const suppressTap = useRef(false);

  const clearLongPress = (): void => {
    if (longPress.current !== null) {
      window.clearTimeout(longPress.current);
      longPress.current = null;
    }
  };

  const onTouchStart = (e: React.TouchEvent): void => {
    if (readOnly) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    suppressTap.current = false;
    longPress.current = window.setTimeout(() => {
      suppressTap.current = true;
      if (navigator.vibrate) navigator.vibrate(12);
      onDelete?.(txn);
    }, 600);
  };

  const onTouchMove = (e: React.TouchEvent): void => {
    if (readOnly || !touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearLongPress();
    if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
      setDragX(Math.max(dx, -96));
      suppressTap.current = true;
    }
  };

  const onTouchEnd = (): void => {
    clearLongPress();
    touchStart.current = null;
    setDragX((current) => (current < -64 ? -84 : 0));
  };

  const handleClick = (): void => {
    if (suppressTap.current) {
      suppressTap.current = false;
      setDragX(0);
      return;
    }
    if (!readOnly) onEdit?.(txn);
  };

  return (
    <div className="relative overflow-hidden" data-txn-id={txn.id}>
      {!readOnly ? (
        <button
          onClick={() => {
            setDragX(0);
            onDelete?.(txn);
          }}
          aria-label="Delete transaction"
          className="absolute inset-y-1 right-1 flex w-[76px] items-center justify-center rounded-2xl bg-rose text-white transition-opacity"
          style={{ opacity: dragX < -20 ? 1 : 0, pointerEvents: dragX < -20 ? "auto" : "none" }}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      ) : null}
      <div
        role={readOnly ? undefined : "button"}
        tabIndex={readOnly ? undefined : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (!readOnly && (e.key === "Enter" || e.key === " ")) onEdit?.(txn);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={cn(
          "row-sweep relative flex items-center gap-3 bg-transparent py-3.5 pl-3.5 pr-4 transition-transform duration-200",
          !readOnly && "cursor-pointer",
          highlight && "tx-highlight"
        )}
        style={{
          transform: `translateX(${dragX}px)`,
          boxShadow: `inset 3px 0 0 ${isIn ? "var(--jade-chart)" : "var(--rose-chart)"}`,
        }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: isIn ? "var(--jade-soft)" : "var(--rose-soft)" }}
        >
          {isIn ? (
            <ArrowDownLeft size={18} style={{ color: "var(--jade)" }} />
          ) : (
            <ArrowUpRight size={18} style={{ color: "var(--rose)" }} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{txn.category}</span>
            {txn.is_recurring ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-deep">
                <Repeat className="h-2.5 w-2.5" /> {txn.recurrence_interval}
              </span>
            ) : null}
            {hasSplit ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: "var(--jade-soft)", color: "var(--jade)" }}>
                <Users className="h-2.5 w-2.5" /> Split
              </span>
            ) : null}
            {receiptPath ? <Camera className="h-3.5 w-3.5 shrink-0 text-ink3" aria-label="Receipt attached" /> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-ink3">
            {formatDate(txn.date)}
            {/* Public shared viewers can't read the owner's methods — omit rather than mislead */}
            {readOnly && txn.payment_method_id ? "" : ` · ${methodLabel(txn.payment_method_id, methods)}`}
            {txn.note ? ` · ${txn.note}` : ""}
          </p>
        </div>

        <p className={cn("amount shrink-0 text-[15px] font-semibold", isIn ? "text-jade" : "text-rose")}>
          {isIn ? "+" : "−"}
          {formatCurrency(Number(txn.amount))}
        </p>
      </div>
    </div>
  );
}
