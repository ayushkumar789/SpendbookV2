import { getSupabase } from "@/lib/supabase";
import { generateShareId } from "@/lib/helpers";
import type {
  Book,
  BookStats,
  BookWithStats,
  NewBookInput,
  NewPaymentMethodInput,
  NewTransactionInput,
  PaymentMethod,
  SharedBook,
  Transaction,
  UserProfile,
} from "@/types";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

/* ————— Users ————— */

export async function upsertUserProfile(profile: {
  id: string;
  display_name: string | null;
  email: string | null;
  photo_url: string | null;
}): Promise<void> {
  const { error } = await getSupabase().from("users").upsert(profile, { onConflict: "id" });
  if (error) fail("Failed to save profile", error);
}

export async function getUserProfile(id: string): Promise<UserProfile | null> {
  const { data, error } = await getSupabase().from("users").select("*").eq("id", id).maybeSingle();
  if (error) fail("Failed to load profile", error);
  return data as UserProfile | null;
}

/* ————— Books ————— */

export async function getBooksWithStats(ownerId: string): Promise<BookWithStats[]> {
  const supabase = getSupabase();
  const [booksRes, txRes] = await Promise.all([
    supabase.from("books").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false }),
    supabase.from("transactions").select("book_id, type, amount").eq("owner_id", ownerId),
  ]);
  if (booksRes.error) fail("Failed to load books", booksRes.error);
  if (txRes.error) fail("Failed to load book totals", txRes.error);

  const statsByBook = new Map<string, BookStats>();
  for (const t of (txRes.data ?? []) as Pick<Transaction, "book_id" | "type" | "amount">[]) {
    const s = statsByBook.get(t.book_id) ?? { cashIn: 0, cashOut: 0, net: 0, count: 0 };
    if (t.type === "in") s.cashIn += Number(t.amount);
    else s.cashOut += Number(t.amount);
    s.net = s.cashIn - s.cashOut;
    s.count += 1;
    statsByBook.set(t.book_id, s);
  }

  return ((booksRes.data ?? []) as Book[]).map((b) => ({
    ...b,
    stats: statsByBook.get(b.id) ?? { cashIn: 0, cashOut: 0, net: 0, count: 0 },
  }));
}

export async function getBook(id: string): Promise<Book | null> {
  const { data, error } = await getSupabase().from("books").select("*").eq("id", id).maybeSingle();
  if (error) fail("Failed to load book", error);
  return data as Book | null;
}

export async function createBook(ownerId: string, input: NewBookInput): Promise<Book> {
  const { data, error } = await getSupabase()
    .from("books")
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single();
  if (error) fail("Failed to create book", error);
  return data as Book;
}

export async function updateBook(id: string, patch: Partial<NewBookInput>): Promise<Book> {
  const { data, error } = await getSupabase().from("books").update(patch).eq("id", id).select().single();
  if (error) fail("Failed to update book", error);
  return data as Book;
}

/** Transactions cascade-delete via FK, so a single delete is enough. */
export async function deleteBook(id: string): Promise<void> {
  const { error } = await getSupabase().from("books").delete().eq("id", id);
  if (error) fail("Failed to delete book", error);
}

/* ————— Payment methods ————— */

export async function getPaymentMethods(ownerId: string): Promise<PaymentMethod[]> {
  const { data, error } = await getSupabase()
    .from("payment_methods")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) fail("Failed to load payment methods", error);
  return (data ?? []) as PaymentMethod[];
}

export async function createPaymentMethod(
  ownerId: string,
  input: NewPaymentMethodInput
): Promise<PaymentMethod> {
  const { data, error } = await getSupabase()
    .from("payment_methods")
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single();
  if (error) fail("Failed to save payment method", error);
  return data as PaymentMethod;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const { error } = await getSupabase().from("payment_methods").delete().eq("id", id);
  if (error) fail("Failed to delete payment method", error);
}

/* ————— Transactions ————— */

export async function getTransactionsForBook(bookId: string): Promise<Transaction[]> {
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("*")
    .eq("book_id", bookId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) fail("Failed to load transactions", error);
  return (data ?? []) as Transaction[];
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await getSupabase().from("transactions").select("*").eq("id", id).maybeSingle();
  if (error) fail("Failed to load transaction", error);
  return data as Transaction | null;
}

export async function createTransaction(ownerId: string, input: NewTransactionInput): Promise<Transaction> {
  const { data, error } = await getSupabase()
    .from("transactions")
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single();
  if (error) fail("Failed to save transaction", error);
  return data as Transaction;
}

export async function updateTransaction(
  id: string,
  patch: Partial<NewTransactionInput>
): Promise<Transaction> {
  const { data, error } = await getSupabase()
    .from("transactions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) fail("Failed to update transaction", error);
  return data as Transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await getSupabase().from("transactions").delete().eq("id", id);
  if (error) fail("Failed to delete transaction", error);
}

/* ————— Recurring ————— */

export async function getDueRecurringTransactions(ownerId: string, todayIso: string): Promise<Transaction[]> {
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("is_recurring", true)
    .lte("next_recurrence_date", todayIso);
  if (error) fail("Failed to check recurring transactions", error);
  return (data ?? []) as Transaction[];
}

export async function insertRecurringCopies(
  copies: Array<NewTransactionInput & { owner_id: string }>
): Promise<void> {
  if (copies.length === 0) return;
  const { error } = await getSupabase().from("transactions").insert(copies);
  if (error) fail("Failed to create recurring transactions", error);
}

export async function updateNextRecurrence(id: string, nextDate: string): Promise<void> {
  const { error } = await getSupabase()
    .from("transactions")
    .update({ next_recurrence_date: nextDate })
    .eq("id", id);
  if (error) fail("Failed to advance recurring transaction", error);
}

/* ————— Sharing ————— */

export async function enableSharing(book: Book): Promise<Book> {
  const shareId = book.share_id ?? generateShareId();
  const { data, error } = await getSupabase()
    .from("books")
    .update({ is_shared: true, share_id: shareId })
    .eq("id", book.id)
    .select()
    .single();
  if (error) fail("Failed to enable sharing", error);
  return data as Book;
}

export async function stopSharing(bookId: string): Promise<Book> {
  const { data, error } = await getSupabase()
    .from("books")
    .update({ is_shared: false })
    .eq("id", bookId)
    .select()
    .single();
  if (error) fail("Failed to stop sharing", error);
  return data as Book;
}

/** New UUID — the old link stops resolving immediately. */
export async function resetShareLink(bookId: string): Promise<Book> {
  const { data, error } = await getSupabase()
    .from("books")
    .update({ share_id: generateShareId(), is_shared: true })
    .eq("id", bookId)
    .select()
    .single();
  if (error) fail("Failed to reset share link", error);
  return data as Book;
}

/** Anonymous read — RLS only exposes books with is_shared = true. */
export async function getSharedBook(shareId: string): Promise<SharedBook | null> {
  const { data, error } = await getSupabase()
    .from("books")
    .select("*, owner:users(display_name)")
    .eq("share_id", shareId)
    .eq("is_shared", true)
    .maybeSingle();
  if (error) fail("Failed to load shared book", error);
  return data as SharedBook | null;
}

export async function getSharedTransactions(bookId: string): Promise<Transaction[]> {
  return getTransactionsForBook(bookId);
}

/** Realtime subscription to a shared book's transactions + the book row itself. */
export function subscribeToSharedBook(
  bookId: string,
  onChange: () => void
): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`shared-book-${bookId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "transactions", filter: `book_id=eq.${bookId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "books", filter: `id=eq.${bookId}` },
      onChange
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
