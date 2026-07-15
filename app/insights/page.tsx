"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Crown, Frown, Minus, Trophy } from "lucide-react";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { SpendingBarChart } from "@/components/dashboard/SpendingBarChart";
import { AnimatedAmount } from "@/components/ui/AnimatedAmount";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAllTransactionsForOwner } from "@/lib/features/insights";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { cn, formatCurrency } from "@/lib/helpers";
import type { Transaction } from "@/types";

export default function InsightsPage() {
  return (
    <AppShell>
      <InsightsContent />
    </AppShell>
  );
}

interface MonthTotals {
  cashIn: number;
  cashOut: number;
  net: number;
}

function totalsBetween(transactions: Transaction[], from: Date, to: Date): MonthTotals {
  let cashIn = 0;
  let cashOut = 0;
  for (const t of transactions) {
    const d = parseISO(t.date);
    if (d >= from && d <= to) {
      if (t.type === "in") cashIn += Number(t.amount);
      else cashOut += Number(t.amount);
    }
  }
  return { cashIn, cashOut, net: cashIn - cashOut };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function DeltaChip({ change, goodWhenUp }: { change: number | null; goodWhenUp: boolean }) {
  if (change === null || !Number.isFinite(change)) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-[11px] font-bold text-ink3">
        <Minus className="h-3 w-3" /> new
      </span>
    );
  }
  const up = change >= 0;
  const good = up === goodWhenUp;
  return (
    <span
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{
        background: good ? "var(--jade-soft)" : "var(--rose-soft)",
        color: good ? "var(--jade)" : "var(--rose)",
      }}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(change).toFixed(0)}% vs last month
    </span>
  );
}

function InsightsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getAllTransactionsForOwner(user.id)
      .then(setTransactions)
      .catch((e: unknown) => toast(e instanceof Error ? e.message : "Failed to load insights", "error"))
      .finally(() => setLoading(false));
  }, [user, toast]);

  const now = new Date();
  const thisMonth = useMemo(
    () => totalsBetween(transactions, startOfMonth(now), endOfMonth(now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions]
  );
  const lastMonth = useMemo(
    () => totalsBetween(transactions, startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions]
  );

  const categories = useMemo(() => {
    const from = startOfMonth(now);
    const to = endOfMonth(now);
    const byCat = new Map<string, number>();
    let total = 0;
    for (const t of transactions) {
      if (t.type !== "out") continue;
      const d = parseISO(t.date);
      if (d < from || d > to) continue;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + Number(t.amount));
      total += Number(t.amount);
    }
    const ranked = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    return { ranked: ranked.slice(0, 3), total, biggest: ranked[0] ?? null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const bestWorst = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = subMonths(now, 11 - i);
      const t = totalsBetween(transactions, startOfMonth(m), endOfMonth(m));
      return { label: format(m, "MMMM yyyy"), ...t, active: t.cashIn + t.cashOut > 0 };
    }).filter((m) => m.active);
    if (months.length === 0) return null;
    const best = months.reduce((a, b) => (b.net > a.net ? b : a));
    const worst = months.reduce((a, b) => (b.net < a.net ? b : a));
    return { best, worst };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const heroStats = [
    { label: "Spent", value: thisMonth.cashOut, change: pctChange(thisMonth.cashOut, lastMonth.cashOut), goodWhenUp: false, color: "var(--rose)" },
    { label: "Earned", value: thisMonth.cashIn, change: pctChange(thisMonth.cashIn, lastMonth.cashIn), goodWhenUp: true, color: "var(--jade)" },
    { label: "Net", value: thisMonth.net, change: pctChange(thisMonth.net, lastMonth.net), goodWhenUp: true, color: thisMonth.net < 0 ? "var(--rose)" : "var(--brand-deep)" },
  ];

  return (
    <>
      <Header title="Insights" subtitle="Your money, across every book" hero />
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 md:px-8">
        {loading ? (
          <>
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-40 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </>
        ) : transactions.length === 0 ? (
          <EmptyState
            illustration="transactions"
            title="No data yet"
            message="Add a few transactions to any book and your monthly story will appear here."
          />
        ) : (
          <>
            {/* Hero — this month */}
            <section className="card-surface backlit shimmer-card relative overflow-hidden rounded-3xl p-6 animate-fade-up md:p-8">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full opacity-20 blur-3xl"
                style={{ background: "radial-gradient(circle, var(--brand), transparent 65%)" }}
              />
              <p className="label-caps relative">This month · {format(now, "MMMM yyyy")}</p>
              <div className="relative mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {heroStats.map((s, i) => (
                  <div key={s.label} className="animate-fade-up" style={{ animationDelay: `${i * 90}ms` }}>
                    <p className="text-sm font-semibold text-ink2">{s.label}</p>
                    <p className="amount mt-1 text-[34px] font-semibold leading-none tracking-tight md:text-5xl" style={{ color: s.color }}>
                      <AnimatedAmount value={s.value} />
                    </p>
                    <div className="mt-2.5">
                      <DeltaChip change={s.change} goodWhenUp={s.goodWhenUp} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Category breakdown */}
            {categories.biggest ? (
              <section className="grid grid-cols-1 gap-4 md:grid-cols-5 animate-fade-up" style={{ animationDelay: "120ms" }}>
                <div className="card-surface card-lift shimmer-card relative overflow-hidden rounded-3xl p-5 md:col-span-2">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full opacity-25 blur-3xl"
                    style={{ background: "radial-gradient(circle, var(--rose-chart), transparent 68%)" }}
                  />
                  <p className="label-caps">Biggest spend this month</p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--rose-soft)" }}>
                      <Crown className="h-6 w-6" style={{ color: "var(--rose)" }} />
                    </span>
                    <div>
                      <p className="font-display text-2xl tracking-tight text-ink">{categories.biggest[0]}</p>
                      <p className="amount text-lg font-semibold text-rose">{formatCurrency(categories.biggest[1])}</p>
                    </div>
                  </div>
                </div>

                <div className="card-surface rounded-3xl p-5 md:col-span-3">
                  <p className="label-caps mb-4">Top categories</p>
                  <div className="flex flex-col gap-3.5">
                    {categories.ranked.map(([name, amt], i) => (
                      <div key={name}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-semibold text-ink">
                            <span className="mr-2 text-ink3">{i + 1}</span>
                            {name}
                          </span>
                          <span className="amount shrink-0 font-semibold text-ink2">{formatCurrency(amt)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-sunken">
                          <div
                            className="h-full rounded-full transition-[width] duration-1000 ease-out"
                            style={{
                              width: `${(amt / categories.total) * 100}%`,
                              background: `var(--cat-${i + 1})`,
                              boxShadow: `0 0 10px -2px var(--cat-${i + 1})`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
              <SpendingBarChart transactions={transactions} />
            </div>

            {/* Best / worst month */}
            {bestWorst ? (
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-up" style={{ animationDelay: "260ms" }}>
                {[
                  { title: "Best month", data: bestWorst.best, icon: Trophy, color: "var(--jade)", soft: "var(--jade-soft)" },
                  { title: "Toughest month", data: bestWorst.worst, icon: Frown, color: "var(--rose)", soft: "var(--rose-soft)" },
                ].map(({ title, data, icon: Icon, color, soft }) => (
                  <div key={title} className="card-surface card-lift shimmer-card rounded-3xl p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: soft }}>
                        <Icon className="h-5 w-5" style={{ color }} />
                      </span>
                      <div>
                        <p className="label-caps">{title}</p>
                        <p className="mt-0.5 font-display text-xl tracking-tight text-ink">{data.label}</p>
                      </div>
                      <p className={cn("amount ml-auto text-lg font-semibold")} style={{ color }}>
                        {data.net >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(data.net))}
                      </p>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
