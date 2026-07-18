"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { OVERLAY_STYLE, PANEL_STYLE, useBodyScrollLock } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowSkeleton } from "@/components/ui/Skeleton";
import { PLATFORMS, platformMeta } from "@/components/links/platforms";
import {
  createProfileLink,
  deleteProfileLink,
  getProfileLinks,
  reorderProfileLinks,
  updateProfileLink,
} from "@/lib/features/links";
import { cn } from "@/lib/helpers";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import type { ProfileLink } from "@/types/features";

export default function LinksPage() {
  return (
    <AppShell>
      <LinksContent />
    </AppShell>
  );
}

function publicProfileUrl(userId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/u/${userId}`;
}

function LinksContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProfileLink | null>(null);
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setLinks(await getProfileLinks(user.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load links", "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shareProfile = async (): Promise<void> => {
    if (!user) return;
    await navigator.clipboard.writeText(publicProfileUrl(user.id));
    toast("Profile link copied!", "success");
  };

  const togglePublic = async (link: ProfileLink): Promise<void> => {
    // optimistic — instant feel
    setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, is_public: !l.is_public } : l)));
    try {
      await updateProfileLink(link.id, { is_public: !link.is_public });
    } catch (e) {
      setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, is_public: link.is_public } : l)));
      toast(e instanceof Error ? e.message : "Could not update link", "error");
    }
  };

  const onDrop = async (targetIndex: number): Promise<void> => {
    const from = dragIndex.current;
    dragIndex.current = null;
    setDragOver(null);
    if (from === null || from === targetIndex) return;
    const next = [...links];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    setLinks(next);
    try {
      await reorderProfileLinks(next.map((l) => l.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save the new order", "error");
      await refresh();
    }
  };

  return (
    <>
      <Header
        title="Your links"
        subtitle="One page for everywhere you are"
        hero
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              icon={<Share2 className="h-4 w-4" />}
              onClick={() => void shareProfile()}
              className="hidden sm:inline-flex"
            >
              Share profile
            </Button>
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
              onClick={() => setAddOpen(true)}
              className="hidden sm:inline-flex"
            >
              Add link
            </Button>
          </>
        }
      />

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 md:px-8">
        {/* Mobile share row */}
        <div className="flex gap-2.5 sm:hidden">
          <Button variant="outline" className="flex-1" icon={<Share2 className="h-4 w-4" />} onClick={() => void shareProfile()}>
            Share profile
          </Button>
          <Button className="flex-1" icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
            Add link
          </Button>
        </div>

        {loading ? (
          <div className="card-surface rounded-3xl">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : links.length === 0 ? (
          <EmptyState
            illustration="books"
            title="Add your first link"
            message="Instagram, LinkedIn, your portfolio — collect them all, then share one beautiful page."
            action={
              <Button size="lg" icon={<Link2 className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
                Add a link
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {links.map((link, i) => {
              const meta = platformMeta(link.platform);
              const Icon = meta.icon;
              return (
                <div
                  key={link.id}
                  draggable
                  onDragStart={() => {
                    dragIndex.current = i;
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(i);
                  }}
                  onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
                  onDrop={() => void onDrop(i)}
                  className={cn(
                    "card-surface card-lift group flex items-center gap-3 rounded-2xl p-3.5 animate-fade-up",
                    dragOver === i && "border-brand shadow-[0_0_20px_-6px_var(--brand-glow)]"
                  )}
                  style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
                >
                  <span className="cursor-grab text-ink3 opacity-50 transition-opacity group-hover:opacity-100 active:cursor-grabbing" aria-label="Drag to reorder">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                    style={{ background: meta.color, color: meta.darkText ? "#1A1A05" : "#fff" }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {meta.name}
                      {link.display_name ? <span className="font-medium text-ink2"> · {link.display_name}</span> : null}
                    </p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-xs text-ink3 transition-colors hover:text-brand-deep"
                    >
                      {link.url}
                    </a>
                  </div>
                  <button
                    onClick={() => void togglePublic(link)}
                    aria-label={link.is_public ? "Make private" : "Make public"}
                    title={link.is_public ? "Public — visible on your profile" : "Private — only you can see it"}
                    className={cn(
                      "press flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                      link.is_public ? "bg-jade-soft text-jade" : "bg-sunken text-ink3 hover:text-ink"
                    )}
                  >
                    {link.is_public ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(link.url);
                      toast("Link copied", "success");
                    }}
                    aria-label="Copy URL"
                    className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink3 transition-colors hover:bg-card-hi hover:text-ink"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPendingDelete(link)}
                    aria-label="Delete link"
                    className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink3 transition-colors hover:bg-rose-soft hover:text-rose"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add link"
        className="shimmer-border press fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-nav transition-transform hover:scale-105 md:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <AddLinkDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        nextSortOrder={links.length}
        onCreate={async (input) => {
          if (!user) return;
          await createProfileLink(user.id, input);
          toast("Link added", "success");
          setAddOpen(false);
          await refresh();
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this link?"
        message="It will disappear from your public profile immediately."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteProfileLink(pendingDelete.id);
          setPendingDelete(null);
          toast("Link deleted", "info");
          await refresh();
        }}
      />
    </>
  );
}

/* ————— Add link ————— */

function AddLinkDialog({
  open,
  onClose,
  onCreate,
  nextSortOrder,
}: {
  open: boolean;
  onClose: () => void;
  nextSortOrder: number;
  onCreate: (input: {
    platform: string;
    platform_label: string;
    url: string;
    display_name: string | null;
    is_public: boolean;
    sort_order: number;
  }) => Promise<void>;
}) {
  const [platform, setPlatform] = useState(PLATFORMS[0].key);
  const [url, setUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      setPlatform(PLATFORMS[0].key);
      setUrl("");
      setDisplayName("");
      setIsPublic(true);
      setUrlError(null);
    }
  }, [open]);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    let normalized = url.trim();
    if (normalized && !/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname.includes(".")) throw new Error("bad host");
    } catch {
      setUrlError("Enter a valid URL, e.g. instagram.com/yourname");
      return;
    }
    setBusy(true);
    try {
      await onCreate({
        platform,
        platform_label: platformMeta(platform).name,
        url: normalized,
        display_name: displayName.trim() || null,
        is_public: isPublic,
        sort_order: nextSortOrder,
      });
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        style={PANEL_STYLE}
        onClick={(e) => e.stopPropagation()}
      >
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 className="font-display text-xl tracking-tight text-ink">Add a link</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press -mr-1 -mt-1 rounded-full p-2 text-ink3 transition-colors hover:bg-sunken hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
        <div>
          <p className="label-caps mb-2">Platform</p>
          <div className="hide-scrollbar grid max-h-[200px] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPlatform(p.key)}
                  aria-pressed={platform === p.key}
                  title={p.name}
                  className={cn(
                    "press flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all duration-200",
                    platform === p.key ? "border-brand bg-brand-soft shadow-card" : "border-line bg-card hover:border-line-strong"
                  )}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
                    style={{ background: p.color, color: p.darkText ? "#1A1A05" : "#fff" }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="w-full truncate text-center text-[10px] font-semibold text-ink2">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="URL"
          placeholder="e.g. instagram.com/yourname"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setUrlError(null);
          }}
          error={urlError}
          inputMode="url"
        />
        <Input
          label="Display name · optional"
          placeholder="e.g. @ayushkumar789"
          value={displayName}
          maxLength={60}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <button
          type="button"
          onClick={() => setIsPublic(!isPublic)}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3"
          aria-pressed={isPublic}
        >
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", isPublic ? "bg-jade-soft" : "bg-sunken")}>
            {isPublic ? <Eye className="h-4 w-4 text-jade" /> : <EyeOff className="h-4 w-4 text-ink3" />}
          </span>
          <span className="flex-1 text-left">
            <span className="block text-sm font-semibold text-ink">{isPublic ? "Public" : "Private"}</span>
            <span className="block text-xs text-ink3">
              {isPublic ? "Shown on your shareable profile page" : "Only visible to you"}
            </span>
          </span>
          <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-all", isPublic ? "bg-brand shadow-[0_0_14px_-2px_var(--brand-glow)]" : "border border-line-strong bg-sunken")}>
            <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-all", isPublic ? "left-[calc(100%-1.625rem)]" : "left-0.5")} />
          </span>
        </button>

        <Button type="submit" size="lg" loading={busy}>
          Save link
        </Button>
      </form>
      </div>
    </div>
  );
}
