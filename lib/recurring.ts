import { addDays, addMonths, addWeeks, addYears, format, parseISO } from "date-fns";
import {
  getDueRecurringTransactions,
  insertRecurringCopies,
  updateNextRecurrence,
} from "@/lib/database";
import { todayISO } from "@/lib/helpers";
import type { NewTransactionInput, RecurrenceInterval, Transaction } from "@/types";

export function nextDate(fromIso: string, interval: RecurrenceInterval): string {
  const from = parseISO(fromIso);
  const next =
    interval === "daily"
      ? addDays(from, 1)
      : interval === "weekly"
        ? addWeeks(from, 1)
        : interval === "monthly"
          ? addMonths(from, 1)
          : addYears(from, 1);
  return format(next, "yyyy-MM-dd");
}

/**
 * Called once on app load after auth. For every recurring transaction whose
 * next_recurrence_date has passed, materialise one plain copy per missed
 * occurrence (dated on the occurrence date) and advance the schedule.
 * Returns how many copies were created.
 */
export async function checkAndProcessRecurringTransactions(ownerId: string): Promise<number> {
  const today = todayISO();
  const due = await getDueRecurringTransactions(ownerId, today);
  if (due.length === 0) return 0;

  const copies: Array<NewTransactionInput & { owner_id: string }> = [];

  for (const template of due) {
    let cursor = template.next_recurrence_date;
    const interval = template.recurrence_interval;
    if (!cursor || !interval) continue;

    // Catch up every missed occurrence (capped defensively).
    let guard = 0;
    while (cursor <= today && guard < 400) {
      copies.push(copyOf(template, cursor));
      cursor = nextDate(cursor, interval);
      guard += 1;
    }
    await updateNextRecurrence(template.id, cursor);
  }

  await insertRecurringCopies(copies);
  return copies.length;
}

function copyOf(t: Transaction, date: string): NewTransactionInput & { owner_id: string } {
  return {
    owner_id: t.owner_id,
    book_id: t.book_id,
    type: t.type,
    amount: Number(t.amount),
    category: t.category,
    payment_method_id: t.payment_method_id,
    note: t.note,
    date,
    is_recurring: false,
    recurrence_interval: null,
    next_recurrence_date: null,
  };
}
