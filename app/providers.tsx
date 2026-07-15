"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { RouteGlow } from "@/components/ui/RouteGlow";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { upsertUserProfile } from "@/lib/database";
import { checkAndProcessRecurringTransactions } from "@/lib/recurring";
import type { ThemePreference, ToastItem } from "@/types";

/* ————————————— Theme ————————————— */

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = "spendbook-theme";

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) as ThemePreference | null;
    const pref: ThemePreference = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setPreferenceState(pref);
    setResolved(pref === "system" ? systemTheme() : pref);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#0B0C0A" : "#F4F6EF");
  }, [resolved]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (): void => setResolved(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    // Animate the color variables only during an explicit switch.
    document.documentElement.classList.add("theme-anim");
    window.setTimeout(() => document.documentElement.classList.remove("theme-anim"), 450);
    window.localStorage.setItem(THEME_KEY, p);
    setPreferenceState(p);
    setResolved(p === "system" ? systemTheme() : p);
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside Providers");
  return ctx;
}

/* ————————————— Auth ————————————— */

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();

    const applySession = (session: Session | null): void => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user && !bootstrapped.current) {
        bootstrapped.current = true;
        const u = session.user;
        void upsertUserProfile({
          id: u.id,
          display_name: (u.user_metadata.full_name as string | undefined) ?? (u.user_metadata.name as string | undefined) ?? null,
          email: u.email ?? null,
          photo_url: (u.user_metadata.avatar_url as string | undefined) ?? (u.user_metadata.picture as string | undefined) ?? null,
        }).catch(() => undefined);
        void checkAndProcessRecurringTransactions(u.id).catch(() => undefined);
      }
      if (!session?.user) bootstrapped.current = false;
    };

    void supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo(
    () => ({ user, loading, configured, signInWithGoogle, signOut }),
    [user, loading, configured, signInWithGoogle, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside Providers");
  return ctx;
}

/* ————————————— Toasts ————————————— */

interface ToastContextValue {
  toast: (message: string, kind?: ToastItem["kind"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, kind: ToastItem["kind"] = "info") => {
    counter.current += 1;
    const id = counter.current;
    setItems((prev) => [...prev.slice(-3), { id, message, kind }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-8">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="glass-surface pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full py-2.5 pl-3.5 pr-5 text-sm font-medium shadow-pop animate-fade-up"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background:
                  t.kind === "success" ? "var(--jade)" : t.kind === "error" ? "var(--rose)" : "var(--brand)",
              }}
            />
            <span className="text-ink">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside Providers");
  return ctx;
}

/* ————————————— Native deep links ————————————— */

/** Routes spendbook://shared/[id] and https links into the app on Android/iOS. */
function DeepLinkHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      const match = url.match(/shared\/([0-9a-f-]{36})/i);
      if (match) window.location.href = `/shared/${match[1]}`;
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, []);
  return null;
}

/* ————————————— Root ————————————— */

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <DeepLinkHandler />
          <RouteGlow />
          {children}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
