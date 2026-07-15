"use client";

import { useCallback, useEffect, useState } from "react";
import { getTransactionsForBook } from "@/lib/database";
import type { Transaction } from "@/types";

export function useTransactions(bookId: string | null): {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!bookId) return;
    try {
      setError(null);
      setTransactions(await getTransactionsForBook(bookId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { transactions, loading, error, refresh };
}
