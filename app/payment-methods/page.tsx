"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { AddMethodCard, PaymentMethodCard } from "@/components/payment-methods/PaymentMethodCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useToast } from "@/hooks/useToast";
import { deletePaymentMethod } from "@/lib/database";
import { PAYMENT_TYPES } from "@/lib/constants";
import type { PaymentMethod, PaymentType } from "@/types";

const GROUP_TITLES: Record<PaymentType, string> = {
  upi: "UPI Cards",
  debit: "Debit Cards",
  credit: "Credit Cards",
  netbanking: "Net Banking",
};

export default function PaymentMethodsPage() {
  return (
    <AppShell>
      <PaymentMethodsContent />
    </AppShell>
  );
}

function PaymentMethodsContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { methods, loading, refresh } = usePaymentMethods();
  const [pendingDelete, setPendingDelete] = useState<PaymentMethod | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<PaymentType, PaymentMethod[]>();
    for (const { key } of PAYMENT_TYPES) map.set(key, []);
    for (const m of methods) map.get(m.payment_type)?.push(m);
    return [...map.entries()].filter(([, list]) => list.length > 0);
  }, [methods]);

  return (
    <>
      <Header
        title="Payment methods"
        subtitle="Your cards, made physical"
        hero
        actions={
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
            onClick={() => router.push("/payment-method/add")}
            className="hidden sm:inline-flex"
          >
            Add method
          </Button>
        }
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 md:px-8">
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            <Skeleton className="h-[190px] w-[300px] shrink-0 rounded-[18px]" />
            <Skeleton className="h-[190px] w-[300px] shrink-0 rounded-[18px]" />
          </div>
        ) : methods.length === 0 ? (
          <EmptyState
            illustration="methods"
            title="No saved methods"
            message="Save your UPI apps and cards once — then tag any transaction in any book with them."
            action={
              <Button size="lg" icon={<Plus className="h-4 w-4" strokeWidth={2.5} />} onClick={() => router.push("/payment-method/add")}>
                Add a method
              </Button>
            }
          />
        ) : (
          grouped.map(([type, list]) => (
            <section key={type}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-xl tracking-tight text-ink">{GROUP_TITLES[type]}</h2>
                <span className="label-caps">{list.length}</span>
              </div>
              <div className="hide-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-3 pt-1 md:-mx-8 md:px-8">
                {list.map((m, i) => (
                  <PaymentMethodCard key={m.id} method={m} index={i} onDelete={setPendingDelete} />
                ))}
                <AddMethodCard onClick={() => router.push("/payment-method/add")} />
              </div>
            </section>
          ))
        )}
      </main>

      <button
        onClick={() => router.push("/payment-method/add")}
        aria-label="Add payment method"
        className="shimmer-border press fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-nav transition-transform hover:scale-105 md:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this method?"
        message="Old transactions that used it will show “Deleted Method”. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deletePaymentMethod(pendingDelete.id);
          setPendingDelete(null);
          toast("Payment method deleted", "info");
          await refresh();
        }}
      />
    </>
  );
}
