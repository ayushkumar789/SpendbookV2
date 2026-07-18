"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/helpers";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const SLIDE_MS = 300;

/**
 * Mobile bottom sheet. Stays mounted while animating so the sheet slides
 * up on open and back down on close (translateY 100% ↔ 0). Closes on
 * Escape, backdrop tap, or dragging the handle down.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  // mounted keeps the DOM alive for the exit animation; visible drives the transform
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Paint one frame in the off-screen position first so the
      // slide-up transition actually runs on the next frame.
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [open]);

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

  if (!mounted) return null;

  const onHandleTouchStart = (e: React.TouchEvent): void => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onHandleTouchMove = (e: React.TouchEvent): void => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setDragY(dy);
  };
  const onHandleTouchEnd = (): void => {
    touchStartY.current = null;
    if (dragY > 80) onClose();
    setDragY(0);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[49] bg-black/60 backdrop-blur-[3px] transition-opacity",
          visible ? "opacity-100" : "opacity-0"
        )}
        style={{ transitionDuration: `${SLIDE_MS}ms` }}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className="glass-surface fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-[28px] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-pop"
        style={{
          transform: visible ? `translateY(${dragY}px)` : "translateY(100%)",
          // While dragging, track the finger 1:1; otherwise animate the slide
          transition: dragY > 0 ? "none" : `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        {/* Drag handle zone — touch-none so dragging never fights inner scroll */}
        <div
          className="-mx-5 -mt-3 cursor-grab touch-none px-5 pt-3"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong" />
          {title ? <h2 className="mb-5 font-display text-xl tracking-tight text-ink">{title}</h2> : null}
        </div>
        {children}
      </div>
    </>
  );
}
