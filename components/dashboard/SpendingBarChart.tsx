"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { formatCurrency, formatCurrencyCompact } from "@/lib/helpers";
import type { Transaction } from "@/types";

interface MonthDatum {
  month: string;
  cashIn: number;
  cashOut: number;
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-surface rounded-xl px-3.5 py-2.5 shadow-pop">
      <p className="label-caps mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-[13px]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink2">{p.dataKey === "cashIn" ? "Cash In" : "Cash Out"}</span>
          <span className="amount ml-auto pl-3 font-semibold text-ink">{formatCurrency(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

/** Grouped bars for the last six months of activity. */
export function SpendingBarChart({ transactions }: { transactions: Transaction[] }) {
  const data = useMemo<MonthDatum[]>(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const monthDate = subMonths(now, 5 - i);
      const from = startOfMonth(monthDate);
      const to = endOfMonth(monthDate);
      let cashIn = 0;
      let cashOut = 0;
      for (const t of transactions) {
        const d = parseISO(t.date);
        if (d >= from && d <= to) {
          if (t.type === "in") cashIn += Number(t.amount);
          else cashOut += Number(t.amount);
        }
      }
      return { month: format(monthDate, "MMM"), cashIn, cashOut };
    });
  }, [transactions]);

  return (
    <div className="card-surface rounded-3xl p-5 animate-fade-up">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="label-caps">Last 6 months</h3>
        <div className="flex items-center gap-4 text-xs font-medium text-ink2">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--jade-chart)" }} /> Cash In
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--rose-chart)" }} /> Cash Out
          </span>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 0, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="0" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} dy={6} />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={54}
              tickFormatter={(v: number) => formatCurrencyCompact(v)}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--brand-soft)" }} />
            <Bar dataKey="cashIn" fill="var(--jade-chart)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="cashOut" fill="var(--rose-chart)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
