"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { deleteTransaction, getTransaction, updateTransaction } from "@/lib/database";
import { getSplitsForTransaction, replaceSplitsForTransaction } from "@/lib/features/splits";
import { removeReceipt, uploadReceipt } from "@/lib/features/receipts";
import type { NewTransactionInput, Transaction } from "@/types";
import type { SplitDraft, TransactionExtras, TransactionV2 } from "@/types/features";

export default function EditTransactionPage() {
  return (
    <AppShell nav={false}>
      <EditTransactionContent />
    </AppShell>
  );
}

function EditTransactionContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { methods } = usePaymentMethods();
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void Promise.all([getTransaction(params.id), getSplitsForTransaction(params.id)])
      .then(([t, s]) => {
        setTxn(t);
        setSplits(s.map(({ person_name, amount, paid_back }) => ({ person_name, amount: Number(amount), paid_back })));
      })
      .catch((e: unknown) => toast(e instanceof Error ? e.message : "Failed to load transaction", "error"))
      .finally(() => setLoading(false));
  }, [params.id, toast]);

  const handleSubmit = async (input: NewTransactionInput, extras: TransactionExtras): Promise<void> => {
    if (!user) return;
    try {
      await updateTransaction(params.id, input);
      await replaceSplitsForTransaction(user.id, params.id, extras.splits);
      const existingPath = (txn as TransactionV2 | null)?.receipt_url ?? null;
      if (extras.receiptFile) {
        await uploadReceipt(user.id, params.id, extras.receiptFile);
      } else if (extras.removeExistingReceipt && existingPath) {
        await removeReceipt(params.id, existingPath);
      }
      toast("Transaction updated", "success");
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update transaction", "error");
    }
  };

  return (
    <>
      <Header
        title="Edit transaction"
        back
        actions={
          txn ? (
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
        ) : txn ? (
          <div className="animate-fade-up">
            <TransactionForm
              bookId={txn.book_id}
              initial={txn}
              initialSplits={splits}
              initialReceiptPath={(txn as TransactionV2).receipt_url ?? null}
              methods={methods}
              submitLabel="Save changes"
              onSubmit={handleSubmit}
            />
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-ink3">Transaction not found.</p>
        )}
      </main>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this transaction?"
        message="This entry will be removed from the book permanently."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await deleteTransaction(params.id);
          toast("Transaction deleted", "info");
          router.back();
        }}
      />
    </>
  );
}
