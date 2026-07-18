import type { Book, BookStats, NewTransactionInput, PaymentMethod, Transaction } from "@/types";

/* ————— v2 feature types (kept out of types/index.ts by design) ————— */

export interface SavingsGoal {
  id: string;
  owner_id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  color: string;
  icon_emoji: string;
  deadline: string | null;
  created_at: string;
}

export interface NewGoalInput {
  name: string;
  target_amount: number;
  color: string;
  icon_emoji: string;
  deadline: string | null;
}

export interface Split {
  id: string;
  transaction_id: string;
  owner_id: string;
  person_name: string;
  amount: number;
  paid_back: boolean;
  created_at: string;
}

/** A split row being edited in the form, before it has an id. */
export interface SplitDraft {
  person_name: string;
  amount: number;
  paid_back: boolean;
}

/** Transaction row once the v2 `receipt_url` column exists. */
export interface TransactionV2 extends Transaction {
  receipt_url?: string | null;
}

export interface SearchHit extends Transaction {
  book: { id: string; name: string; icon_emoji: string } | null;
}

/* ————— v3: digital wallet ————— */

export type WalletDocType =
  | "pan"
  | "aadhaar"
  | "driving_license"
  | "passport"
  | "voter_id"
  | "insurance"
  | "other";

export interface WalletDocument {
  id: string;
  owner_id: string;
  doc_type: WalletDocType;
  doc_name: string;
  custom_label: string | null;
  front_url: string | null;
  back_url: string | null;
  has_back: boolean;
  created_at: string;
}

/* ————— v3: profile links ————— */

export interface ProfileLink {
  id: string;
  owner_id: string;
  platform: string;
  platform_label: string;
  url: string;
  display_name: string | null;
  is_public: boolean;
  sort_order: number;
  created_at: string;
}

export interface NewProfileLinkInput {
  platform: string;
  platform_label: string;
  url: string;
  display_name: string | null;
  is_public: boolean;
  sort_order: number;
}

export interface PublicProfile {
  display_name: string | null;
  photo_url: string | null;
  links: ProfileLink[];
}

/** Cross-book account stats for Settings. */
export interface AccountStats {
  books: number;
  transactions: number;
  cashIn: number;
  cashOut: number;
}

/** Extra payloads the transaction form collects beyond the core input. */
export interface TransactionExtras {
  splits: SplitDraft[];
  receiptFile: File | null;
  removeExistingReceipt: boolean;
}

/* ————— v4: self transfer ————— */

/** 'transfer' joins 'in' | 'out' once the v4 columns exist. */
export type TransactionTypeV4 = "in" | "out" | "transfer";

/** Transaction row once the v4 columns exist. For transfers,
 *  payment_method_id is the FROM account and this is the TO account. */
export interface TransactionV4 extends TransactionV2 {
  transfer_to_payment_method_id?: string | null;
  contact_id?: string | null;
}

/** Superset of NewTransactionInput accepted by the v4 form. The new fields
 *  are optional so this stays cast-compatible with the frozen input type. */
export interface NewTransactionInputV4 extends Omit<NewTransactionInput, "type"> {
  type: TransactionTypeV4;
  transfer_to_payment_method_id?: string | null;
  contact_id?: string | null;
}

/** TransactionFilters with the Transfer tab. */
export interface TransactionFiltersV4 {
  type: TransactionTypeV4 | "all";
  category: string | "all";
  from: string | null;
  to: string | null;
}

/* ————— v4: contacts ————— */

export interface Contact {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  avatar_color: string;
  created_at: string;
}

export interface NewContactInput {
  name: string;
  phone: string | null;
  avatar_color: string;
}

/* ————— v4: enhanced settings stats ————— */

export interface StatHighlight {
  amount: number;
  category: string;
  date: string;
}

/* ————— v5: 3-level sharing ————— */

export type ShareAccessLevel = "view" | "details" | "edit";

/** Book row once the v5 share columns exist. Optional so this stays
 *  cast-compatible with the frozen Book type. */
export interface BookV5 extends Book {
  share_view_id?: string | null;
  share_details_id?: string | null;
  share_edit_id?: string | null;
  share_view_active?: boolean;
  share_details_active?: boolean;
  share_edit_active?: boolean;
}

/** One row from the resolve_share_access RPC. */
export interface SharedBookAccess {
  book_id: string;
  access_level: ShareAccessLevel;
  owner_id: string;
  owner_display_name: string | null;
  name: string;
  description: string | null;
  color_tag: string;
  icon_emoji: string;
  monthly_budget: number | null;
  created_at: string;
}

/** A shared book the user pinned to their home page. */
export interface SavedSharedBook {
  id: string;
  user_id: string;
  book_id: string;
  access_level: ShareAccessLevel;
  share_id_used: string;
  owner_display_name: string | null;
  book_name: string | null;
  book_emoji: string | null;
  book_color: string | null;
  created_at: string;
}

/** Saved card + live book data. `live` is null when the owner stopped
 *  sharing (RLS blocks the read) — the card shows a "Sharing stopped" state. */
export interface SavedSharedBookCard extends SavedSharedBook {
  live: {
    name: string;
    description: string | null;
    icon_emoji: string;
    color_tag: string;
    stats: BookStats;
  } | null;
}

/* ————— v6: account groups + live balances ————— */

export interface AccountGroup {
  id: string;
  owner_id: string;
  name: string;
  bank_key: string;
  bank_name: string;
  color: string;
  show_on_profile: boolean;
  created_at: string;
}

export interface AccountGroupMember {
  id: string;
  group_id: string;
  payment_method_id: string;
  owner_id: string;
}

export interface AccountSnapshot {
  id: string;
  group_id: string;
  owner_id: string;
  balance: number;
  snapshot_date: string;
  note: string | null;
  created_at: string;
}

export interface NewAccountGroupInput {
  name: string;
  bank_key: string;
  bank_name: string;
  color: string;
}

/** Everything an account card needs: the group, its member payment methods,
 *  the latest snapshot and the computed live balance (null = no snapshot yet). */
export interface AccountGroupWithDetails extends AccountGroup {
  members: PaymentMethod[];
  latestSnapshot: AccountSnapshot | null;
  liveBalance: number | null;
}

/** One balance card on the public profile. Only the name, color, balance
 *  and last-updated stamp — never payment method details. */
export interface PublicAccountBalance {
  id: string;
  name: string;
  color: string;
  balance: number | null;
  updatedAt: string | null;
}

export interface AccountStatsV4 {
  /* Overview (transfers excluded from money totals) */
  books: number;
  transactions: number;
  cashIn: number;
  cashOut: number;
  /* Insights */
  biggestExpense: StatHighlight | null;
  bestMonth: { label: string; net: number } | null;
  topCategory: { name: string; count: number; total: number } | null;
  /* Patterns */
  avgMonthlySpend: number;
  avgTransactionAmount: number;
  largestCashIn: StatHighlight | null;
  /* Activity */
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  topWeekday: { name: string; count: number } | null;
}
