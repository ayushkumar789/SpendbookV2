"use client";

import { useState } from "react";
import { Copy, Link2, RefreshCcw, Share2, StopCircle } from "lucide-react";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { enableSharing, resetShareLink, stopSharing } from "@/lib/database";
import { AdaptiveDialog } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/hooks/useToast";
import type { Book } from "@/types";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  book: Book;
  onBookChange: (book: Book) => void;
}

function shareUrl(shareId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/shared/${shareId}`;
}

export function ShareModal({ open, onClose, book, onBookChange }: ShareModalProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const ensureShared = async (): Promise<Book> => {
    if (book.is_shared && book.share_id) return book;
    const updated = await enableSharing(book);
    onBookChange(updated);
    return updated;
  };

  const handleCopy = async (): Promise<void> => {
    setBusy(true);
    try {
      const b = await ensureShared();
      await navigator.clipboard.writeText(b.share_id ?? "");
      toast("Share code copied", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not copy", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async (): Promise<void> => {
    setBusy(true);
    try {
      const b = await ensureShared();
      await navigator.clipboard.writeText(shareUrl(b.share_id ?? ""));
      toast("Link copied", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not copy", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleSystemShare = async (): Promise<void> => {
    setBusy(true);
    try {
      const b = await ensureShared();
      const url = shareUrl(b.share_id ?? "");
      const text = `Follow my "${book.name}" ledger live on SpendBook`;
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: "SpendBook", text, url });
      } else if (navigator.share) {
        await navigator.share({ title: "SpendBook", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast("Link copied — sharing not supported here", "info");
      }
    } catch {
      /* user dismissed the share sheet */
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdaptiveDialog open={open} onClose={onClose} title="Share this book">
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-ink2">
            Anyone with this code can watch <span className="font-semibold text-ink">{book.name}</span> live —
            read-only, no sign-in needed.
          </p>

          <button
            onClick={() => void handleCopy()}
            disabled={busy}
            className="press group rounded-2xl border-2 border-dashed border-line-strong bg-sunken p-4 text-left transition-colors hover:border-brand"
          >
            <p className="label-caps mb-1 flex items-center justify-between">
              Share code
              <Copy className="h-3.5 w-3.5 transition-colors group-hover:text-brand-deep" />
            </p>
            <p className="amount break-all text-sm font-semibold tracking-wide text-ink">
              {book.is_shared && book.share_id ? book.share_id : "Tap to generate & copy"}
            </p>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" icon={<Link2 className="h-4 w-4" />} onClick={() => void handleCopyLink()} disabled={busy}>
              Copy link
            </Button>
            <Button icon={<Share2 className="h-4 w-4" />} onClick={() => void handleSystemShare()} disabled={busy}>
              Share…
            </Button>
          </div>

          {book.is_shared ? (
            <div className="mt-1 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <Button
                variant="ghost"
                icon={<RefreshCcw className="h-4 w-4" />}
                onClick={() => setConfirmReset(true)}
                disabled={busy}
              >
                Reset link
              </Button>
              <Button
                variant="ghost"
                className="text-rose hover:bg-rose-soft hover:text-rose"
                icon={<StopCircle className="h-4 w-4" />}
                onClick={() => setConfirmStop(true)}
                disabled={busy}
              >
                Stop sharing
              </Button>
            </div>
          ) : null}
        </div>
      </AdaptiveDialog>

      <ConfirmDialog
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        title="Stop sharing?"
        message="The current link and code will stop working immediately. You can share again later with the same code."
        confirmLabel="Stop sharing"
        destructive
        onConfirm={async () => {
          const updated = await stopSharing(book.id);
          onBookChange(updated);
          toast("Sharing stopped", "info");
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset share link?"
        message="A brand-new code will be generated. Anyone using the old link or code will lose access."
        confirmLabel="Reset link"
        destructive
        onConfirm={async () => {
          const updated = await resetShareLink(book.id);
          onBookChange(updated);
          toast("New share link generated", "success");
        }}
      />
    </>
  );
}
