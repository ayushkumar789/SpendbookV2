import { getSupabase } from "@/lib/supabase";
import { generateShareId } from "@/lib/helpers";
import type { BookStats, PaymentMethod, Transaction } from "@/types";
import type {
  BookV5,
  Contact,
  SavedSharedBook,
  SavedSharedBookCard,
  ShareAccessLevel,
  SharedBookAccess,
  TransactionV4,
} from "@/types/features";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

/* ————— Column mapping ————— */

export const SHARE_ID_COLUMN: Record<ShareAccessLevel, "share_view_id" | "share_details_id" | "share_edit_id"> = {
  view: "share_view_id",
  details: "share_details_id",
  edit: "share_edit_id",
};

export const SHARE_ACTIVE_COLUMN: Record<
  ShareAccessLevel,
  "share_view_active" | "share_details_active" | "share_edit_active"
> = {
  view: "share_view_active",
  details: "share_details_active",
  edit: "share_edit_active",
};

export function shareUrl(shareId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/shared/${shareId}`;
}

/* ————— Owner: manage the three links ————— */

/** Generates the level's share id if missing and turns sharing on. */
export async function ensureShareId(book: BookV5, level: ShareAccessLevel): Promise<BookV5> {
  const column = SHARE_ID_COLUMN[level];
  const patch: Record<string, unknown> = { is_shared: true };
  if (!book[column]) patch[column] = generateShareId();
  const { data, error } = await getSupabase().from("books").update(patch).eq("id", book.id).select().single();
  if (error) fail("Failed to enable sharing", error);
  return data as BookV5;
}

/** Pause / resume one access level without discarding its code. */
export async function setShareLinkActive(
  bookId: string,
  level: ShareAccessLevel,
  active: boolean
): Promise<BookV5> {
  const { data, error } = await getSupabase()
    .from("books")
    .update({ [SHARE_ACTIVE_COLUMN[level]]: active })
    .eq("id", bookId)
    .select()
    .single();
  if (error) fail("Failed to update the link", error);
  return data as BookV5;
}

/** New UUID for one level — the old link stops resolving immediately. */
export async function resetShareId(bookId: string, level: ShareAccessLevel): Promise<BookV5> {
  const { data, error } = await getSupabase()
    .from("books")
    .update({ [SHARE_ID_COLUMN[level]]: generateShareId(), is_shared: true })
    .eq("id", bookId)
    .select()
    .single();
  if (error) fail("Failed to reset the link", error);
  return data as BookV5;
}

/** Turns sharing off and clears all three share ids. */
export async function stopAllSharing(bookId: string): Promise<BookV5> {
  const { data, error } = await getSupabase()
    .from("books")
    .update({
      is_shared: false,
      share_view_id: null,
      share_details_id: null,
      share_edit_id: null,
      share_view_active: true,
      share_details_active: true,
      share_edit_active: true,
    })
    .eq("id", bookId)
    .select()
    .single();
  if (error) fail("Failed to stop sharing", error);
  return data as BookV5;
}

/* ————— Visitor: resolve + read a shared book ————— */

/** Works for anonymous visitors too (SECURITY DEFINER RPC). Null = link
 *  invalid, paused, or sharing stopped. */
export async function resolveShareAccess(shareId: string): Promise<SharedBookAccess | null> {
  const { data, error } = await getSupabase().rpc("resolve_share_access", { p_share_id: shareId });
  if (error) fail("Failed to open the shared book", error);
  const row = (Array.isArray(data) ? data[0] : data) as SharedBookAccess | undefined;
  return row ?? null;
}

/** Payment methods referenced by the book's transactions — readable only at
 *  Details/Edit level; RLS silently returns nothing otherwise. */
export async function getSharedPaymentMethods(transactions: Transaction[]): Promise<PaymentMethod[]> {
  const ids = new Set<string>();
  for (const t of transactions as TransactionV4[]) {
    if (t.payment_method_id) ids.add(t.payment_method_id);
    if (t.transfer_to_payment_method_id) ids.add(t.transfer_to_payment_method_id);
  }
  if (ids.size === 0) return [];
  const { data, error } = await getSupabase().from("payment_methods").select("*").in("id", [...ids]);
  if (error) return [];
  return (data ?? []) as PaymentMethod[];
}

/** Contacts tagged on the book's transactions — Details/Edit level only. */
export async function getSharedContacts(transactions: Transaction[]): Promise<Contact[]> {
  const ids = new Set<string>();
  for (const t of transactions as TransactionV4[]) {
    if (t.contact_id) ids.add(t.contact_id);
  }
  if (ids.size === 0) return [];
  const { data, error } = await getSupabase().from("contacts").select("*").in("id", [...ids]);
  if (error) return [];
  return (data ?? []) as Contact[];
}

/* ————— Receiver: saved shared books on Home ————— */

/** Validates the share id server-side and upserts the saved row.
 *  Returns true when the book was newly added to the home page. */
export async function saveSharedBook(shareId: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("save_shared_book", { p_share_id: shareId });
  if (error) fail("Failed to save the shared book", error);
  return data === true;
}

export async function getSavedSharedBooks(userId: string): Promise<SavedSharedBook[]> {
  const { data, error } = await getSupabase()
    .from("saved_shared_books")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) fail("Failed to load shared books", error);
  return (data ?? []) as SavedSharedBook[];
}

/** Removes the book from the receiver's home page only — sharing itself is untouched. */
export async function removeSavedSharedBook(userId: string, bookId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("saved_shared_books")
    .delete()
    .eq("user_id", userId)
    .eq("book_id", bookId);
  if (error) fail("Failed to remove the shared book", error);
}

/** Saved rows enriched with live book data + stats. `live` is null when the
 *  owner stopped sharing (the book row is no longer readable through RLS). */
export async function getSavedSharedBookCards(userId: string): Promise<SavedSharedBookCard[]> {
  const saved = await getSavedSharedBooks(userId);
  if (saved.length === 0) return [];

  const bookIds = saved.map((s) => s.book_id);
  const supabase = getSupabase();
  const [booksRes, txRes] = await Promise.all([
    supabase.from("books").select("id, name, description, icon_emoji, color_tag, is_shared").in("id", bookIds),
    supabase.from("transactions").select("book_id, type, amount").in("book_id", bookIds),
  ]);
  const liveBooks = new Map(
    ((booksRes.data ?? []) as Array<{
      id: string;
      name: string;
      description: string | null;
      icon_emoji: string;
      color_tag: string;
      is_shared: boolean;
    }>).map((b) => [b.id, b])
  );

  const statsByBook = new Map<string, BookStats>();
  for (const t of (txRes.data ?? []) as Array<Pick<Transaction, "book_id" | "type" | "amount">>) {
    const s = statsByBook.get(t.book_id) ?? { cashIn: 0, cashOut: 0, net: 0, count: 0 };
    if (t.type === "in") s.cashIn += Number(t.amount);
    else if (t.type === "out") s.cashOut += Number(t.amount);
    s.net = s.cashIn - s.cashOut;
    s.count += 1;
    statsByBook.set(t.book_id, s);
  }

  return saved.map((s) => {
    const live = liveBooks.get(s.book_id);
    return {
      ...s,
      live:
        live && live.is_shared
          ? {
              name: live.name,
              description: live.description,
              icon_emoji: live.icon_emoji,
              color_tag: live.color_tag,
              stats: statsByBook.get(s.book_id) ?? { cashIn: 0, cashOut: 0, net: 0, count: 0 },
            }
          : null,
    };
  });
}

/* ————— Post-sign-in return path ————— */
/* The edit level requires sign-in; OAuth bounces through the system browser,
 * so the shared URL is remembered here and restored after the callback. */

const RETURN_TO_KEY = "spendbook-return-to";

export function rememberReturnPath(path: string): void {
  try {
    window.localStorage.setItem(RETURN_TO_KEY, path);
  } catch {
    /* storage unavailable — sign-in still works, lands on /home */
  }
}

export function consumeReturnPath(): string | null {
  try {
    const path = window.localStorage.getItem(RETURN_TO_KEY);
    if (path) window.localStorage.removeItem(RETURN_TO_KEY);
    return path && path.startsWith("/") ? path : null;
  } catch {
    return null;
  }
}
