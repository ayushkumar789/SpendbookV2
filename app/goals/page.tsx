"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Plus, Target, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { GoalCard } from "@/components/goals/GoalCard";
import { Button } from "@/components/ui/Button";
import { FieldWrap, Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookCardSkeleton } from "@/components/ui/Skeleton";
import { adjustGoalFunds, createGoal, deleteGoal, getGoals } from "@/lib/features/goals";
import { GOAL_COLORS, BOOK_EMOJIS } from "@/lib/constants";
import { cn, formatCurrency, formatIndianDigits, parseAmountInput } from "@/lib/helpers";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import type { SavingsGoal } from "@/types/features";

export default function GoalsPage() {
  return (
    <AppShell>
      <GoalsContent />
    </AppShell>
  );
}

function GoalsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [fundsGoal, setFundsGoal] = useState<{ goal: SavingsGoal; mode: "add" | "withdraw" } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavingsGoal | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setGoals(await getGoals(user.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load goals", "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <Header
        title="Savings goals"
        subtitle="Name it, fund it, reach it"
        hero
        actions={
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
            onClick={() => setCreateOpen(true)}
            className="hidden sm:inline-flex"
          >
            New goal
          </Button>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BookCardSkeleton />
            <BookCardSkeleton />
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            illustration="books"
            title="Dream in numbers"
            message="A new phone, an emergency fund, Goa in December — give each one a goal and watch it fill up."
            action={
              <Button size="lg" icon={<Target className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                Create a goal
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {goals.map((g, i) => (
              <GoalCard
                key={g.id}
                goal={g}
                index={i}
                onAddFunds={(goal) => setFundsGoal({ goal, mode: "add" })}
                onWithdraw={(goal) => setFundsGoal({ goal, mode: "withdraw" })}
                onDelete={setPendingDelete}
              />
            ))}
          </div>
        )}
      </main>

      <button
        onClick={() => setCreateOpen(true)}
        aria-label="New goal"
        className="shimmer-border press fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-nav transition-transform hover:scale-105 md:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <CreateGoalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (input) => {
          if (!user) return;
          await createGoal(user.id, input);
          toast("Goal created — go get it!", "success");
          setCreateOpen(false);
          await refresh();
        }}
      />

      {fundsGoal ? (
        <FundsDialog
          goal={fundsGoal.goal}
          mode={fundsGoal.mode}
          onClose={() => setFundsGoal(null)}
          onApply={async (delta) => {
            const wasDone = Number(fundsGoal.goal.saved_amount) >= Number(fundsGoal.goal.target_amount);
            const updated = await adjustGoalFunds(fundsGoal.goal, delta);
            const isDone = Number(updated.saved_amount) >= Number(updated.target_amount);
            toast(
              delta >= 0 ? `${formatCurrency(delta)} added to ${updated.name}` : `${formatCurrency(-delta)} withdrawn`,
              "success"
            );
            if (!wasDone && isDone) toast(`🎉 ${updated.name} — goal reached!`, "success");
            setFundsGoal(null);
            await refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete ? `Delete "${pendingDelete.name}"?` : "Delete goal?"}
        message="The goal and its progress will be removed. Your actual money is unaffected."
        confirmLabel="Delete goal"
        destructive
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteGoal(pendingDelete.id);
          setPendingDelete(null);
          toast("Goal deleted", "info");
          await refresh();
        }}
      />
    </>
  );
}

/* ————— Create goal ————— */

function CreateGoalDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; target_amount: number; color: string; icon_emoji: string; deadline: string | null }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(GOAL_COLORS[0].hex);
  const [emoji, setEmoji] = useState(BOOK_EMOJIS[0]);
  const [errors, setErrors] = useState<{ name?: string; target?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setTarget("");
      setDeadline("");
      setColor(GOAL_COLORS[0].hex);
      setEmoji(BOOK_EMOJIS[0]);
      setErrors({});
    }
  }, [open]);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const parsed = parseAmountInput(target);
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Give the goal a name";
    if (parsed <= 0) next.target = "Enter a target amount";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await onCreate({
        name: name.trim(),
        target_amount: parsed,
        color,
        icon_emoji: emoji,
        deadline: deadline || null,
      });
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "500px",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 className="font-display text-xl tracking-tight text-ink">New savings goal</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press -mr-1 -mt-1 rounded-full p-2 text-ink3 transition-colors hover:bg-sunken hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
        <Input
          label="Goal name"
          placeholder="e.g. Emergency fund"
          value={name}
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((p) => ({ ...p, name: undefined }));
          }}
          error={errors.name}
          autoFocus
        />
        <Input
          label="Target amount"
          placeholder="e.g. 50,000"
          inputMode="numeric"
          value={target}
          onChange={(e) => {
            setTarget(formatIndianDigits(e.target.value));
            setErrors((p) => ({ ...p, target: undefined }));
          }}
          error={errors.target}
          className="amount"
        />
        <FieldWrap label="Deadline · optional">
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-xl border border-line bg-card px-4 py-3 text-[15px] text-ink transition-all focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-soft"
          />
        </FieldWrap>
        <FieldWrap label="Color">
          <div className="flex flex-wrap gap-2.5">
            {GOAL_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                title={c.name}
                onClick={() => setColor(c.hex)}
                aria-pressed={color === c.hex}
                className={cn(
                  "press flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200",
                  color === c.hex ? "scale-110" : "hover:scale-105"
                )}
                style={{
                  background: `linear-gradient(145deg, ${c.hex}, color-mix(in srgb, ${c.hex} 70%, #0b0c0a))`,
                  boxShadow: color === c.hex ? `0 0 16px -2px ${c.hex}` : undefined,
                }}
              >
                {color === c.hex ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : null}
              </button>
            ))}
          </div>
        </FieldWrap>
        <FieldWrap label="Icon">
          <div className="grid grid-cols-6 gap-2">
            {BOOK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
                className={cn(
                  "press flex h-12 items-center justify-center rounded-xl border text-2xl transition-all duration-200",
                  emoji === e ? "border-brand bg-brand-soft shadow-[0_0_14px_-6px_var(--brand-glow)]" : "border-line bg-card hover:border-line-strong"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </FieldWrap>
        <Button type="submit" size="lg" loading={busy}>
          Create goal
        </Button>
      </form>
      </div>
    </div>
  );
}

/* ————— Add / withdraw funds ————— */

function FundsDialog({
  goal,
  mode,
  onClose,
  onApply,
}: {
  goal: SavingsGoal;
  mode: "add" | "withdraw";
  onClose: () => void;
  onApply: (delta: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saved = Number(goal.saved_amount);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const parsed = parseAmountInput(amount);
    if (parsed <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (mode === "withdraw" && parsed > saved) {
      setError(`You've only saved ${formatCurrency(saved)} in this goal`);
      return;
    }
    setBusy(true);
    try {
      await onApply(mode === "add" ? parsed : -parsed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "500px",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 className="font-display text-xl tracking-tight text-ink">
          {mode === "add" ? `Add funds · ${goal.name}` : `Withdraw · ${goal.name}`}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press -mr-1 -mt-1 rounded-full p-2 text-ink3 transition-colors hover:bg-sunken hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
        <p className="text-sm text-ink2">
          Saved so far: <span className="amount font-semibold text-ink">{formatCurrency(saved)}</span> of{" "}
          <span className="amount font-semibold text-ink">{formatCurrency(Number(goal.target_amount))}</span>
        </p>
        <Input
          label={mode === "add" ? "Amount to add" : "Amount to withdraw"}
          placeholder="e.g. 2,000"
          inputMode="numeric"
          value={amount}
          onChange={(e) => {
            setAmount(formatIndianDigits(e.target.value));
            setError(null);
          }}
          error={error}
          className="amount"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} variant={mode === "add" ? "primary" : "ink"}>
            {mode === "add" ? "Add funds" : "Withdraw"}
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}
