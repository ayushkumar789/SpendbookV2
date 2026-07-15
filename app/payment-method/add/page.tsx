"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { AddPaymentMethodStepper } from "@/components/payment-methods/AddPaymentMethodStepper";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { createPaymentMethod } from "@/lib/database";
import type { NewPaymentMethodInput } from "@/types";

export default function AddPaymentMethodPage() {
  return (
    <AppShell nav={false}>
      <AddPaymentMethodContent />
    </AppShell>
  );
}

function AddPaymentMethodContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { methods } = usePaymentMethods();

  const handleSubmit = async (input: NewPaymentMethodInput): Promise<void> => {
    if (!user) return;
    try {
      await createPaymentMethod(user.id, input);
      toast("Payment method saved", "success");
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save method", "error");
    }
  };

  return (
    <>
      <Header title="Add payment method" back />
      <main className="mx-auto max-w-xl px-4 py-6 md:px-8 animate-fade-up">
        <AddPaymentMethodStepper existing={methods} onSubmit={handleSubmit} />
      </main>
    </>
  );
}
