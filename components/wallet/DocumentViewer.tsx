"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { deleteWalletDocument, downloadWalletSide, getWalletSignedUrl } from "@/lib/features/wallet";
import { docTypeMeta } from "@/components/wallet/docTypes";
import { cn } from "@/lib/helpers";
import { useToast } from "@/hooks/useToast";
import type { WalletDocument } from "@/types/features";

interface DocumentViewerProps {
  doc: WalletDocument;
  onClose: () => void;
  onDeleted: () => void;
}

/** Full-screen viewer: front/back tabs, wheel + pinch zoom, download, delete. */
export function DocumentViewer({ doc, onClose, onDeleted }: DocumentViewerProps) {
  const { toast } = useToast();
  const meta = docTypeMeta(doc.doc_type);
  const MetaIcon = meta.icon;
  const [side, setSide] = useState<"front" | "back">("front");
  const [urls, setUrls] = useState<{ front: string | null; back: string | null }>({ front: null, back: null });
  const [scale, setScale] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const pinchDist = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (path: string | null): Promise<string | null> =>
      path ? getWalletSignedUrl(path).catch(() => null) : Promise.resolve(null);
    void Promise.all([load(doc.front_url), load(doc.back_url)]).then(([front, back]) => {
      if (!cancelled) setUrls({ front, back });
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    setScale(1);
  }, [side]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const clampScale = (s: number): number => Math.min(4, Math.max(1, s));

  const onWheel = (e: React.WheelEvent): void => {
    setScale((s) => clampScale(s - e.deltaY * 0.0022));
  };

  const onTouchMove = (e: React.TouchEvent): void => {
    if (e.touches.length !== 2) return;
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    if (pinchDist.current !== null) {
      setScale((s) => clampScale(s * (d / (pinchDist.current as number))));
    }
    pinchDist.current = d;
  };

  const currentUrl = side === "front" ? urls.front : urls.back;

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-black/92 backdrop-blur-md animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${meta.color}33` }}>
          <MetaIcon size={18} style={{ color: meta.color }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{doc.custom_label || doc.doc_name}</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">{meta.name}</p>
        </div>
        <button
          onClick={() => {
            setDownloading(true);
            downloadWalletSide(doc, side)
              .then(() => toast("Image downloaded", "success"))
              .catch((e: unknown) => toast(e instanceof Error ? e.message : "Download failed", "error"))
              .finally(() => setDownloading(false));
          }}
          disabled={downloading || !currentUrl}
          aria-label="Download this side"
          className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          <Download className="h-[17px] w-[17px]" />
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete document"
          className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-rose hover:text-white"
        >
          <Trash2 className="h-[17px] w-[17px]" />
        </button>
        <button
          onClick={onClose}
          aria-label="Close viewer"
          className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Side tabs */}
      {doc.has_back ? (
        <div className="mx-auto flex rounded-full border border-white/15 bg-white/5 p-1">
          {(["front", "back"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={cn(
                "rounded-full px-6 py-1.5 text-[13px] font-bold capitalize transition-all duration-200",
                side === s ? "bg-brand text-on-brand shadow-[0_0_16px_-4px_var(--brand-glow)]" : "text-white/60 hover:text-white"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {/* Stage */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden p-4"
        onWheel={onWheel}
        onTouchMove={onTouchMove}
        onTouchEnd={() => {
          pinchDist.current = null;
        }}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={`${doc.doc_name} — ${side}`}
            className="max-h-full max-w-full select-none rounded-xl object-contain shadow-pop transition-transform duration-100 animate-scale-in"
            style={{ transform: `scale(${scale})` }}
            draggable={false}
          />
        ) : (
          <LoadingSpinner className="h-8 w-8" />
        )}
      </div>
      <p className="pb-4 text-center text-[11px] text-white/40">
        {scale > 1 ? `${Math.round(scale * 100)}% · ` : ""}scroll or pinch to zoom
      </p>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this document?"
        message="Both sides will be permanently removed from your vault."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await deleteWalletDocument(doc);
          toast("Document deleted", "info");
          onDeleted();
          onClose();
        }}
      />
    </div>
  );
}
