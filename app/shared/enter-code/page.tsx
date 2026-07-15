"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public screen — no login required. */
export default function EnterCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    // Accept a bare code or a full pasted link.
    const match = code.trim().match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!match || !UUID_RE.test(match[0])) {
      setError("That doesn't look like a share code — paste the full code or link");
      return;
    }
    router.push(`/shared/${match[0].toLowerCase()}`);
  };

  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <button
        onClick={() => router.back()}
        className="press absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink2 transition-colors hover:text-ink"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-ink shadow-pop">
            <span className="font-display text-3xl font-bold text-brand">₹</span>
          </span>
          <div>
            <h1 className="font-display text-3xl tracking-tight text-ink">Open a shared book</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink2">
              Paste the code or link someone shared with you. No account needed — it updates live.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card-surface flex flex-col gap-4 rounded-3xl p-6">
          <Input
            label="Share code or link"
            placeholder="e.g. 3f2a91c8-…"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            error={error}
            autoFocus
            className="amount"
          />
          <Button type="submit" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
            View book
          </Button>
        </form>
      </div>
    </main>
  );
}
