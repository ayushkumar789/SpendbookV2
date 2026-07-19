"use client";

import Link from "next/link";
import { ArrowUpRight, Globe, Pause, Pencil, RefreshCcw, Trash2 } from "lucide-react";
import { BANKS } from "@/lib/constants";
import { formatBalance } from "@/lib/features/accounts";
import { cn, formatDate } from "@/lib/helpers";
import { Button } from "@/components/ui/Button";
import { InitialBadge } from "@/components/ui/Badge";
import type { AccountGroupWithDetails } from "@/types/features";

/** One account group: live balance, member methods, profile toggle, actions. */
export function AccountCard({
  group,
  index,
  onUpdateBalance,
  onEdit,
  onDelete,
  onToggleProfile,
}: {
  group: AccountGroupWithDetails;
  index: number;
  onUpdateBalance: (group: AccountGroupWithDetails) => void;
  onEdit: (group: AccountGroupWithDetails) => void;
  onDelete: (group: AccountGroupWithDetails) => void;
  onToggleProfile: (group: AccountGroupWithDetails) => void;
}) {
  const bankHex = BANKS.find((b) => b.key === group.bank_key)?.hex ?? "#6D7365";
  const hasSnapshot = group.latestSnapshot !== null;

  return (
    <div
      className="card-surface card-lift relative overflow-hidden rounded-3xl p-5 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
    >
      {/* Account color glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-24 h-64 w-64 rounded-full opacity-[0.2] blur-3xl"
        style={{ background: `radial-gradient(circle, ${group.color}, transparent 68%)` }}
      />

      <div className="relative flex items-start gap-3.5">
        <InitialBadge text={group.bank_name.slice(0, 2).toUpperCase()} hex={bankHex} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[20px] tracking-tight text-ink">{group.name}</h3>
          <p className="truncate text-[13px] text-ink3">{group.bank_name}</p>
        </div>
      </div>

      {/* Live balance */}
      <div className="relative mt-4">
        {hasSnapshot && group.liveBalance !== null ? (
          group.balancePaused ? (
            <>
              {/* No primary book: the snapshot baseline, clearly not live */}
              <div className="flex flex-wrap items-center gap-2">
                <p className="label-caps">Balance</p>
                <span className="flex items-center gap-1 rounded-full border border-line bg-sunken px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-warn">
                  <Pause className="h-3 w-3" /> Paused — no primary book set
                </span>
              </div>
              <p className="amount mt-1 flex items-center gap-2 truncate font-display text-[32px] font-semibold tracking-tight text-ink opacity-50">
                <Pause className="h-5 w-5 shrink-0 text-ink3" />
                {formatBalance(group.liveBalance)}
              </p>
              <Link
                href="/home"
                className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand-deep hover:underline"
              >
                Set primary book <ArrowUpRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <>
              <p className="label-caps">Live balance</p>
              <p
                className={cn(
                  "amount mt-1 truncate font-display text-[32px] font-semibold tracking-tight",
                  group.liveBalance < 0 ? "text-rose" : "text-ink"
                )}
              >
                {formatBalance(group.liveBalance)}
              </p>
              {group.primaryBookName ? (
                <p className="mt-0.5 text-xs text-ink3">Tracking {group.primaryBookName}</p>
              ) : null}
              <p className="mt-0.5 text-xs text-ink3">
                Balance set on {formatDate(group.latestSnapshot!.snapshot_date, "d MMM yyyy, h:mm a")}
              </p>
            </>
          )
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line-strong bg-sunken px-4 py-3.5">
            <p className="text-sm font-medium text-ink2">Set your current balance to start tracking</p>
            <Button size="sm" onClick={() => onUpdateBalance(group)}>
              Set balance
            </Button>
          </div>
        )}
      </div>

      {/* Member payment methods */}
      {group.members.length > 0 ? (
        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {group.members.map((m) => {
            const hex = BANKS.find((b) => b.key === m.bank_key)?.hex ?? "#6D7365";
            return (
              <span
                key={m.id}
                className="flex items-center gap-1.5 rounded-full border border-line bg-card-hi py-1 pl-1 pr-2.5 text-[11px] font-semibold text-ink2"
              >
                <InitialBadge text={m.bank_name.slice(0, 2).toUpperCase()} hex={hex} size={20} />
                ····{m.last_four_digits}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* Show on profile */}
      <button
        type="button"
        onClick={() => onToggleProfile(group)}
        aria-pressed={group.show_on_profile}
        className="relative mt-4 flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-3"
      >
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            group.show_on_profile ? "bg-jade-soft" : "bg-sunken"
          )}
        >
          <Globe className={cn("h-4 w-4", group.show_on_profile ? "text-jade" : "text-ink3")} />
        </span>
        <span className="flex-1 text-left">
          <span className="block text-sm font-semibold text-ink">Show on profile</span>
          <span className="block text-xs text-ink3">
            {group.show_on_profile ? "Balance is visible on your public page" : "Only you can see this balance"}
          </span>
        </span>
        <span
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-all duration-200",
            group.show_on_profile
              ? "bg-brand shadow-[0_0_14px_-2px_var(--brand-glow)]"
              : "border border-line-strong bg-sunken"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-all duration-200",
              group.show_on_profile ? "left-[calc(100%-1.625rem)]" : "left-0.5"
            )}
          />
        </span>
      </button>

      {/* Actions */}
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <Button variant="soft" size="sm" icon={<RefreshCcw className="h-3.5 w-3.5" />} onClick={() => onUpdateBalance(group)}>
          Update
        </Button>
        <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEdit(group)}>
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-rose hover:bg-rose-soft hover:text-rose"
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={() => onDelete(group)}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
