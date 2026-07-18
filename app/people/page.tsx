"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowSkeleton } from "@/components/ui/Skeleton";
import { formatBalance } from "@/lib/features/accounts";
import {
  getSavedProfilesWithBalances,
  removeSavedProfile,
  subscribeToPublicBalances,
} from "@/lib/features/people";
import { getInitials } from "@/lib/helpers";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import type { SavedProfileWithBalances } from "@/types/features";

export default function PeoplePage() {
  return (
    <AppShell>
      <PeopleContent />
    </AppShell>
  );
}

function PeopleContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [people, setPeople] = useState<SavedProfileWithBalances[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRemove, setPendingRemove] = useState<SavedProfileWithBalances | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setPeople(await getSavedProfilesWithBalances(user.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load your people", "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live balances: whenever a snapshot changes in any watched public group,
  // reload the cards — no refresh needed.
  useEffect(() => {
    const groupIds = people.flatMap((p) => p.balances.map((b) => b.id));
    if (groupIds.length === 0) return;
    return subscribeToPublicBalances(groupIds, () => void refresh());
  }, [people, refresh]);

  return (
    <>
      <Header title="People" subtitle="Profiles you follow" hero />

      <main className="mx-auto max-w-2xl px-4 py-6 md:px-8">
        {loading ? (
          <div className="card-surface rounded-3xl">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : people.length === 0 ? (
          <EmptyState
            illustration="books"
            title="No people saved yet"
            message="When someone shares their SpendBook profile with you, save it here for quick access."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {people.map((p, i) => (
              <div
                key={p.id}
                className="card-surface card-lift relative overflow-hidden rounded-3xl p-5 animate-fade-up"
                style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
              >
                <button
                  onClick={() => setPendingRemove(p)}
                  aria-label={`Remove ${p.saved_display_name}`}
                  title="Remove from People"
                  className="press absolute right-3.5 top-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-full text-ink3 transition-colors hover:bg-rose-soft hover:text-rose"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-3.5 pr-8">
                  {p.saved_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.saved_photo_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 shrink-0 rounded-full border border-line-strong"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card-hi font-display text-lg text-ink2">
                      {getInitials(p.saved_display_name)}
                    </span>
                  )}
                  <p className="min-w-0 flex-1 truncate font-display text-[20px] font-bold tracking-tight text-ink">
                    {p.saved_display_name}
                  </p>
                </div>

                {/* Public balances at a glance */}
                {p.balances.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-2">
                    {p.balances.map((b) => (
                      <div
                        key={b.id}
                        className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-card-hi px-4 py-3"
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -left-6 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full opacity-[0.18] blur-2xl"
                          style={{ background: b.color }}
                        />
                        <span className="relative h-1.5 w-1.5 shrink-0 rounded-full bg-jade animate-pulse-dot" />
                        <p className="relative min-w-0 flex-1 truncate text-[13px] font-semibold text-ink2">{b.name}</p>
                        <p className="amount relative shrink-0 text-[17px] font-semibold text-ink">
                          {b.balance !== null ? formatBalance(Number(b.balance)) : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  icon={<ArrowUpRight className="h-4 w-4" />}
                  onClick={() => router.push(`/u/${p.saved_user_id}`)}
                >
                  View profile
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        title={pendingRemove ? `Remove ${pendingRemove.saved_display_name} from your People?` : "Remove?"}
        message="You can save them again anytime from their profile page."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!pendingRemove || !user) return;
          await removeSavedProfile(user.id, pendingRemove.saved_user_id);
          setPendingRemove(null);
          toast("Removed from your People", "info");
          await refresh();
        }}
      />
    </>
  );
}
