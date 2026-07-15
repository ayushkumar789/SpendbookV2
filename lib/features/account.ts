import * as XLSX from "xlsx";
import { getSupabase } from "@/lib/supabase";
import { getBooksWithStats, getTransactionsForBook, getPaymentMethods, upsertUserProfile } from "@/lib/database";
import { formatDate, methodLabel } from "@/lib/helpers";
import type { AccountStats } from "@/types/features";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

/** Live cross-book numbers for the Settings stats grid — one round trip. */
export async function getAccountStats(ownerId: string): Promise<AccountStats> {
  const books = await getBooksWithStats(ownerId);
  return books.reduce<AccountStats>(
    (acc, b) => ({
      books: acc.books + 1,
      transactions: acc.transactions + b.stats.count,
      cashIn: acc.cashIn + b.stats.cashIn,
      cashOut: acc.cashOut + b.stats.cashOut,
    }),
    { books: 0, transactions: 0, cashIn: 0, cashOut: 0 }
  );
}

/** Renames the profile by re-upserting the users row (keeps other fields). */
export async function updateDisplayName(profile: {
  id: string;
  email: string | null;
  photo_url: string | null;
  display_name: string;
}): Promise<void> {
  await upsertUserProfile(profile);
}

/** One .xlsx with a sheet per book — the complete account export. */
export async function exportAllData(ownerId: string): Promise<void> {
  const [books, methods] = await Promise.all([getBooksWithStats(ownerId), getPaymentMethods(ownerId)]);
  if (books.length === 0) throw new Error("Nothing to export yet — create a book first");

  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const book of books) {
    const transactions = await getTransactionsForBook(book.id);
    const rows = transactions.map((t) => [
      formatDate(t.date, "dd/MM/yyyy"),
      t.type === "in" ? "Cash In" : "Cash Out",
      t.category,
      t.type === "in" ? Number(t.amount) : -Number(t.amount),
      methodLabel(t.payment_method_id, methods),
      t.note ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      [`SpendBook — ${book.name}`],
      ["Cash In", book.stats.cashIn],
      ["Cash Out", book.stats.cashOut],
      ["Net Balance", book.stats.net],
      [],
      ["Date", "Type", "Category", "Amount (INR)", "Payment Method", "Note"],
      ...rows,
    ]);
    ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 28 }, { wch: 40 }];
    // Sheet names: ≤31 chars, unique, no []\/:*?
    let name = book.name.replace(/[[\]\\/:*?]/g, " ").trim().slice(0, 28) || "Book";
    let suffix = 1;
    while (usedNames.has(name)) name = `${name.slice(0, 25)} ${++suffix}`;
    usedNames.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  XLSX.writeFile(wb, "spendbook-complete-export.xlsx");
}

/**
 * Deletes every row the user owns. Books cascade their transactions (and
 * splits cascade from transactions); storage folders are emptied best-effort.
 * The auth identity itself can't be removed from the client (needs a service
 * key) — the account is left empty and signed out.
 */
export async function deleteAllUserData(ownerId: string): Promise<void> {
  const supabase = getSupabase();

  for (const bucket of ["receipts", "wallet"]) {
    try {
      const { data: files } = await supabase.storage.from(bucket).list(ownerId, { limit: 1000 });
      if (files && files.length > 0) {
        await supabase.storage.from(bucket).remove(files.map((f) => `${ownerId}/${f.name}`));
      }
    } catch {
      /* bucket may not exist yet — data deletion still proceeds */
    }
  }

  const tables = ["profile_links", "wallet_documents", "savings_goals", "books", "payment_methods", "users"];
  for (const table of tables) {
    const column = table === "users" ? "id" : "owner_id";
    const { error } = await supabase.from(table).delete().eq(column, ownerId);
    if (error) fail(`Failed to delete ${table.replace("_", " ")}`, error);
  }
}
