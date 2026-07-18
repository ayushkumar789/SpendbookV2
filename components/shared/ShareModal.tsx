"use client";

import { useState } from "react";
import { Copy, Eye, Link2, Pencil, RefreshCcw, ScanEye, StopCircle, X } from "lucide-react";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import {
  SHARE_ACTIVE_COLUMN,
  SHARE_ID_COLUMN,
  ensureShareId,
  resetShareId,
  setShareLinkActive,
  shareUrl,
  stopAllSharing,
} from "@/lib/features/sharing";
import { cn } from "@/lib/helpers";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { OVERLAY_STYLE, PANEL_STYLE, useBodyScrollLock } from "@/components/ui/overlay";
import { useToast } from "@/hooks/useToast";
import type { Book } from "@/types";
import type { BookV5, ShareAccessLevel } from "@/types/features";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  book: Book;
  onBookChange: (book: Book) => void;
}

const LEVELS: Array<{
  key: ShareAccessLevel;
  label: string;
  icon: typeof Eye;
  description: string;
}> = [
  {
    key: "view",
    label: "View",
    icon: Eye,
    description:
      "Viewer can see transactions, amounts, and charts. Payment methods and contact details are hidden.",
  },
  {
    key: "details",
    label: "Details",
    icon: ScanEye,
    description:
      "Viewer sees everything including payment methods, contacts, and notes. Nothing is hidden.",
  },
  {
    key: "edit",
    label: "Edit",
    icon: Pencil,
    description:
      "Viewer must sign in to SpendBook. They can add, edit, and delete transactions as if it were their own book.",
  },
];

export function ShareModal({ open, onClose, book, onBookChange }: ShareModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<ShareAccessLevel>("view");
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useBodyScrollLock(open);

  const b = book as BookV5;
  const level = LEVELS.find((l) => l.key === tab) ?? LEVELS[0];
  const shareId = b[SHARE_ID_COLUMN[tab]] ?? null;
  const active = b[SHARE_ACTIVE_COLUMN[tab]] ?? true;

  /** Generates this tab's code on first use, then hands it back. */
  const ensureId = async (): Promise<string> => {
    if (book.is_shared && shareId) return shareId;
    const updated = await ensureShareId(b, tab);
    onBookChange(updated);
    return updated[SHARE_ID_COLUMN[tab]] ?? "";
  };

  const run = async (task: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = (): Promise<void> =>
    run(async () => {
      await navigator.clipboard.writeText(await ensureId());
      toast("Share code copied", "success");
    });

  const handleShareLink = (): Promise<void> =>
    run(async () => {
      const url = shareUrl(await ensureId());
      const text = `Follow my "${book.name}" ledger live on SpendBook`;
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: "SpendBook", text, url }).catch(() => undefined);
      } else if (navigator.share) {
        await navigator.share({ title: "SpendBook", text, url }).catch(() => undefined);
      } else {
        await navigator.clipboard.writeText(url);
        toast("Link copied", "success");
      }
    });

  const handleToggleActive = (): Promise<void> =>
    run(async () => {
      if (!shareId) return;
      const updated = await setShareLinkActive(book.id, tab, !active);
      onBookChange(updated);
      toast(active ? `${level.label} link paused` : `${level.label} link active`, "info");
    });

  return (
    <>
      {open && (
        <div style={OVERLAY_STYLE} onClick={onClose}>
          <div
            role="dialog"
            aria-modal="true"
            style={PANEL_STYLE}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="font-display text-xl tracking-tight text-ink">
                Share <span className="text-brand-deep">{book.name}</span>
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="press -mr-1 -mt-1 rounded-full p-2 text-ink3 transition-colors hover:bg-sunken hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {/* Access level tabs */}
            <div className="mb-4 grid grid-cols-3 rounded-2xl border border-line bg-sunken p-1">
              {LEVELS.map((l) => {
                const Icon = l.icon;
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setTab(l.key)}
                    aria-pressed={tab === l.key}
                    className={cn(
                      "press flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold tracking-tight transition-colors",
                      tab === l.key ? "bg-card text-ink shadow-card" : "text-ink3 hover:text-ink"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {l.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-ink2">{level.description}</p>

              {/* Share code */}
              <button
                onClick={() => void handleCopyCode()}
                disabled={busy}
                className="press group rounded-2xl border-2 border-dashed border-line-strong bg-sunken p-4 text-left transition-colors hover:border-brand"
              >
                <p className="label-caps mb-1 flex items-center justify-between">
                  {level.label} share code
                  <Copy className="h-3.5 w-3.5 transition-colors group-hover:text-brand-deep" />
                </p>
                <p className="amount break-all text-sm font-semibold tracking-wide text-ink">
                  {book.is_shared && shareId ? shareId : "Tap to generate & copy"}
                </p>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => void handleCopyCode()}
                  disabled={busy}
                >
                  Copy code
                </Button>
                <Button icon={<Link2 className="h-4 w-4" />} onClick={() => void handleShareLink()} disabled={busy}>
                  Share link
                </Button>
              </div>

              {/* Active / Paused toggle — appears once the link exists */}
              {book.is_shared && shareId ? (
                <button
                  type="button"
                  onClick={() => void handleToggleActive()}
                  disabled={busy}
                  aria-pressed={active}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: active ? "var(--jade)" : "var(--ink3)" }}
                  />
                  <span className="flex-1 text-left">
                    <span className="block text-sm font-semibold text-ink">{active ? "Active" : "Paused"}</span>
                    <span className="block text-xs text-ink3">
                      {active
                        ? `The ${level.label.toLowerCase()} link is live right now`
                        : "This link stops working until you resume it"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "relative h-7 w-12 shrink-0 rounded-full transition-all duration-200",
                      active ? "bg-brand shadow-[0_0_14px_-2px_var(--brand-glow)]" : "border border-line-strong bg-sunken"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-all duration-200",
                        active ? "left-[calc(100%-1.625rem)]" : "left-0.5"
                      )}
                    />
                  </span>
                </button>
              ) : null}

              {/* Danger zone — always visible */}
              <div className="mt-1 grid grid-cols-2 gap-3 border-t border-line pt-4">
                <Button
                  variant="ghost"
                  icon={<RefreshCcw className="h-4 w-4" />}
                  onClick={() => setConfirmReset(true)}
                  disabled={busy || !shareId}
                >
                  Reset {level.label.toLowerCase()} link
                </Button>
                <Button
                  variant="ghost"
                  className="text-rose hover:bg-rose-soft hover:text-rose"
                  icon={<StopCircle className="h-4 w-4" />}
                  onClick={() => setConfirmStop(true)}
                  disabled={busy || !book.is_shared}
                >
                  Stop all sharing
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        title="Stop all sharing?"
        message="All three links — View, Details and Edit — stop working immediately and their codes are discarded. Sharing again will generate fresh codes."
        confirmLabel="Stop sharing"
        destructive
        onConfirm={async () => {
          const updated = await stopAllSharing(book.id);
          onBookChange(updated);
          toast("Sharing stopped", "info");
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={`Reset the ${level.label.toLowerCase()} link?`}
        message="A brand-new code will be generated for this access level. Anyone using the old link or code will lose access. The other levels are untouched."
        confirmLabel="Reset link"
        destructive
        onConfirm={async () => {
          const updated = await resetShareId(book.id, tab);
          onBookChange(updated);
          toast(`New ${level.label.toLowerCase()} link generated`, "success");
        }}
      />
    </>
  );
}
