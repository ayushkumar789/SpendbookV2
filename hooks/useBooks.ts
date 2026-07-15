"use client";

import { useCallback, useEffect, useState } from "react";
import { getBooksWithStats } from "@/lib/database";
import { useAuth } from "@/hooks/useAuth";
import type { BookWithStats } from "@/types";

export function useBooks(): {
  books: BookWithStats[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const [books, setBooks] = useState<BookWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      setBooks(await getBooksWithStats(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load books");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { books, loading, error, refresh };
}
