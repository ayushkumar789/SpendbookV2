import { getSupabase } from "@/lib/supabase";
import type { SearchHit } from "@/types/features";

/**
 * Live search across every book the user owns.
 * Matches note/category (ilike) and — when the query parses as a number —
 * exact amounts too.
 */
export async function searchTransactions(ownerId: string, query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const escaped = q.replace(/[%_,()]/g, " ").trim();
  const ors = [`note.ilike.%${escaped}%`, `category.ilike.%${escaped}%`];
  const numeric = Number(q.replace(/[₹,\s]/g, ""));
  if (Number.isFinite(numeric) && q.replace(/[₹,\s]/g, "").length > 0 && /^[\d.,₹\s]+$/.test(q)) {
    ors.push(`amount.eq.${numeric}`);
  }

  const { data, error } = await getSupabase()
    .from("transactions")
    .select("*, book:books(id, name, icon_emoji)")
    .eq("owner_id", ownerId)
    .or(ors.join(","))
    .order("date", { ascending: false })
    .limit(30);
  if (error) throw new Error(`Search failed: ${error.message}`);
  return (data ?? []) as unknown as SearchHit[];
}
