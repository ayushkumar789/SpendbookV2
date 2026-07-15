"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { SplashScreen } from "@/components/ui/LoadingSpinner";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SetupNotice } from "@/components/layout/AppShell";
import { formatCurrency } from "@/lib/helpers";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Small fake-ledger rows that sell the product on the login screen. */
function LedgerPreview() {
  const rows = [
    { label: "Salary credited", amount: 62000, type: "in" as const, cat: "Salary / Income" },
    { label: "Monthly rent", amount: 18500, type: "out" as const, cat: "Rent" },
    { label: "DMart groceries", amount: 3240, type: "out" as const, cat: "Food & Dining" },
  ];
  return (
    <div className="card-surface w-full max-w-sm rotate-1 rounded-3xl p-2 shadow-pop transition-transform duration-500 hover:rotate-0">
      <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
        <p className="label-caps">Home Expenses</p>
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-soft text-sm">🏠</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 animate-fade-up" style={{ animationDelay: `${300 + i * 140}ms` }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: r.type === "in" ? "var(--jade-soft)" : "var(--rose-soft)" }}>
            {r.type === "in" ? <ArrowDownLeft className="h-3.5 w-3.5 text-jade" /> : <ArrowUpRight className="h-3.5 w-3.5 text-rose" />}
          </span>
          <span className="flex-1">
            <span className="block text-[13px] font-semibold text-ink">{r.label}</span>
            <span className="block text-[11px] text-ink3">{r.cat}</span>
          </span>
          <span className={`amount text-[13px] font-semibold ${r.type === "in" ? "text-jade" : "text-rose"}`}>
            {r.type === "in" ? "+" : "−"}
            {formatCurrency(r.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const { user, loading, configured, signInWithGoogle } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [loading, user, router]);

  if (!configured) return <SetupNotice />;
  if (loading || user) return <SplashScreen />;

  const handleSignIn = async (): Promise<void> => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sign-in failed", "error");
      setSigningIn(false);
    }
  };

  return (
    <main className="relative z-10 flex min-h-screen flex-col lg:flex-row">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* Editorial brand panel over a waving neon ray field */}
      <section className="relative flex flex-1 flex-col justify-center gap-8 overflow-hidden bg-sunken px-6 py-14 sm:px-12 lg:px-16">
        <div className="ray-field" aria-hidden>
          <span className="ray left-[4%]" style={{ background: "linear-gradient(180deg, var(--brand), transparent 78%)" }} />
          <span className="ray left-[24%]" style={{ background: "linear-gradient(180deg, var(--jade-chart), transparent 72%)", animationDelay: "-3.5s", width: 90 }} />
          <span className="ray left-[46%]" style={{ background: "linear-gradient(180deg, #28A4C4, transparent 75%)", animationDelay: "-7s", width: 150 }} />
          <span className="ray left-[68%]" style={{ background: "linear-gradient(180deg, var(--rose-chart), transparent 70%)", animationDelay: "-5.2s", width: 80 }} />
          <span className="ray left-[86%]" style={{ background: "linear-gradient(180deg, var(--brand), transparent 74%)", animationDelay: "-9s", width: 110 }} />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, transparent 30%, var(--bg-sunken) 96%)" }}
        />

        <div className="relative flex items-center gap-3 animate-fade-up">
          <span className="backlit flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-card-hi shadow-card">
            <span className="font-display text-2xl text-brand">₹</span>
          </span>
          <span className="font-display text-2xl tracking-tight text-ink">SpendBook</span>
        </div>

        <div className="relative animate-fade-up" style={{ animationDelay: "120ms" }}>
          <h1 className="max-w-xl font-display text-[3rem] leading-[1.02] tracking-tight text-ink sm:text-[4.2rem]">
            Every rupee,
            <br />
            <em className="text-brand not-italic font-display italic">beautifully</em> accounted.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-ink2 sm:text-lg">
            Ledgers for home, trips and business. Budgets that nudge, not nag. Share a book with family and
            watch it update live.
          </p>
        </div>

        <div className="relative hidden animate-fade-up lg:block" style={{ animationDelay: "240ms" }}>
          <LedgerPreview />
        </div>
      </section>

      {/* Sign-in panel */}
      <section className="flex flex-1 items-center justify-center px-6 pb-16 pt-4 lg:border-l lg:border-line">
        <div className="w-full max-w-sm animate-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="card-surface backlit rounded-[28px] p-7 sm:p-8">
            <p className="label-caps">Welcome</p>
            <h2 className="mt-1.5 font-display text-3xl tracking-tight text-ink">
              Open your ledgers
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink2">
              Sign in with Google — your books sync across every device.
            </p>

            <button
              onClick={() => void handleSignIn()}
              disabled={signingIn}
              className="shimmer-border press mt-7 flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-brand text-[15px] font-bold text-on-brand shadow-[0_0_24px_-8px_var(--brand-glow)] transition-all hover:scale-[1.015] hover:shadow-[0_0_36px_-8px_var(--brand-glow)] disabled:opacity-60"
            >
              {signingIn ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black/70" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                  <GoogleMark />
                </span>
              )}
              Continue with Google
            </button>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink3">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <Link
              href="/shared/enter-code"
              className="press flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-line-strong text-sm font-semibold text-ink2 transition-colors hover:bg-sunken hover:text-ink"
            >
              <KeyRound className="h-4 w-4" />
              View a shared book
            </Link>
          </div>
          <p className="mt-5 text-center text-xs leading-relaxed text-ink3">
            Free forever · Works offline · Made for Indian families
          </p>
        </div>
      </section>
    </main>
  );
}
