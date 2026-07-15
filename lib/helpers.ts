import { format, parseISO } from "date-fns";
import type { PaymentMethod } from "@/types";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompactFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** ₹1,23,456.00 — Indian grouping, always two decimals. */
export function formatCurrency(amount: number): string {
  return inrFormatter.format(amount);
}

/** ₹1,23,456 — for chart axes and tight spaces. */
export function formatCurrencyCompact(amount: number): string {
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
  return inrCompactFormatter.format(amount);
}

/** PDF-safe variant — standard PDF fonts have no ₹ glyph. */
export function formatCurrencyPdf(amount: number): string {
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

/** Group an integer-rupee string with Indian commas as the user types. */
export function formatIndianDigits(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("en-IN").format(Number(digits));
}

export function parseAmountInput(display: string): number {
  const n = Number(display.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatDate(iso: string, pattern = "d MMM yyyy"): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function generateShareId(): string {
  return crypto.randomUUID();
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Consistent 2-letter badge text for bank avatars: "IDFC First" → "ID". */
export function bankBadgeText(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Short human label for a transaction's payment method.
 * null id → "Cash" · missing method (deleted) → "Deleted Method".
 */
export function methodLabel(
  paymentMethodId: string | null,
  methods: PaymentMethod[]
): string {
  if (!paymentMethodId) return "Cash";
  const m = methods.find((x) => x.id === paymentMethodId);
  if (!m) return "Deleted Method";
  const app = m.payment_type === "upi" ? ` · ${m.upi_app_name ?? "UPI"}` : "";
  return `${m.bank_name}${app} ····${m.last_four_digits}`;
}
