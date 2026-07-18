"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  Crown,
  Download,
  Flame,
  Layers,
  ListOrdered,
  LogOut,
  Pencil,
  Scale,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { ThemeSegmented } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AnimatedAmount } from "@/components/ui/AnimatedAmount";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { getUserProfile } from "@/lib/database";
import { deleteAllUserData, exportAllData, getAccountStatsV4, updateDisplayName } from "@/lib/features/account";
import { formatCurrency, formatDate, getInitials } from "@/lib/helpers";
import { APP_VERSION } from "@/lib/constants";
import type { UserProfile } from "@/types";
import type { AccountStatsV4 } from "@/types/features";

const EMPTY_STATS: AccountStatsV4 = {
  books: 0,
  transactions: 0,
  cashIn: 0,
  cashOut: 0,
  biggestExpense: null,
  bestMonth: null,
  topCategory: null,
  avgMonthlySpend: 0,
  avgTransactionAmount: 0,
  largestCashIn: null,
  currentStreak: 0,
  longestStreak: 0,
  activeDays: 0,
  topWeekday: null,
};

const countFormat = (n: number): string => String(Math.round(n));
const daysFormat = (n: number): string => `${Math.round(n)} ${Math.round(n) === 1 ? "day" : "days"}`;

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}

interface StatCardData {
  label: string;
  /** null → no data yet, renders an em dash */
  value: number | null;
  sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  soft: string;
  format: (n: number) => string;
}

function StatGrid({ cards }: { cards: StatCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(({ label, value, sub, icon: Icon, color, soft, format }, i) => (
        <div
          key={label}
          className="card-surface card-lift shimmer-card rounded-2xl p-4 animate-fade-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: soft }}>
              <Icon className="h-3.5 w-3.5" style={{ color }} />
            </span>
            <p className="label-caps">{label}</p>
          </div>
          <p className="amount mt-2.5 truncate text-[22px] font-semibold tracking-tight" style={{ color }}>
            {value === null ? "—" : <AnimatedAmount value={value} format={format} />}
          </p>
          {sub ? <p className="mt-1 truncate text-xs text-ink3">{sub}</p> : null}
        </div>
      ))}
    </div>
  );
}

function StatGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

function SettingsContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<AccountStatsV4 | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getUserProfile(user.id)
      .then(setProfile)
      .catch(() => undefined);
    void getAccountStatsV4(user.id)
      .then(setStats)
      .catch(() => setStats(EMPTY_STATS));
  }, [user]);

  const fallbackName = (user?.user_metadata.full_name as string | undefined) ?? "";
  const name = profile?.display_name ?? fallbackName;
  const photo = profile?.photo_url ?? (user?.user_metadata.avatar_url as string | undefined);

  const saveName = async (): Promise<void> => {
    if (!user || !nameDraft.trim() || savingName) return;
    setSavingName(true);
    try {
      await updateDisplayName({
        id: user.id,
        display_name: nameDraft.trim(),
        email: profile?.email ?? user.email ?? null,
        photo_url: photo ?? null,
      });
      setProfile((p) => (p ? { ...p, display_name: nameDraft.trim() } : p));
      setEditingName(false);
      toast("Name updated", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update name", "error");
    } finally {
      setSavingName(false);
    }
  };

  const numberCards = stats
    ? [
        { label: "Books", value: stats.books, icon: BookOpen, color: "var(--brand-deep)", soft: "var(--brand-soft)", format: countFormat },
        { label: "Transactions", value: stats.transactions, icon: ListOrdered, color: "var(--ink)", soft: "var(--bg-sunken)", format: countFormat },
        { label: "All-time Cash In", value: stats.cashIn, icon: ArrowDownLeft, color: "var(--jade)", soft: "var(--jade-soft)", format: formatCurrency },
        { label: "All-time Cash Out", value: stats.cashOut, icon: ArrowUpRight, color: "var(--rose)", soft: "var(--rose-soft)", format: formatCurrency },
      ]
    : null;

  const patternCards = stats
    ? [
        {
          label: "Biggest expense",
          value: stats.biggestExpense?.amount ?? null,
          sub: stats.biggestExpense ? `${stats.biggestExpense.category} · ${formatDate(stats.biggestExpense.date)}` : "No expenses yet",
          icon: Crown,
          color: "var(--rose)",
          soft: "var(--rose-soft)",
          format: formatCurrency,
        },
        {
          label: "Best month",
          value: stats.bestMonth?.net ?? null,
          sub: stats.bestMonth ? stats.bestMonth.label : "No months yet",
          icon: Trophy,
          color: "var(--jade)",
          soft: "var(--jade-soft)",
          format: formatCurrency,
        },
        {
          label: "Top category",
          value: stats.topCategory?.total ?? null,
          sub: stats.topCategory
            ? `${stats.topCategory.name} · ${stats.topCategory.count} ${stats.topCategory.count === 1 ? "entry" : "entries"}`
            : "No entries yet",
          icon: Layers,
          color: "var(--brand-deep)",
          soft: "var(--brand-soft)",
          format: formatCurrency,
        },
        {
          label: "Avg monthly spend",
          value: stats.avgMonthlySpend,
          sub: "Cash Out across active months",
          icon: CalendarRange,
          color: "var(--rose)",
          soft: "var(--rose-soft)",
          format: formatCurrency,
        },
        {
          label: "Avg transaction",
          value: stats.avgTransactionAmount,
          sub: "Typical entry size",
          icon: Scale,
          color: "var(--ink)",
          soft: "var(--bg-sunken)",
          format: formatCurrency,
        },
        {
          label: "Largest Cash In",
          value: stats.largestCashIn?.amount ?? null,
          sub: stats.largestCashIn ? `${stats.largestCashIn.category} · ${formatDate(stats.largestCashIn.date)}` : "No income yet",
          icon: Sparkles,
          color: "var(--jade)",
          soft: "var(--jade-soft)",
          format: formatCurrency,
        },
      ]
    : null;

  const activityCards = stats
    ? [
        { label: "Current streak", value: stats.currentStreak, sub: "Consecutive days with an entry", icon: Flame, color: "var(--warn)", soft: "var(--brand-soft)", format: daysFormat },
        { label: "Longest streak", value: stats.longestStreak, sub: "Your best run ever", icon: Trophy, color: "var(--brand-deep)", soft: "var(--brand-soft)", format: daysFormat },
        { label: "Active days", value: stats.activeDays, sub: "Days with at least one entry", icon: CalendarDays, color: "var(--ink)", soft: "var(--bg-sunken)", format: countFormat },
        {
          label: "Most active day",
          value: stats.topWeekday?.count ?? null,
          sub: stats.topWeekday ? `${stats.topWeekday.name} — most entries logged` : "No entries yet",
          icon: CalendarClock,
          color: "var(--jade)",
          soft: "var(--jade-soft)",
          format: (n: number) => `${Math.round(n)} entries`,
        },
      ]
    : null;

  return (
    <>
      <Header title="Settings" hero />
      <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-6 md:px-8">
        {/* Profile */}
        <section className="card-surface backlit shimmer-card relative overflow-hidden rounded-3xl p-6 animate-fade-up">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full opacity-20 blur-2xl"
            style={{ background: "radial-gradient(circle, var(--brand), transparent 65%)" }}
          />
          <div className="relative flex items-center gap-4">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                className="h-20 w-20 rounded-full border-2 border-line-strong shadow-card"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sunken font-display text-2xl text-ink2">
                {getInitials(name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameDraft}
                    autoFocus
                    maxLength={60}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    className="w-full rounded-lg border border-brand bg-card-hi px-2.5 py-1.5 font-display text-xl text-ink outline-none ring-4 ring-brand-soft"
                    aria-label="Display name"
                  />
                  <button
                    onClick={() => void saveName()}
                    disabled={savingName}
                    aria-label="Save name"
                    className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-2xl tracking-tight text-ink">{name || "You"}</p>
                  <button
                    onClick={() => {
                      setNameDraft(name);
                      setEditingName(true);
                    }}
                    aria-label="Edit display name"
                    className="press shrink-0 rounded-full p-1.5 text-ink3 transition-colors hover:bg-card-hi hover:text-brand-deep"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <p className="truncate text-sm text-ink3">{profile?.email ?? user?.email}</p>
              {profile?.created_at ? (
                <p className="mt-1 text-xs text-ink3">Member since {formatDate(profile.created_at, "d MMM yyyy")}</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="animate-fade-up" style={{ animationDelay: "70ms" }}>
          <h2 className="label-caps mb-3">Your numbers</h2>
          {numberCards ? <StatGrid cards={numberCards} /> : <StatGridSkeleton count={4} />}
        </section>

        <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <h2 className="label-caps mb-3">Patterns</h2>
          {patternCards ? <StatGrid cards={patternCards} /> : <StatGridSkeleton count={6} />}
        </section>

        <section className="animate-fade-up" style={{ animationDelay: "130ms" }}>
          <h2 className="label-caps mb-3">Activity</h2>
          {activityCards ? <StatGrid cards={activityCards} /> : <StatGridSkeleton count={4} />}
        </section>

        {/* Appearance */}
        <section className="animate-fade-up" style={{ animationDelay: "140ms" }}>
          <h2 className="label-caps mb-3">Appearance</h2>
          <ThemeSegmented />
        </section>

        {/* Data */}
        <section className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <h2 className="label-caps mb-3">Data</h2>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            icon={<Download className="h-4 w-4" />}
            loading={exporting}
            onClick={async () => {
              if (!user) return;
              setExporting(true);
              try {
                await exportAllData(user.id);
                toast("Complete export downloaded", "success");
              } catch (e) {
                toast(e instanceof Error ? e.message : "Export failed", "error");
              } finally {
                setExporting(false);
              }
            }}
          >
            Export all data (.xlsx — one sheet per book)
          </Button>
        </section>

        {/* Account */}
        <section className="flex flex-col gap-3 animate-fade-up" style={{ animationDelay: "260ms" }}>
          <h2 className="label-caps">Account</h2>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            icon={<LogOut className="h-4 w-4" />}
            onClick={() => setConfirmSignOut(true)}
          >
            Sign out
          </Button>
          <div className="rounded-2xl border border-rose/25 bg-rose-soft/50 p-4">
            <p className="text-sm font-semibold text-ink">Danger zone</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink2">
              Permanently deletes every book, transaction, goal, document, link and payment method — then signs you
              out. There is no undo.
            </p>
            <Button
              variant="danger"
              size="sm"
              className="mt-3"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setConfirmDelete(true)}
            >
              Delete account
            </Button>
          </div>
        </section>

        <p className="mt-2 text-center text-xs text-ink3 animate-fade-up" style={{ animationDelay: "320ms" }}>
          SpendBook v{APP_VERSION} · crafted for Indian families
        </p>
      </main>

      <ConfirmDialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title="Sign out?"
        message="Your data stays safely in your account. Sign back in anytime."
        confirmLabel="Sign out"
        onConfirm={async () => {
          try {
            await signOut();
            router.replace("/");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Sign out failed", "error");
          }
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your account?"
        message="Every book, transaction, goal, wallet document, profile link and payment method will be permanently erased. This cannot be undone."
        confirmLabel="Delete everything"
        destructive
        onConfirm={async () => {
          if (!user) return;
          try {
            await deleteAllUserData(user.id);
            await signOut();
            toast("Account data deleted", "info");
            router.replace("/");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Deletion failed", "error");
          }
        }}
      />
    </>
  );
}
