import type { Transaction } from "@/types";

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
