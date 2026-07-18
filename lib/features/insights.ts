import { getSupabase } from "@/lib/supabase";
import type { Transaction } from "@/types";

/**
 * Per-book self-transfer totals. The frozen getBooksWithStats counts every
 * non-'in' row as Cash Out, so callers subtract these sums to keep transfer
 * rows out of the book cards' totals.
 */
export async function getTransferTotalsByBook(ownerId: string): Promise<Map<string, number>> {
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("book_id, amount")
    .eq("owner_id", ownerId)
    .eq("type", "transfer");
  if (error) throw new Error(`Failed to load transfer totals: ${error.message}`);
  const totals = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ book_id: string; amount: number }>) {
    totals.set(row.book_id, (totals.get(row.book_id) ?? 0) + Number(row.amount));
  }
  return totals;
}

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
