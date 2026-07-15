"use client";

import { useEffect, useState } from "react";
import { TiltCard } from "@/components/payment-methods/PaymentMethodCard";
import { docTypeMeta } from "@/components/wallet/docTypes";
import { getWalletSignedUrl } from "@/lib/features/wallet";
import type { WalletDocument } from "@/types/features";

interface DocumentCardProps {
  doc: WalletDocument;
  index: number;
  onOpen: (doc: WalletDocument) => void;
}

/** Physical-card preview: type gradient + blurred front-side thumbnail. */
export function DocumentCard({ doc, index, onOpen }: DocumentCardProps) {
  const meta = docTypeMeta(doc.doc_type);
  const Icon = meta.icon;
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!doc.front_url) return;
    let cancelled = false;
    getWalletSignedUrl(doc.front_url)
      .then((url) => {
        if (!cancelled) setThumb(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [doc.front_url]);

  return (
    <div
      className="w-[min(340px,84vw)] shrink-0 animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 80, 320)}ms` }}
    >
      <TiltCard gradient={meta.gradient} className="shimmer-card text-white" onClick={() => onOpen(doc)}>
        {/* blurred preview of the actual document behind a privacy veil */}
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-[7px]"
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${meta.gradient[0]}CC 10%, transparent 60%, ${meta.gradient[1]}B3 100%)` }}
        />

        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">{meta.name}</p>
              <p className="mt-0.5 max-w-[220px] truncate text-lg font-bold tracking-tight drop-shadow">
                {doc.custom_label || doc.doc_name}
              </p>
            </div>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 backdrop-blur-sm"
              style={{ background: `${meta.color}55` }}
            >
              <Icon className="h-5 w-5" />
            </span>
          </div>
          <div className="flex items-end justify-between">
            <span className="rounded-md bg-black/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
              {doc.has_back ? "Front + Back" : "Single side"}
            </span>
            <span className="text-[11px] font-semibold text-white/70">Tap to view</span>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}
