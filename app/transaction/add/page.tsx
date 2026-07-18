"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { SplashScreen } from "@/components/ui/LoadingSpinner";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { createTransaction } from "@/lib/database";
import { replaceSplitsForTransaction } from "@/lib/features/splits";
import { uploadReceipt } from "@/lib/features/receipts";
import type { NewTransactionInput } from "@/types";
import type { NewTransactionInputV4, TransactionExtras } from "@/types/features";

export default function AddTransactionPage() {
  return (
    <AppShell nav={false}>
      <Suspense fallback={<SplashScreen />}>
        <AddTransactionContent />
      </Suspense>
    </AppShell>
  );
}

function AddTransactionContent() {
  const searchParams = useSearchParams();
  const bookId = searchParams.get("bookId");
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { methods } = usePaymentMethods();

  if (!bookId) {
    return (
      <>
        <Header title="Add transaction" back />
        <p className="px-6 py-12 text-center text-sm text-ink3">No book selected — open a book first.</p>
      </>
    );
  }

  const handleSubmit = async (input: NewTransactionInputV4, extras: TransactionExtras): Promise<void> => {
    if (!user) return;
    try {
      // The frozen createTransaction spreads the whole input into the insert,
      // so the v4 columns (type 'transfer', transfer_to..., contact_id) pass through.
      const txn = await createTransaction(user.id, input as NewTransactionInput);
      if (extras.splits.length > 0) {
        await replaceSplitsForTransaction(user.id, txn.id, extras.splits);
      }
      if (extras.receiptFile) {
        await uploadReceipt(user.id, txn.id, extras.receiptFile);
      }
      toast("Transaction saved", "success");
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save transaction", "error");
    }
  };

  return (
    <>
      <Header title="Add transaction" back />
      <main className="mx-auto max-w-xl px-4 py-6 md:px-8 animate-fade-up">
        <TransactionForm bookId={bookId} methods={methods} submitLabel="Save transaction" onSubmit={handleSubmit} />
      </main>
    </>
  );
}
