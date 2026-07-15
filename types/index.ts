export type TransactionType = "in" | "out";

export type PaymentType = "upi" | "debit" | "credit" | "netbanking";

export type RecurrenceInterval = "daily" | "weekly" | "monthly" | "yearly";

export type ThemePreference = "light" | "dark" | "system";

export interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface Book {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  color_tag: string;
  icon_emoji: string;
  monthly_budget: number | null;
  is_shared: boolean;
  share_id: string | null;
  created_at: string;
}

export interface BookStats {
  cashIn: number;
  cashOut: number;
  net: number;
  count: number;
}

export interface BookWithStats extends Book {
  stats: BookStats;
}

export interface PaymentMethod {
  id: string;
  owner_id: string;
  bank_key: string;
  bank_name: string;
  bank_is_custom: boolean;
  payment_type: PaymentType;
  upi_app: string | null;
  upi_app_is_custom: boolean;
  upi_app_name: string | null;
  last_four_digits: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  book_id: string;
  owner_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  payment_method_id: string | null;
  note: string | null;
  date: string;
  is_recurring: boolean;
  recurrence_interval: RecurrenceInterval | null;
  next_recurrence_date: string | null;
  created_at: string;
}

export interface SharedBook extends Book {
  owner: { display_name: string | null } | null;
}

export interface TransactionFilters {
  type: TransactionType | "all";
  category: string | "all";
  from: string | null;
  to: string | null;
}

export interface NewBookInput {
  name: string;
  description: string | null;
  color_tag: string;
  icon_emoji: string;
  monthly_budget: number | null;
}

export interface NewPaymentMethodInput {
  bank_key: string;
  bank_name: string;
  bank_is_custom: boolean;
  payment_type: PaymentType;
  upi_app: string | null;
  upi_app_is_custom: boolean;
  upi_app_name: string | null;
  last_four_digits: string;
}

export interface NewTransactionInput {
  book_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  payment_method_id: string | null;
  note: string | null;
  date: string;
  is_recurring: boolean;
  recurrence_interval: RecurrenceInterval | null;
  next_recurrence_date: string | null;
}

export interface ToastItem {
  id: number;
  message: string;
  kind: "success" | "error" | "info";
}
