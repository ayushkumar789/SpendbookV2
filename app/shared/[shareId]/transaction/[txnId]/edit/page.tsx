"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SplashScreen } from "@/components/ui/LoadingSpinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSharedEditAccess } from "@/components/shared/sharedEditAccess";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { deleteTransaction, getTransaction, updateTransaction } from "@/lib/database";
import { getSplitsForTransaction, replaceSplitsForTransaction } from "@/lib/features/splits";
import { removeReceipt, uploadReceipt } from "@/lib/features/receipts";
import type { NewTransactionInput, Transaction } from "@/types";
import type {
  NewTransactionInputV4,
  SplitDraft,
  TransactionExtras,
  TransactionV2,
  TransactionV4,
} from "@/types/features";

/** Editor-level visitors get the exact same full-page edit experience as
 *  the owner — same TransactionForm, same fields, same behavior. */
export default function SharedEditTransactionPage() {
  const params = useParams<{ shareId: string; txnId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { methods } = usePaymentMethods();
  const { access, ready } = useSharedEditAccess(params.shareId);

  const [txn, setTxn] = useState<Transaction | null>(null);
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!ready) return;
    void Promise.all([getTransaction(params.txnId), getSplitsForTransaction(params.txnId).catch(() => [])])
      .then(([t, s]) => {
        setTxn(t);
        setSplits(s.map(({ person_name, amount, paid_back }) => ({ person_name, amount: Number(amount), paid_back })));
      })
      .catch((e: unknown) => toast(e instanceof Error ? e.message : "Failed to load transaction", "error"))
      .finally(() => setLoading(false));
  }, [ready, params.txnId, toast]);

  if (!ready || !access) return <SplashScreen />;

  // URL sanity: the transaction must belong to the shared book.
  const wrongBook = txn !== null && txn.book_id !== access.book_id;

  const handleSubmit = async (input: NewTransactionInputV4, extras: TransactionExtras): Promise<void> => {
    if (!user) return;
    try {
      await updateTransaction(params.txnId, input as NewTransactionInput);
      await replaceSplitsForTransaction(user.id, params.txnId, extras.splits);
      const existingPath = (txn as TransactionV2 | null)?.receipt_url ?? null;
      if (extras.receiptFile) {
        await uploadReceipt(user.id, params.txnId, extras.receiptFile);
      } else if (extras.removeExistingReceipt && existingPath) {
        await removeReceipt(params.txnId, existingPath);
      }
      toast("Transaction updated", "success");
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update transaction", "error");
    }
  };

  return (
    <div className="relative z-10 min-h-screen pb-16">
      <Header
        title={access.name}
        subtitle="Edit transaction · shared book"
        back
        actions={
          txn && !wrongBook ? (
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete transaction"
              className="press flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink2 transition-colors hover:bg-rose-soft hover:text-rose"
            >
              <Trash2 className="h-[17px] w-[17px]" />
            </button>
          ) : undefined
        }
      />
      <main className="mx-auto max-w-xl px-4 py-6 md:px-8">
        {loading ? (
          <div className="space-y-5">
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        ) : txn && !wrongBook ? (
          <div className="animate-fade-up">
            <TransactionForm
              bookId={txn.book_id}
              initial={txn as TransactionV4}
              initialSplits={splits}
              initialReceiptPath={(txn as TransactionV2).receipt_url ?? null}
              methods={methods}
              submitLabel="Save changes"
              onSubmit={handleSubmit}
            />
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-ink3">Transaction not found in this shared book.</p>
        )}
      </main>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this transaction?"
        message="This entry will be removed from the shared book permanently."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await deleteTransaction(params.txnId);
          toast("Transaction deleted", "info");
          router.back();
        }}
      />
    </div>
  );
}
