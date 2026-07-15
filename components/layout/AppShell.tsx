"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { SplashScreen } from "@/components/ui/LoadingSpinner";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";

/** Auth-guarded application chrome: sidebar on desktop, floating nav on mobile. */
export function AppShell({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (configured && !loading && !user) router.replace("/");
  }, [configured, loading, user, router]);

  if (!configured) return <SetupNotice />;
  if (loading || !user) return <SplashScreen />;

  return (
    <div className="relative z-10 flex min-h-screen">
      {nav ? <Sidebar /> : null}
      <div className="min-w-0 flex-1 pb-32 md:pb-12">{children}</div>
      {nav ? <BottomNav /> : null}
    </div>
  );
}

export function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card-surface max-w-lg rounded-3xl p-8">
        <h1 className="font-display text-2xl tracking-tight text-ink">Almost there</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink2">
          SpendBook needs its Supabase keys. Copy <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px]">.env.local.example</code> to{" "}
          <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px]">.env.local</code>, fill in{" "}
          <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then restart the dev
          server. Full setup steps are in the README.
        </p>
      </div>
    </div>
  );
}
