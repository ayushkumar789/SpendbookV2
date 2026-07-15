"use client";

import { useMemo, useState } from "react";
import { Check, CreditCard, Globe, Landmark, Smartphone } from "lucide-react";
import { BANKS, PAYMENT_TYPES, UPI_APPS } from "@/lib/constants";
import { bankBadgeText, cn } from "@/lib/helpers";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { InitialBadge } from "@/components/ui/Badge";
import type { NewPaymentMethodInput, PaymentMethod, PaymentType } from "@/types";

interface StepperProps {
  existing: PaymentMethod[];
  onSubmit: (input: NewPaymentMethodInput) => Promise<void>;
}

const TYPE_META: Record<PaymentType, { icon: typeof Smartphone; hex: string; blurb: string }> = {
  upi: { icon: Smartphone, hex: "#2C6E63", blurb: "GPay, PhonePe, Paytm…" },
  debit: { icon: CreditCard, hex: "#2D6A9F", blurb: "Linked to your savings" },
  credit: { icon: CreditCard, hex: "#97314E", blurb: "Billed monthly" },
  netbanking: { icon: Globe, hex: "#B8860B", blurb: "Direct from the bank" },
};

export function AddPaymentMethodStepper({ existing, onSubmit }: StepperProps) {
  const [step, setStep] = useState(1);
  const [bankKey, setBankKey] = useState<string | null>(null);
  const [customBank, setCustomBank] = useState("");
  const [payType, setPayType] = useState<PaymentType | null>(null);
  const [upiApp, setUpiApp] = useState<string | null>(null);
  const [customApp, setCustomApp] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const bank = BANKS.find((b) => b.key === bankKey);
  const bankName = bankKey === "other" ? customBank.trim() : (bank?.name ?? "");

  /** UPI apps already saved for this bank + last-4 combination. */
  const duplicateApps = useMemo(() => {
    if (payType !== "upi" || !bankKey || lastFour.length !== 4) return new Set<string>();
    return new Set(
      existing
        .filter(
          (m) =>
            m.payment_type === "upi" &&
            m.bank_key === bankKey &&
            (bankKey !== "other" || m.bank_name.toLowerCase() === bankName.toLowerCase()) &&
            m.last_four_digits === lastFour
        )
        .map((m) => m.upi_app ?? "")
    );
  }, [existing, payType, bankKey, bankName, lastFour]);

  const isDuplicate = (): boolean => {
    if (!payType || !bankKey) return false;
    return existing.some(
      (m) =>
        m.payment_type === payType &&
        m.bank_key === bankKey &&
        (bankKey !== "other" || m.bank_name.toLowerCase() === bankName.toLowerCase()) &&
        m.last_four_digits === lastFour &&
        (payType !== "upi" ||
          (m.upi_app === upiApp &&
            (upiApp !== "other" || (m.upi_app_name ?? "").toLowerCase() === customApp.trim().toLowerCase())))
    );
  };

  const submit = async (): Promise<void> => {
    setError(null);
    if (!/^\d{4}$/.test(lastFour)) {
      setError("Enter exactly the last 4 digits");
      return;
    }
    if (payType === "upi" && !upiApp) {
      setError("Pick a UPI app");
      return;
    }
    if (payType === "upi" && upiApp === "other" && !customApp.trim()) {
      setError("Enter the UPI app name");
      return;
    }
    if (isDuplicate()) {
      setError("This exact method is already saved");
      return;
    }
    if (!bankKey || !payType) return;

    setBusy(true);
    try {
      const app = UPI_APPS.find((a) => a.key === upiApp);
      await onSubmit({
        bank_key: bankKey,
        bank_name: bankName,
        bank_is_custom: bankKey === "other",
        payment_type: payType,
        upi_app: payType === "upi" ? upiApp : null,
        upi_app_is_custom: payType === "upi" && upiApp === "other",
        upi_app_name: payType === "upi" ? (upiApp === "other" ? customApp.trim() : (app?.name ?? null)) : null,
        last_four_digits: lastFour,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Step rail */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                s < step
                  ? "bg-jade text-white"
                  : s === step
                    ? "bg-ink text-canvas shadow-card"
                    : "border border-line-strong text-ink3"
              )}
            >
              {s < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s}
            </span>
            {s < 3 ? (
              <span className={cn("h-0.5 flex-1 rounded-full transition-colors duration-300", s < step ? "bg-jade" : "bg-line")} />
            ) : null}
          </div>
        ))}
      </div>
      <p className="label-caps -mt-3">
        {step === 1 ? "Step 1 · Select bank" : step === 2 ? "Step 2 · Payment type" : "Step 3 · Details"}
      </p>

      {step === 1 ? (
        <>
          <div className="grid max-h-[46vh] grid-cols-3 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-4">
            {BANKS.map((b) => (
              <button
                key={b.key}
                onClick={() => setBankKey(b.key)}
                aria-pressed={bankKey === b.key}
                className={cn(
                  "press flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all duration-200",
                  bankKey === b.key ? "border-brand bg-brand-soft shadow-card" : "border-line bg-card hover:border-line-strong"
                )}
              >
                <InitialBadge text={bankBadgeText(b.name)} hex={b.hex} size={40} />
                <span className="w-full truncate text-center text-[11.5px] font-semibold text-ink2">{b.name}</span>
              </button>
            ))}
          </div>
          {bankKey === "other" ? (
            <Input
              label="Bank name"
              placeholder="e.g. Karnataka Bank"
              value={customBank}
              onChange={(e) => setCustomBank(e.target.value)}
              autoFocus
            />
          ) : null}
          <Button
            size="lg"
            disabled={!bankKey || (bankKey === "other" && !customBank.trim())}
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_TYPES.map(({ key, name }) => {
              const meta = TYPE_META[key];
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  onClick={() => setPayType(key)}
                  aria-pressed={payType === key}
                  className={cn(
                    "press flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200",
                    payType === key ? "border-brand bg-brand-soft shadow-card" : "border-line bg-card hover:border-line-strong"
                  )}
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-card"
                    style={{ background: `linear-gradient(145deg, ${meta.hex}, color-mix(in srgb, ${meta.hex} 70%, #1a120a))` }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold tracking-tight text-ink">{name}</span>
                    <span className="mt-0.5 block text-xs text-ink3">{meta.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="lg" disabled={!payType} onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <div className="card-surface flex items-center gap-3 rounded-2xl p-3.5">
            <InitialBadge text={bankBadgeText(bankName)} hex={bank?.hex ?? "#6B6050"} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{bankName}</p>
              <p className="text-xs text-ink3">{PAYMENT_TYPES.find((t) => t.key === payType)?.name}</p>
            </div>
            <Landmark className="ml-auto h-4 w-4 shrink-0 text-ink3" />
          </div>

          <Input
            label="Last 4 digits"
            placeholder="0000"
            inputMode="numeric"
            maxLength={4}
            value={lastFour}
            onChange={(e) => {
              setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4));
              setError(null);
            }}
            hint={payType === "upi" ? "Of the bank account linked to UPI" : "Of the card / account"}
            className="amount"
          />

          {payType === "upi" ? (
            <div className="flex flex-col gap-1.5">
              <p className="label-caps">UPI app</p>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {UPI_APPS.map((a) => {
                  const taken = duplicateApps.has(a.key) && a.key !== "other";
                  return (
                    <button
                      key={a.key}
                      disabled={taken}
                      onClick={() => {
                        setUpiApp(a.key);
                        setError(null);
                      }}
                      aria-pressed={upiApp === a.key}
                      className={cn(
                        "press relative flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-all duration-200",
                        taken
                          ? "cursor-not-allowed border-line opacity-40 grayscale"
                          : upiApp === a.key
                            ? "border-brand bg-brand-soft shadow-card"
                            : "border-line bg-card hover:border-line-strong"
                      )}
                    >
                      {taken ? (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-jade text-white shadow-card">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : null}
                      <InitialBadge text={a.abbr} hex={a.hex} size={36} />
                      <span className="w-full truncate text-center text-[10.5px] font-semibold text-ink2">{a.name}</span>
                    </button>
                  );
                })}
              </div>
              {upiApp === "other" ? (
                <Input
                  placeholder="UPI app name"
                  value={customApp}
                  onChange={(e) => {
                    setCustomApp(e.target.value);
                    setError(null);
                  }}
                  className="mt-2"
                  autoFocus
                />
              ) : null}
            </div>
          ) : null}

          {error ? <p className="animate-fade-in text-sm font-medium text-rose">{error}</p> : null}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={() => setStep(2)} disabled={busy}>
              Back
            </Button>
            <Button size="lg" onClick={() => void submit()} loading={busy}>
              Save method
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
