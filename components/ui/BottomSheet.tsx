"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/helpers";

/**
 * Dead-simple picker panel: a full-screen overlay with an opacity-only
 * fade (300ms). No transforms, no keyframes, no drag logic — those are
 * unreliable in the Capacitor WebView on Android. The panel docks to the
 * bottom on mobile and centers on desktop.
 *
 * Always rendered; `isOpen` just toggles opacity + pointer events, so the
 * fade works in both directions with a single CSS transition.
 */
export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center bg-black/70 transition-opacity duration-300 md:items-center",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="card-surface max-h-[80vh] w-full overflow-y-auto overscroll-contain rounded-t-2xl px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-pop md:max-w-md md:rounded-2xl"
      >
        {/* Cosmetic handle pill — no drag logic */}
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong md:hidden" />
        <div className={cn("mb-4 flex items-start justify-between gap-4", !title && "mb-2")}>
          {title ? <h2 className="font-display text-xl tracking-tight text-ink">{title}</h2> : <span />}
          <button
            onClick={onClose}
            aria-label="Close"
            className="press -mr-1 rounded-full p-2 text-ink3 transition-colors hover:bg-sunken hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
