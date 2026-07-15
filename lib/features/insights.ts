import { getSupabase } from "@/lib/supabase";
import type { Transaction } from "@/types";

/** All of the user's transactions across every book — insights are cross-book. */
export async function getAllTransactionsForOwner(ownerId: string): Promise<Transaction[]> {
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("*")
    .eq("owner_id", ownerId)
    .order("date", { ascending: false });
  if (error) throw new Error(`Failed to load insights data: ${error.message}`);
  return (data ?? []) as Transaction[];
}
