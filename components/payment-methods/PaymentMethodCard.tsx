"use client";

import { useRef, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { bankGradient, PAYMENT_TYPE_LABEL, UPI_APPS } from "@/lib/constants";
import { bankBadgeText, cn } from "@/lib/helpers";
import type { PaymentMethod } from "@/types";

/** Simple EMV chip mark for debit/credit cards. */
function ChipIcon() {
  return (
    <svg width="34" height="26" viewBox="0 0 34 26" fill="none" aria-hidden>
      <rect x="1" y="1" width="32" height="24" rx="5" fill="rgba(255,255,255,0.28)" stroke="rgba(255,255,255,0.45)" />
      <path d="M1 9h10M1 17h10M23 9h10M23 17h10M11 9v8M23 9v8M11 13h12" stroke="rgba(20,18,10,0.4)" strokeWidth="1.4" />
    </svg>
  );
}

/** Mouse-tracking 3D tilt wrapper shared by payment + wallet cards. */
export function TiltCard({
  children,
  className,
  onClick,
  gradient,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  gradient?: [string, string];
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: React.MouseEvent): void => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${(px * 9).toFixed(2)}deg) rotateX(${(-py * 9).toFixed(2)}deg) scale(1.015)`;
  };

  const onMouseLeave = (): void => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn("bank-card group", onClick && "cursor-pointer", className)}
      style={
        gradient
          ? {
              background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
              boxShadow: `0 2px 6px rgba(0,0,0,0.4), 0 18px 40px -14px ${gradient[1]}99, 0 30px 60px -20px rgba(0,0,0,0.7)`,
            }
          : undefined
      }
    >
      {children}
      <span className="sheen" aria-hidden />
    </div>
  );
}

interface PaymentMethodCardProps {
  method: PaymentMethod;
  onDelete: (method: PaymentMethod) => void;
  index: number;
}

/** A physical bank card — gradient face, chip, tilt, glossy sheen. */
export function PaymentMethodCard({ method, onDelete, index }: PaymentMethodCardProps) {
  const gradient = bankGradient(method.bank_key);
  const upiApp = method.payment_type === "upi" ? UPI_APPS.find((a) => a.key === method.upi_app) : undefined;

  return (
    <div
      className="w-[min(340px,84vw)] shrink-0 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 80, 320)}ms` }}
    >
      <TiltCard gradient={gradient} className="shimmer-card text-white">
        {/* faint texture ring so big cards don't band */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full opacity-25 blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.35), transparent 70%)" }}
        />

        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">Bank</p>
              <p className="mt-0.5 max-w-[200px] truncate text-lg font-bold tracking-tight">{method.bank_name}</p>
            </div>
            <div className="relative h-10 w-10">
              <span className="absolute inset-0 flex items-center justify-center rounded-xl border border-white/25 bg-white/15 font-display text-sm backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-0">
                {bankBadgeText(method.bank_name)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(method);
                }}
                aria-label={`Delete ${method.bank_name} method`}
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-white/90 opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-black/60 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {method.payment_type === "debit" || method.payment_type === "credit" ? <ChipIcon /> : null}
            {method.payment_type === "upi" ? (
              <span className="rounded-lg border border-white/25 bg-white/12 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.14)" }}>
                {method.upi_app_name ?? upiApp?.name ?? "UPI"}
              </span>
            ) : null}
          </div>

          <div className="flex items-end justify-between gap-3">
            <span className="rounded-md bg-black/25 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
              {PAYMENT_TYPE_LABEL[method.payment_type]}
            </span>
            <p className="amount text-[15px] font-semibold tracking-[0.14em] text-white/95">
              ···· ···· ···· {method.last_four_digits}
            </p>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}

/** Dashed "add a card" placeholder with the same physical proportions. */
export function AddMethodCard({ onClick }: { onClick: () => void }) {
  return (
    <div className="w-[min(340px,84vw)] shrink-0">
      <TiltCard onClick={onClick} className="border-2 border-dashed border-line-strong bg-card/50 transition-colors hover:border-brand hover:bg-brand-soft/40">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink3 transition-colors group-hover:text-brand-deep">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-card-hi transition-all group-hover:border-brand group-hover:shadow-[0_0_20px_-6px_var(--brand-glow)]">
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-[13px] font-semibold">Add card</span>
        </div>
      </TiltCard>
    </div>
  );
}
