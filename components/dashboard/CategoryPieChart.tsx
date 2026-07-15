"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipProps } from "recharts";
import { formatCurrency } from "@/lib/helpers";
import type { Transaction } from "@/types";

const SLOT_VARS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"];

interface Slice {
  name: string;
  value: number;
  pct: number;
}

function PieTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="card-surface rounded-xl px-3.5 py-2 shadow-pop">
      <p className="text-[13px] font-semibold text-ink">{p.name}</p>
      <p className="amount text-[13px] text-ink2">{formatCurrency(p.value ?? 0)}</p>
    </div>
  );
}

/** Cash-out breakdown, folded to top 5 categories + Other. */
export function CategoryPieChart({ transactions }: { transactions: Transaction[] }) {
  const slices = useMemo<Slice[]>(() => {
    const byCategory = new Map<string, number>();
    let total = 0;
    for (const t of transactions) {
      if (t.type !== "out") continue;
      const amt = Number(t.amount);
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + amt);
      total += amt;
    }
    if (total === 0) return [];
    const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((sum, [, v]) => sum + v, 0);
    const all = rest > 0 ? [...top, ["Other categories", rest] as [string, number]] : top;
    return all.map(([name, value]) => ({ name, value, pct: (value / total) * 100 }));
  }, [transactions]);

  if (slices.length === 0) return null;

  return (
    <div className="card-surface rounded-3xl p-5 animate-fade-up">
      <h3 className="label-caps mb-2">Where it goes</h3>
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-6">
        <div className="h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<PieTooltip />} />
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {slices.map((s, i) => (
                  <Cell key={s.name} fill={SLOT_VARS[i % SLOT_VARS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="w-full min-w-0 flex-1 space-y-2">
          {slices.map((s, i) => (
            <li key={s.name} className="flex items-center gap-2.5 text-[13px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: SLOT_VARS[i % SLOT_VARS.length] }} />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{s.name}</span>
              <span className="shrink-0 text-ink3">{s.pct.toFixed(0)}%</span>
              <span className="amount w-24 shrink-0 text-right font-semibold text-ink2">{formatCurrency(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
