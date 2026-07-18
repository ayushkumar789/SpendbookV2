"use client";

import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { SplashScreen } from "@/components/ui/LoadingSpinner";
import { useSharedEditAccess } from "@/components/shared/sharedEditAccess";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { createTransaction } from "@/lib/database";
import { replaceSplitsForTransaction } from "@/lib/features/splits";
import { uploadReceipt } from "@/lib/features/receipts";
import type { NewTransactionInput } from "@/types";
import type { NewTransactionInputV4, TransactionExtras } from "@/types/features";

/** Editor-level visitors add entries with the exact same form the owner
 *  uses. Rows are written with the editor's own user id so RLS accepts them. */
export default function SharedAddTransactionPage() {
  const params = useParams<{ shareId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { methods } = usePaymentMethods();
  const { access, ready } = useSharedEditAccess(params.shareId);

  if (!ready || !access) return <SplashScreen />;

  const handleSubmit = async (input: NewTransactionInputV4, extras: TransactionExtras): Promise<void> => {
    if (!user) return;
    try {
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
    <div className="relative z-10 min-h-screen pb-16">
      <Header title={access.name} subtitle="Add transaction · shared book" back />
      <main className="mx-auto max-w-xl px-4 py-6 md:px-8 animate-fade-up">
        <TransactionForm
          bookId={access.book_id}
          methods={methods}
          submitLabel="Save transaction"
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
