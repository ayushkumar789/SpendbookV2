"use client";

import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import { cn } from "@/lib/helpers";
import { AnimatedAmount } from "@/components/ui/AnimatedAmount";

interface SummaryCardsProps {
  cashIn: number;
  cashOut: number;
}

export function SummaryCards({ cashIn, cashOut }: SummaryCardsProps) {
  const net = cashIn - cashOut;
  const cards = [
    { label: "Cash In", value: cashIn, icon: ArrowDownLeft, color: "var(--jade)", soft: "var(--jade-soft)" },
    { label: "Cash Out", value: cashOut, icon: ArrowUpRight, color: "var(--rose)", soft: "var(--rose-soft)" },
    {
      label: "Net Balance",
      value: net,
      icon: Scale,
      color: net < 0 ? "var(--rose)" : "var(--brand-deep)",
      soft: net < 0 ? "var(--rose-soft)" : "var(--brand-soft)",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map(({ label, value, icon: Icon, color, soft }, i) => (
        <div
          key={label}
          className="card-surface card-lift rounded-2xl p-4 animate-fade-up"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: soft }}>
              <Icon className="h-3.5 w-3.5" style={{ color }} />
            </span>
            <p className="label-caps">{label}</p>
          </div>
          <p className={cn("amount mt-2.5 text-2xl font-semibold tracking-tight md:text-[27px]")} style={{ color }}>
            <AnimatedAmount value={value} />
          </p>
        </div>
      ))}
    </div>
  );
}
