"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { AccountCard } from "@/components/accounts/AccountCard";
import { CreateAccountGroup } from "@/components/accounts/CreateAccountGroup";
import { UpdateBalanceOverlay } from "@/components/accounts/UpdateBalanceOverlay";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookCardSkeleton } from "@/components/ui/Skeleton";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import {
  deleteAccountGroup,
  getAccountGroupsWithDetails,
  getGroupedMethodMap,
  setShowOnProfile,
} from "@/lib/features/accounts";
import type { AccountGroupWithDetails } from "@/types/features";

export default function AccountsPage() {
  return (
    <AppShell>
      <AccountsContent />
    </AppShell>
  );
}

function AccountsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { methods } = usePaymentMethods();

  const [groups, setGroups] = useState<AccountGroupWithDetails[]>([]);
  const [groupedMap, setGroupedMap] = useState<Map<string, { groupId: string; groupName: string }>>(new Map());
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState<{ existing: AccountGroupWithDetails | null } | null>(null);
  const [balanceGroup, setBalanceGroup] = useState<AccountGroupWithDetails | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccountGroupWithDetails | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [g, map] = await Promise.all([getAccountGroupsWithDetails(user.id), getGroupedMethodMap(user.id)]);
      setGroups(g);
      setGroupedMap(map);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load accounts", "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleProfile = async (group: AccountGroupWithDetails): Promise<void> => {
    // optimistic — instant feel
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, show_on_profile: !g.show_on_profile } : g)));
    try {
      await setShowOnProfile(group.id, !group.show_on_profile);
      toast(group.show_on_profile ? "Hidden from your profile" : "Balance now visible on your profile", "info");
    } catch (e) {
      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, show_on_profile: group.show_on_profile } : g))
      );
      toast(e instanceof Error ? e.message : "Could not update visibility", "error");
    }
  };

  return (
    <>
      <Header
        title="Accounts"
        subtitle="Live balances across your banks"
        hero
        actions={
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
            onClick={() => setEditorOpen({ existing: null })}
            className="hidden sm:inline-flex"
          >
            Create account
          </Button>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BookCardSkeleton />
            <BookCardSkeleton />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            illustration="methods"
            title="No accounts yet"
            message="Create an account group to track your live balance. Group the payment methods that share one bank account, set the balance once, and every transaction keeps it current."
            action={
              <Button size="lg" icon={<Landmark className="h-4 w-4" />} onClick={() => setEditorOpen({ existing: null })}>
                Create account
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {groups.map((g, i) => (
              <AccountCard
                key={g.id}
                group={g}
                index={i}
                onUpdateBalance={setBalanceGroup}
                onEdit={(group) => setEditorOpen({ existing: group })}
                onDelete={setPendingDelete}
                onToggleProfile={(group) => void toggleProfile(group)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Mobile FAB */}
      <button
        onClick={() => setEditorOpen({ existing: null })}
        aria-label="Create account"
        className="shimmer-border press fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-nav transition-transform hover:scale-105 md:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {editorOpen ? (
        <CreateAccountGroup
          existing={editorOpen.existing}
          methods={methods}
          groupedMap={groupedMap}
          onClose={() => setEditorOpen(null)}
          onSaved={refresh}
        />
      ) : null}

      {balanceGroup ? (
        <UpdateBalanceOverlay group={balanceGroup} onClose={() => setBalanceGroup(null)} onSaved={refresh} />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete ? `Delete "${pendingDelete.name}"?` : "Delete account?"}
        message="The group and its balance history are removed. Your payment methods and transactions are untouched."
        confirmLabel="Delete account"
        destructive
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteAccountGroup(pendingDelete.id);
          setPendingDelete(null);
          toast("Account deleted", "info");
          await refresh();
        }}
      />
    </>
  );
}
