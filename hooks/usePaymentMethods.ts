"use client";

import { useCallback, useEffect, useState } from "react";
import { getPaymentMethods } from "@/lib/database";
import { useAuth } from "@/hooks/useAuth";
import type { PaymentMethod } from "@/types";

export function usePaymentMethods(): {
  methods: PaymentMethod[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      setMethods(await getPaymentMethods(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { methods, loading, error, refresh };
}
