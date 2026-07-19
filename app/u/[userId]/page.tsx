"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Check, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { platformMeta } from "@/components/links/platforms";
import { getPublicProfile } from "@/lib/features/links";
import { formatBalance, getPublicAccountBalances } from "@/lib/features/accounts";
import { isProfileSaved, removeSavedProfile, saveProfile } from "@/lib/features/people";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SplashScreen } from "@/components/ui/LoadingSpinner";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { cn, getInitials } from "@/lib/helpers";
import type { PublicAccountBalance, PublicProfile } from "@/types/features";

/** Public Linktree-style profile — no login required. */
export default function PublicProfilePage() {
  const params = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [balances, setBalances] = useState<PublicAccountBalance[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "gone">("loading");
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isOwnProfile = user?.id === params.userId;

  useEffect(() => {
    if (!user || user.id === params.userId) return;
    isProfileSaved(user.id, params.userId)
      .then(setSaved)
      .catch(() => undefined);
  }, [user, params.userId]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    getPublicProfile(params.userId)
      .then((p) => {
        if (p) {
          setProfile(p);
          setState("ready");
        } else {
          setState("gone");
        }
      })
      .catch(() => setState("gone"));
    getPublicAccountBalances(params.userId)
      .then(setBalances)
      .catch(() => setBalances([]));
  }, [params.userId]);

  if (!isSupabaseConfigured()) return <SetupNotice />;
  if (state === "loading") return <SplashScreen />;

  if (state === "gone" || !profile) {
    return (
      <main className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <EmptyState
          illustration="notfound"
          title="Profile not found"
          message="This profile doesn't exist, or its link has changed."
        />
      </main>
    );
  }

  const publicLinks = profile.links;

  /* Frosted, glowing balance cards — the one number a visitor came to see. */
  const balancesSection =
    balances.length > 0 ? (
      <div className="mt-8">
        <p className="label-caps text-center">Balances</p>
        <div className="mt-4 flex flex-col gap-3">
          {balances.map((b, i) => (
            <div
              key={b.id}
              className="glass-surface relative overflow-hidden rounded-3xl p-5 animate-fade-up"
              style={{
                animationDelay: `${120 + i * 90}ms`,
                boxShadow: `var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.06)`,
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full opacity-[0.22] blur-3xl"
                style={{ background: `radial-gradient(circle, ${b.color}, transparent 68%)` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-bold text-ink">{b.name}</p>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]",
                    b.isPaused ? "bg-sunken text-ink3" : "bg-jade-soft text-jade"
                  )}
                >
                  {b.isPaused ? null : <span className="h-1.5 w-1.5 rounded-full bg-jade animate-pulse-dot" />}
                  {b.isPaused ? "Paused" : "Live"}
                </span>
              </div>
              {b.isPaused ? (
                <p className="relative mt-3 text-[15px] font-semibold text-ink3">Balance tracking paused</p>
              ) : (
                <p className="amount relative mt-2 truncate font-display text-[34px] font-semibold leading-tight tracking-tight text-ink">
                  {b.balance !== null ? formatBalance(Number(b.balance)) : "—"}
                </p>
              )}
              {b.updatedAt ? (
                <p className="relative mt-1 text-xs text-ink3">
                  Updated {formatDistanceToNow(new Date(b.updatedAt), { addSuffix: true })}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <main className="relative z-10 min-h-screen overflow-hidden">
      {/* Accent-family gradient sky */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[46vh]"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--brand) 16%, transparent), transparent 85%)",
        }}
      />
      <div className="ray-field opacity-40" aria-hidden>
        <span className="ray left-[12%]" style={{ background: "linear-gradient(180deg, var(--brand), transparent 72%)", width: 90 }} />
        <span className="ray left-[74%]" style={{ background: "linear-gradient(180deg, var(--jade-chart), transparent 70%)", animationDelay: "-6s", width: 110 }} />
      </div>

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-16">
        {/* Identity */}
        <div className="flex flex-col items-center text-center animate-fade-up">
          {profile.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photo_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-[100px] w-[100px] rounded-full border-2 border-line-strong shadow-pop"
            />
          ) : (
            <span className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-card-hi font-display text-3xl text-ink2 shadow-pop">
              {getInitials(profile.display_name)}
            </span>
          )}
          <h1 className="mt-5 font-display text-[34px] leading-tight tracking-tight text-ink">
            {profile.display_name ?? "SpendBook user"}
          </h1>

          {/* Save to People — logged-in visitors only */}
          {isOwnProfile ? (
            <p className="mt-3 text-xs font-semibold text-ink3">This is your profile</p>
          ) : user ? (
            <button
              type="button"
              onClick={() => {
                if (saved) {
                  setConfirmRemove(true);
                  return;
                }
                if (saveBusy) return;
                setSaveBusy(true);
                saveProfile(user.id, params.userId, profile.display_name ?? "SpendBook user", profile.photo_url)
                  .then(() => {
                    setSaved(true);
                    toast("Added to your People", "success");
                  })
                  .catch((e: unknown) =>
                    toast(e instanceof Error ? e.message : "Could not save the profile", "error")
                  )
                  .finally(() => setSaveBusy(false));
              }}
              disabled={saveBusy}
              className={cn(
                "press mt-4 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors",
                saved
                  ? "border-line bg-sunken text-ink3 hover:text-ink"
                  : "border-transparent bg-brand text-on-brand shadow-[0_0_16px_-6px_var(--brand-glow)]"
              )}
              title={saved ? "Tap to remove from your People" : "Save this profile to your People"}
            >
              {saved ? <Check className="h-4 w-4" strokeWidth={3} /> : <UserPlus className="h-4 w-4" />}
              {saved ? "Saved" : "Save to People"}
            </button>
          ) : null}
        </div>

        {/* Balances lead when there are no links to show */}
        {publicLinks.length === 0 ? balancesSection : null}

        <p className="label-caps mt-6 text-center">Links</p>

        {/* Link pills */}
        <div className="mt-4 flex flex-col gap-3">
          {publicLinks.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink3">No public links yet.</p>
          ) : (
            publicLinks.map((link, i) => {
              const meta = platformMeta(link.platform);
              const Icon = meta.icon;
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-surface card-lift group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl p-4 animate-fade-up"
                  style={{
                    animationDelay: `${120 + i * 90}ms`,
                    boxShadow: `var(--shadow-card), inset 4px 0 0 ${meta.color}`,
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -left-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.28]"
                    style={{ background: meta.color }}
                  />
                  <span
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                    style={{ background: meta.color, color: meta.darkText ? "#1A1A05" : "#fff" }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{meta.name}</span>
                    {link.display_name ? (
                      <span className="block truncate text-[13px] text-ink3">{link.display_name}</span>
                    ) : null}
                  </span>
                  <ArrowUpRight className="relative h-4 w-4 shrink-0 text-ink3 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                </a>
              );
            })
          )}
        </div>

        {publicLinks.length > 0 ? balancesSection : null}

        <ConfirmDialog
          open={confirmRemove}
          onClose={() => setConfirmRemove(false)}
          title={`Remove ${profile.display_name ?? "this person"} from your People?`}
          message="You can always save them again from this page."
          confirmLabel="Remove"
          destructive
          onConfirm={async () => {
            if (!user) return;
            await removeSavedProfile(user.id, params.userId);
            setSaved(false);
            toast("Removed from your People", "info");
          }}
        />

        {/* Footer */}
        <div className="mt-auto pt-12">
          <Link
            href="/"
            className="mx-auto flex w-fit items-center gap-2 rounded-full border border-line bg-card/60 px-4 py-2 text-xs font-semibold text-ink3 backdrop-blur-sm transition-colors hover:text-ink"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-card-hi border border-line">
              <span className="font-display text-[11px] text-brand">₹</span>
            </span>
            Made with SpendBook
          </Link>
        </div>
      </div>
    </main>
  );
}
