import { getSupabase } from "@/lib/supabase";
import type { Split, SplitDraft } from "@/types/features";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export async function getSplitsForTransaction(transactionId: string): Promise<Split[]> {
  const { data, error } = await getSupabase()
    .from("splits")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });
  if (error) fail("Failed to load splits", error);
  return (data ?? []) as Split[];
}

/** Replaces a transaction's split members atomically enough for this scale. */
export async function replaceSplitsForTransaction(
  ownerId: string,
  transactionId: string,
  drafts: SplitDraft[]
): Promise<void> {
  const supabase = getSupabase();
  const { error: delError } = await supabase.from("splits").delete().eq("transaction_id", transactionId);
  if (delError) fail("Failed to update splits", delError);
  if (drafts.length === 0) return;
  const { error } = await supabase.from("splits").insert(
    drafts.map((d) => ({
      transaction_id: transactionId,
      owner_id: ownerId,
      person_name: d.person_name,
      amount: d.amount,
      paid_back: d.paid_back,
    }))
  );
  if (error) fail("Failed to save splits", error);
}

export async function setSplitPaidBack(id: string, paidBack: boolean): Promise<void> {
  const { error } = await getSupabase().from("splits").update({ paid_back: paidBack }).eq("id", id);
  if (error) fail("Failed to update split", error);
}

export interface BookSplitSummary {
  /** transaction ids in this book that have at least one split */
  transactionIds: Set<string>;
  /** total unpaid amount others owe the owner */
  owedToYou: number;
  unpaidCount: number;
}

/** One query per book view: which transactions are split + what's still owed. */
export async function getBookSplitSummary(bookId: string): Promise<BookSplitSummary> {
  const { data, error } = await getSupabase()
    .from("splits")
    .select("transaction_id, amount, paid_back, transactions!inner(book_id)")
    .eq("transactions.book_id", bookId);
  if (error) fail("Failed to load split summary", error);
  const rows = (data ?? []) as unknown as Array<{ transaction_id: string; amount: number; paid_back: boolean }>;
  const summary: BookSplitSummary = { transactionIds: new Set(), owedToYou: 0, unpaidCount: 0 };
  for (const r of rows) {
    summary.transactionIds.add(r.transaction_id);
    if (!r.paid_back) {
      summary.owedToYou += Number(r.amount);
      summary.unpaidCount += 1;
    }
  }
  return summary;
}
