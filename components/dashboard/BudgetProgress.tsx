"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { clamp, formatCurrency } from "@/lib/helpers";
import type { Transaction } from "@/types";

interface BudgetProgressProps {
  budget: number;
  transactions: Transaction[];
}

/** This-month spend against the book's optional budget. */
export function BudgetProgress({ budget, transactions }: BudgetProgressProps) {
  const spent = useMemo(() => {
    const from = startOfMonth(new Date());
    const to = endOfMonth(new Date());
    return transactions.reduce((sum, t) => {
      if (t.type !== "out") return sum;
      const d = parseISO(t.date);
      return d >= from && d <= to ? sum + Number(t.amount) : sum;
    }, 0);
  }, [transactions]);

  const ratio = budget > 0 ? spent / budget : 0;
  const over = ratio >= 1;
  const warning = ratio >= 0.8 && !over;
  const barColor = over ? "var(--rose)" : warning ? "var(--warn)" : "var(--jade-chart)";

  return (
    <div className="card-surface rounded-2xl p-4 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps">{format(new Date(), "MMMM")} budget</p>
        {over ? (
          <span className="flex items-center gap-1 rounded-full bg-rose-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-rose">
            <AlertTriangle className="h-3 w-3" /> Over budget
          </span>
        ) : warning ? (
          <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ background: "var(--brand-soft)", color: "var(--warn)" }}>
            <AlertTriangle className="h-3 w-3" /> {Math.round(ratio * 100)}% used
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-ink2">
        <span className="amount font-semibold text-ink">{formatCurrency(spent)}</span> spent of{" "}
        <span className="amount font-semibold text-ink">{formatCurrency(budget)}</span> budget
      </p>
      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${clamp(ratio * 100, 2, 100)}%`, background: barColor }}
        />
      </div>
    </div>
  );
}
