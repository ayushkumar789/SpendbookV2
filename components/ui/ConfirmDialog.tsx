"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OVERLAY_STYLE, PANEL_STYLE, useBodyScrollLock } from "@/components/ui/overlay";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  useBodyScrollLock(open);

  const handleConfirm = async (): Promise<void> => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div style={OVERLAY_STYLE} onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        style={PANEL_STYLE}
        onClick={(e) => e.stopPropagation()}
      >
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: destructive ? "var(--rose-soft)" : "var(--brand-soft)" }}
        >
          <TriangleAlert className="h-6 w-6" style={{ color: destructive ? "var(--rose)" : "var(--brand-deep)" }} />
        </span>
        <div>
          <h3 className="font-display text-xl tracking-tight text-ink">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink2">{message}</p>
        </div>
        <div className="mt-2 grid w-full grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={() => void handleConfirm()} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
