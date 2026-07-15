"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { SplashScreen } from "@/components/ui/LoadingSpinner";

/**
 * OAuth landing page. On native, the deep-link handler forwards
 * com.spendbook.app://auth/callback#access_token=… here with the hash intact;
 * we set the Supabase session from those tokens and continue to /home.
 * Also handles PKCE-style ?code= callbacks for good measure.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async (): Promise<void> => {
      const supabase = getSupabase();
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = query.get("code");
      const providerError =
        hash.get("error_description") ?? query.get("error_description") ?? hash.get("error") ?? query.get("error");

      try {
        if (accessToken && refreshToken) {
          const { error: err } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (err) throw new Error(err.message);
        } else if (code) {
          const { error: err } = await supabase.auth.exchangeCodeForSession(code);
          if (err) throw new Error(err.message);
        } else if (providerError) {
          throw new Error(providerError);
        } else {
          // detectSessionInUrl may have already consumed the hash during client
          // init — fine, as long as a session actually exists now.
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error("No sign-in credentials found in the callback URL.");
        }
        router.replace("/home");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed");
      }
    };
    void run();
  }, [router]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-2xl tracking-tight text-ink">Sign-in didn&apos;t finish</p>
        <p className="max-w-sm text-sm leading-relaxed text-ink2">{error}</p>
        <Link
          href="/"
          className="press mt-2 flex h-11 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-bold text-on-brand"
        >
          Back to sign in
        </Link>
      </main>
    );
  }

  return <SplashScreen />;
}
