"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Minus, PartyPopper, Plus, Trash2 } from "lucide-react";
import { Confetti } from "@/components/ui/Confetti";
import { AnimatedAmount } from "@/components/ui/AnimatedAmount";
import { clamp, formatCurrency, formatDate } from "@/lib/helpers";
import type { SavingsGoal } from "@/types/features";

interface GoalCardProps {
  goal: SavingsGoal;
  index: number;
  onAddFunds: (goal: SavingsGoal) => void;
  onWithdraw: (goal: SavingsGoal) => void;
  onDelete: (goal: SavingsGoal) => void;
}

export function GoalCard({ goal, index, onAddFunds, onWithdraw, onDelete }: GoalCardProps) {
  const saved = Number(goal.saved_amount);
  const target = Number(goal.target_amount);
  const ratio = target > 0 ? saved / target : 0;
  const done = saved >= target && target > 0;
  const [fill, setFill] = useState(0);

  // Progress bar sweeps in on mount / when the value changes.
  useEffect(() => {
    const id = window.setTimeout(() => setFill(clamp(ratio * 100, done ? 100 : 1.5, 100)), 120);
    return () => window.clearTimeout(id);
  }, [ratio, done]);

  return (
    <div
      className="card-surface card-lift shimmer-card group relative overflow-hidden rounded-3xl p-5 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 70, 350)}ms` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-60 w-60 rounded-full opacity-[0.2] blur-3xl transition-opacity duration-500 group-hover:opacity-[0.34]"
        style={{ background: `radial-gradient(circle, ${goal.color}, transparent 68%)` }}
      />
      {done ? <Confetti seed={goal.id.charCodeAt(0) + goal.id.charCodeAt(1)} /> : null}

      <div className="relative flex items-start gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
          style={{
            background: `color-mix(in srgb, ${goal.color} 16%, var(--card-hi))`,
            border: `1px solid color-mix(in srgb, ${goal.color} 38%, transparent)`,
            boxShadow: `0 0 22px -8px ${goal.color}`,
          }}
        >
          {goal.icon_emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-[22px] tracking-tight text-ink">{goal.name}</h3>
            {done ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-on-brand" style={{ background: "var(--brand)", boxShadow: "0 0 16px -4px var(--brand-glow)" }}>
                <PartyPopper className="h-3 w-3" /> Goal reached!
              </span>
            ) : null}
          </div>
          {goal.deadline ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink3">
              <CalendarClock className="h-3.5 w-3.5" /> by {formatDate(goal.deadline)}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-ink3">No deadline — save at your own pace</p>
          )}
        </div>
        <button
          onClick={() => onDelete(goal)}
          aria-label={`Delete goal ${goal.name}`}
          className="press shrink-0 rounded-full p-2 text-ink3 opacity-60 transition-all hover:bg-rose-soft hover:text-rose group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="amount text-lg font-semibold text-ink">
            <AnimatedAmount value={saved} />
            <span className="ml-1 text-sm font-medium text-ink3">of {formatCurrency(target)}</span>
          </p>
          <p className="amount text-sm font-bold" style={{ color: goal.color }}>
            {Math.min(999, Math.round(ratio * 100))}%
          </p>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              width: `${fill}%`,
              background: `linear-gradient(90deg, color-mix(in srgb, ${goal.color} 75%, transparent), ${goal.color})`,
              boxShadow: `0 0 14px -2px ${goal.color}`,
            }}
          />
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5">
        <button
          onClick={() => onAddFunds(goal)}
          className="press flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-on-brand transition-all hover:brightness-110"
          style={{ background: "var(--brand)", boxShadow: "0 0 16px -6px var(--brand-glow)" }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Add funds
        </button>
        <button
          onClick={() => onWithdraw(goal)}
          disabled={saved <= 0}
          className="press flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[13px] font-bold text-ink2 transition-colors hover:bg-card-hi hover:text-ink disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={3} /> Withdraw
        </button>
      </div>
    </div>
  );
}
