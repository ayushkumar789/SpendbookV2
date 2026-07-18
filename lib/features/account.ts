import * as XLSX from "xlsx";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { getSupabase } from "@/lib/supabase";
import { getBooksWithStats, getTransactionsForBook, getPaymentMethods, upsertUserProfile } from "@/lib/database";
import { formatDate, methodLabel, todayISO } from "@/lib/helpers";
import type { AccountStats, AccountStatsV4, StatHighlight } from "@/types/features";

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

/**
 * v4 rich account stats — one transactions query + a books head-count.
 * Self transfers count toward activity (they were logged) but never toward
 * any money total.
 */
export async function getAccountStatsV4(ownerId: string): Promise<AccountStatsV4> {
  const supabase = getSupabase();
  const [booksRes, txRes] = await Promise.all([
    supabase.from("books").select("id", { count: "exact", head: true }).eq("owner_id", ownerId),
    supabase.from("transactions").select("type, amount, category, date").eq("owner_id", ownerId),
  ]);
  if (booksRes.error) fail("Failed to count books", booksRes.error);
  if (txRes.error) fail("Failed to load transactions", txRes.error);

  const rows = (txRes.data ?? []) as Array<{ type: string; amount: number; category: string; date: string }>;

  let cashIn = 0;
  let cashOut = 0;
  let biggestExpense: StatHighlight | null = null;
  let largestCashIn: StatHighlight | null = null;
  const netByMonth = new Map<string, number>();
  const byCategory = new Map<string, { count: number; total: number }>();
  const activeDates = new Set<string>();
  const weekdayCounts = new Map<string, number>();
  let moneyCount = 0;

  for (const r of rows) {
    activeDates.add(r.date);
    const weekday = format(parseISO(r.date), "EEEE");
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);

    if (r.type !== "in" && r.type !== "out") continue; // transfers: activity only
    const amt = Number(r.amount);
    moneyCount += 1;
    if (r.type === "in") {
      cashIn += amt;
      if (!largestCashIn || amt > largestCashIn.amount) {
        largestCashIn = { amount: amt, category: r.category, date: r.date };
      }
    } else {
      cashOut += amt;
      if (!biggestExpense || amt > biggestExpense.amount) {
        biggestExpense = { amount: amt, category: r.category, date: r.date };
      }
    }
    const monthKey = r.date.slice(0, 7);
    netByMonth.set(monthKey, (netByMonth.get(monthKey) ?? 0) + (r.type === "in" ? amt : -amt));
    const cat = byCategory.get(r.category) ?? { count: 0, total: 0 };
    cat.count += 1;
    cat.total += amt;
    byCategory.set(r.category, cat);
  }

  let bestMonth: AccountStatsV4["bestMonth"] = null;
  for (const [key, net] of netByMonth) {
    if (!bestMonth || net > bestMonth.net) {
      bestMonth = { label: format(parseISO(`${key}-01`), "MMMM yyyy"), net };
    }
  }

  let topCategory: AccountStatsV4["topCategory"] = null;
  for (const [name, { count, total }] of byCategory) {
    if (!topCategory || count > topCategory.count || (count === topCategory.count && total > topCategory.total)) {
      topCategory = { name, count, total };
    }
  }

  let topWeekday: AccountStatsV4["topWeekday"] = null;
  for (const [name, count] of weekdayCounts) {
    if (!topWeekday || count > topWeekday.count) topWeekday = { name, count };
  }

  // Streaks over the distinct active dates (ISO strings sort chronologically)
  const sortedDates = [...activeDates].sort();
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sortedDates) {
    run = prev !== null && differenceInCalendarDays(parseISO(d), parseISO(prev)) === 1 ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
    prev = d;
  }

  // Current streak: consecutive days ending today (or yesterday, so it
  // doesn't reset before the user logs anything today).
  let currentStreak = 0;
  const today = todayISO();
  let cursor = activeDates.has(today) ? parseISO(today) : subDays(parseISO(today), 1);
  while (activeDates.has(format(cursor, "yyyy-MM-dd"))) {
    currentStreak += 1;
    cursor = subDays(cursor, 1);
  }

  return {
    books: booksRes.count ?? 0,
    transactions: rows.length,
    cashIn,
    cashOut,
    biggestExpense,
    bestMonth,
    topCategory,
    avgMonthlySpend: netByMonth.size > 0 ? cashOut / netByMonth.size : 0,
    avgTransactionAmount: moneyCount > 0 ? (cashIn + cashOut) / moneyCount : 0,
    largestCashIn,
    currentStreak,
    longestStreak,
    activeDays: activeDates.size,
    topWeekday,
  };
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
    const rows = transactions.map((t) => {
      const txnType = t.type as string;
      return [
        formatDate(t.date, "dd/MM/yyyy"),
        txnType === "in" ? "Cash In" : txnType === "transfer" ? "Transfer" : "Cash Out",
        t.category,
        txnType === "out" ? -Number(t.amount) : Number(t.amount),
        methodLabel(t.payment_method_id, methods),
        t.note ?? "",
      ];
    });
    // Recompute totals from the rows — the frozen book stats lump transfers into Cash Out.
    const cashIn = transactions.reduce((s, t) => (t.type === "in" ? s + Number(t.amount) : s), 0);
    const cashOut = transactions.reduce((s, t) => (t.type === "out" ? s + Number(t.amount) : s), 0);
    const ws = XLSX.utils.aoa_to_sheet([
      [`SpendBook — ${book.name}`],
      ["Cash In", cashIn],
      ["Cash Out", cashOut],
      ["Net Balance", cashIn - cashOut],
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

  const tables = ["profile_links", "wallet_documents", "savings_goals", "books", "payment_methods", "contacts", "users"];
  for (const table of tables) {
    const column = table === "users" ? "id" : "owner_id";
    const { error } = await supabase.from(table).delete().eq(column, ownerId);
    if (error) fail(`Failed to delete ${table.replace("_", " ")}`, error);
  }
}
