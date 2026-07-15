import type { PaymentType } from "@/types";

/**
 * Curated book color tags — VOLT LEDGER palette.
 * Keys are stored in the DB, so they stay stable; only the hues moved
 * to the new neon-on-moss system.
 */
export const BOOK_COLORS: { key: string; name: string; hex: string }[] = [
  { key: "moss", name: "Volt", hex: "#A9C81F" },
  { key: "jade", name: "Mint", hex: "#2AA678" },
  { key: "rose", name: "Ember", hex: "#E05A48" },
  { key: "peacock", name: "Plasma", hex: "#28A4C4" },
  { key: "plum", name: "Orchid", hex: "#9D64C8" },
  { key: "marigold", name: "Solar", hex: "#DFAE2A" },
  { key: "terracotta", name: "Clay", hex: "#C97045" },
  { key: "cocoa", name: "Sandstone", hex: "#8F8163" },
];

/** Goal cards pick from the same swatch family. */
export const GOAL_COLORS = BOOK_COLORS;

export function bookColorHex(key: string): string {
  return BOOK_COLORS.find((c) => c.key === key)?.hex ?? BOOK_COLORS[0].hex;
}

export const BOOK_EMOJIS = ["💰", "✈️", "💍", "🎓", "🛒", "🏥", "💼", "🏠", "🎉", "📚", "🚗", "🍕"];

export const CATEGORIES = [
  "Food & Dining",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health & Medical",
  "Education",
  "Salary / Income",
  "Gift",
  "Investment",
  "Bills & Utilities",
  "Rent",
  "Travel",
  "Other",
] as const;

export const BANKS: { key: string; name: string; hex: string }[] = [
  { key: "sbi", name: "SBI", hex: "#2D6A9F" },
  { key: "hdfc", name: "HDFC", hex: "#1C4587" },
  { key: "icici", name: "ICICI", hex: "#B0592A" },
  { key: "axis", name: "Axis", hex: "#97314E" },
  { key: "kotak", name: "Kotak", hex: "#C43A3A" },
  { key: "pnb", name: "PNB", hex: "#8A2B52" },
  { key: "boi", name: "BOI", hex: "#2E5E8C" },
  { key: "canara", name: "Canara", hex: "#0A87A0" },
  { key: "yes", name: "Yes Bank", hex: "#1B5E8F" },
  { key: "indusind", name: "IndusInd", hex: "#7A3B2E" },
  { key: "idfc", name: "IDFC First", hex: "#8E2C3E" },
  { key: "federal", name: "Federal", hex: "#B8860B" },
  { key: "bob", name: "Bank of Baroda", hex: "#C05F33" },
  { key: "union", name: "Union Bank", hex: "#2C6E63" },
  { key: "other", name: "Other", hex: "#6B6050" },
];

export const UPI_APPS: { key: string; name: string; abbr: string; hex: string }[] = [
  { key: "gpay", name: "Google Pay", abbr: "GP", hex: "#3C7A5A" },
  { key: "phonepe", name: "PhonePe", abbr: "Pe", hex: "#5F259F" },
  { key: "paytm", name: "Paytm", abbr: "Pt", hex: "#1D3E6E" },
  { key: "bhim", name: "BHIM", abbr: "BH", hex: "#B0592A" },
  { key: "amazonpay", name: "Amazon Pay", abbr: "AP", hex: "#B8860B" },
  { key: "cred", name: "CRED", abbr: "CR", hex: "#2A2A33" },
  { key: "imobile", name: "iMobile Pay", abbr: "iM", hex: "#97314E" },
  { key: "yono", name: "Yono SBI", abbr: "Yo", hex: "#2D6A9F" },
  { key: "supermoney", name: "SuperMoney", abbr: "SM", hex: "#2C6E63" },
  { key: "mobikwik", name: "MobiKwik", abbr: "MK", hex: "#1B5E8F" },
  { key: "airtel", name: "Airtel Payments", abbr: "Ai", hex: "#C43A3A" },
  { key: "other", name: "Other", abbr: "?", hex: "#6B6050" },
];

/** Rich per-bank gradients for the physical-card payment method design. */
export const BANK_GRADIENTS: Record<string, [string, string]> = {
  sbi: ["#0E3A54", "#0F5E5A"],
  hdfc: ["#43101E", "#7A1E2E"],
  icici: ["#6E2810", "#A34A1C"],
  axis: ["#341348", "#63297F"],
  kotak: ["#520E14", "#8F1E26"],
  pnb: ["#4A0F2A", "#8A2B52"],
  boi: ["#0F2E4E", "#2E5E8C"],
  canara: ["#083E4C", "#0A87A0"],
  yes: ["#0C3350", "#1B5E8F"],
  indusind: ["#3E1D13", "#7A3B2E"],
  idfc: ["#4C111F", "#8E2C3E"],
  federal: ["#4C3806", "#A57A0A"],
  bob: ["#4C2210", "#B05226"],
  union: ["#0F332C", "#2C6E63"],
  other: ["#1F2428", "#3C444B"],
};

export function bankGradient(bankKey: string): [string, string] {
  return BANK_GRADIENTS[bankKey] ?? BANK_GRADIENTS.other;
}

export const PAYMENT_TYPES: { key: PaymentType; name: string }[] = [
  { key: "upi", name: "UPI" },
  { key: "debit", name: "Debit Card" },
  { key: "credit", name: "Credit Card" },
  { key: "netbanking", name: "Net Banking" },
];

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  upi: "UPI",
  debit: "Debit Card",
  credit: "Credit Card",
  netbanking: "Net Banking",
};

/** Validated categorical chart palette (6 slots), per theme — volt ledger. */
export const CHART_CATEGORICAL: Record<"light" | "dark", string[]> = {
  light: ["#7A8F0A", "#0A87A0", "#D8442E", "#178A5B", "#8A5BB0", "#B06E2E"],
  dark: ["#84A210", "#28A4C4", "#E04E3C", "#2AA678", "#9D64C8", "#C08034"],
};

export const APP_VERSION = "2.0.0";
