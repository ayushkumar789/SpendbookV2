"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/helpers";
import { BottomSheet } from "@/components/ui/BottomSheet";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}

/** Centered dialog. Closes on Escape and backdrop click. */
export function Modal({ open, onClose, title, children, wide = false }: ModalProps) {
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px] animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "card-surface relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-3xl p-6 shadow-pop animate-scale-in",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        {title ? (
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="font-display text-xl tracking-tight text-ink">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="press -mr-1 -mt-1 rounded-full p-2 text-ink3 transition-colors hover:bg-sunken hover:text-ink"
            >
              <X className="h-4.5 w-4.5" size={18} />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

/** Bottom sheet on mobile, centered modal on desktop. */
export function AdaptiveDialog(props: ModalProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) return <Modal {...props} />;
  return (
    <BottomSheet open={props.open} onClose={props.onClose} title={props.title}>
      {props.children}
    </BottomSheet>
  );
}
