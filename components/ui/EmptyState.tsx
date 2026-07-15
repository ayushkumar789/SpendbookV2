"use client";

import type { ReactNode } from "react";

type Illustration = "books" | "transactions" | "methods" | "notfound";

interface EmptyStateProps {
  illustration: Illustration;
  title: string;
  message: string;
  action?: ReactNode;
}

/** Hand-drawn-feel SVG illustrations in the app palette — no stock imagery. */
function Art({ kind }: { kind: Illustration }) {
  const stroke = "var(--ink-3)";
  const brand = "var(--brand)";
  const soft = "var(--bg-sunken)";
  const jade = "var(--jade)";

  if (kind === "books") {
    return (
      <svg width="180" height="132" viewBox="0 0 180 132" fill="none" aria-hidden>
        <ellipse cx="90" cy="118" rx="66" ry="9" fill={soft} />
        <rect x="38" y="70" width="86" height="34" rx="7" fill={soft} stroke={stroke} strokeWidth="2" transform="rotate(-4 38 70)" />
        <rect x="48" y="44" width="86" height="34" rx="7" fill="var(--card)" stroke={stroke} strokeWidth="2" transform="rotate(2 48 44)" />
        <rect x="44" y="16" width="86" height="34" rx="7" fill={brand} transform="rotate(-2 44 16)" />
        <text x="60" y="41" fontSize="16" fontWeight="700" fill="var(--on-brand)" transform="rotate(-2 44 16)">₹</text>
        <line x1="80" y1="38" x2="118" y2="36" stroke="var(--on-brand)" strokeWidth="2.5" strokeLinecap="round" transform="rotate(-2 44 16)" opacity="0.6" />
        <circle cx="146" cy="30" r="12" fill="none" stroke={jade} strokeWidth="2" strokeDasharray="3 4" />
        <path d="M146 25v10M141 30h10" stroke={jade} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "transactions") {
    return (
      <svg width="180" height="132" viewBox="0 0 180 132" fill="none" aria-hidden>
        <ellipse cx="90" cy="120" rx="60" ry="8" fill={soft} />
        <path
          d="M58 16h64v92l-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6V16z"
          fill="var(--card)"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <line x1="70" y1="34" x2="110" y2="34" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        <line x1="70" y1="48" x2="98" y2="48" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
        <line x1="70" y1="62" x2="104" y2="62" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
        <circle cx="122" cy="88" r="20" fill={brand} />
        <text x="115" y="95" fontSize="20" fontWeight="700" fill="var(--on-brand)">₹</text>
      </svg>
    );
  }

  if (kind === "methods") {
    return (
      <svg width="180" height="132" viewBox="0 0 180 132" fill="none" aria-hidden>
        <ellipse cx="90" cy="120" rx="60" ry="8" fill={soft} />
        <rect x="30" y="42" width="96" height="60" rx="10" fill={soft} stroke={stroke} strokeWidth="2" transform="rotate(-5 30 42)" />
        <rect x="52" y="34" width="96" height="60" rx="10" fill="var(--card)" stroke={stroke} strokeWidth="2" transform="rotate(3 52 34)" />
        <rect x="60" y="48" width="22" height="15" rx="3.5" fill={brand} transform="rotate(3 52 34)" />
        <line x1="60" y1="78" x2="120" y2="78" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 6" transform="rotate(3 52 34)" opacity="0.6" />
      </svg>
    );
  }

  return (
    <svg width="180" height="132" viewBox="0 0 180 132" fill="none" aria-hidden>
      <ellipse cx="90" cy="120" rx="60" ry="8" fill={soft} />
      <circle cx="84" cy="60" r="34" fill="var(--card)" stroke={stroke} strokeWidth="2" />
      <line x1="108" y1="84" x2="130" y2="106" stroke={stroke} strokeWidth="6" strokeLinecap="round" />
      <path d="M72 52l24 16M96 52L72 68" stroke="var(--rose)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ illustration, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center animate-fade-up">
      <div className="float-breathe">
        <Art kind={illustration} />
      </div>
      <h3 className="mt-4 font-display text-2xl tracking-tight text-ink">{title}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-ink2">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
