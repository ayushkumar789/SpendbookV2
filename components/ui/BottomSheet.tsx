"use client";

import { useEffect, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px] animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="glass-surface absolute inset-x-0 bottom-0 z-10 max-h-[86vh] overflow-y-auto rounded-t-[28px] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-pop animate-sheet-up"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong" />
        {title ? (
          <h2 className="mb-5 font-display text-xl tracking-tight text-ink">{title}</h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}
