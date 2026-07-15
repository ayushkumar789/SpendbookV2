import { getSupabase } from "@/lib/supabase";
import type { NewGoalInput, SavingsGoal } from "@/types/features";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export async function getGoals(ownerId: string): Promise<SavingsGoal[]> {
  const { data, error } = await getSupabase()
    .from("savings_goals")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) fail("Failed to load goals", error);
  return (data ?? []) as SavingsGoal[];
}

export async function createGoal(ownerId: string, input: NewGoalInput): Promise<SavingsGoal> {
  const { data, error } = await getSupabase()
    .from("savings_goals")
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single();
  if (error) fail("Failed to create goal", error);
  return data as SavingsGoal;
}

export async function updateGoal(id: string, patch: Partial<NewGoalInput>): Promise<SavingsGoal> {
  const { data, error } = await getSupabase().from("savings_goals").update(patch).eq("id", id).select().single();
  if (error) fail("Failed to update goal", error);
  return data as SavingsGoal;
}

/** Positive delta adds funds, negative withdraws — clamped at zero. */
export async function adjustGoalFunds(goal: SavingsGoal, delta: number): Promise<SavingsGoal> {
  const next = Math.max(0, Number(goal.saved_amount) + delta);
  const { data, error } = await getSupabase()
    .from("savings_goals")
    .update({ saved_amount: next })
    .eq("id", goal.id)
    .select()
    .single();
  if (error) fail("Failed to update goal funds", error);
  return data as SavingsGoal;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await getSupabase().from("savings_goals").delete().eq("id", id);
  if (error) fail("Failed to delete goal", error);
}
