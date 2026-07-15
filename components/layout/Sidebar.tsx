"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Flag,
  Home,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn, getInitials } from "@/lib/helpers";
import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/goals", label: "Goals", icon: Flag },
  { href: "/wallet", label: "Wallet", icon: ShieldCheck },
  { href: "/links", label: "Links", icon: Link2 },
  { href: "/payment-methods", label: "Payment Methods", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

const COLLAPSE_KEY = "spendbook-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const activeIndex = NAV.findIndex((n) => pathname.startsWith(n.href));

  // Glowing indicator slides to the active item.
  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el) setIndicator({ top: el.offsetTop, height: el.offsetHeight });
    else setIndicator(null);
  }, [activeIndex, collapsed]);

  const toggle = (): void => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  };

  const name = (user?.user_metadata.full_name as string | undefined) ?? user?.email ?? "";
  const photo = user?.user_metadata.avatar_url as string | undefined;

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-line bg-side transition-[width] duration-300 md:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      {/* Whisper of the Raycast ray field behind the nav */}
      <div className="ray-field opacity-[0.16]" aria-hidden>
        <span className="ray left-[8%]" style={{ background: "linear-gradient(180deg, var(--brand), transparent 75%)" }} />
        <span className="ray left-[52%]" style={{ background: "linear-gradient(180deg, var(--jade-chart), transparent 70%)", animationDelay: "-4s" }} />
      </div>

      <div className={cn("relative flex items-center gap-3 px-5 pb-7 pt-7", collapsed && "justify-center px-0")}>
        <span className="backlit flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card-hi border border-line shadow-card">
          <span className="font-display text-xl text-brand">₹</span>
        </span>
        {!collapsed ? (
          <span className="font-display text-[22px] tracking-tight text-ink">SpendBook</span>
        ) : null}
      </div>

      <nav className="relative flex flex-1 flex-col gap-1 px-3">
        {/* Sliding glow indicator */}
        {indicator ? (
          <span
            aria-hidden
            className="absolute left-3 right-3 rounded-xl bg-card-hi shadow-[0_0_24px_-6px_var(--brand-glow),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ top: indicator.top, height: indicator.height }}
          >
            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand shadow-[0_0_10px_var(--brand-glow)]" />
          </span>
        ) : null}

        {NAV.map(({ href, label, icon: Icon }, i) => (
          <Link
            key={href}
            href={href}
            title={label}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className={cn(
              "press relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200",
              collapsed && "justify-center px-0",
              i === activeIndex ? "text-ink" : "text-ink3 hover:text-ink2"
            )}
          >
            <Icon
              className="h-[18px] w-[18px] shrink-0 transition-colors"
              style={i === activeIndex ? { color: "var(--brand)" } : undefined}
            />
            {!collapsed ? label : null}
          </Link>
        ))}
      </nav>

      <div className="relative flex flex-col gap-2 border-t border-line p-3">
        {user ? (
          <div className={cn("flex items-center gap-3 rounded-xl px-2 py-2", collapsed && "justify-center px-0")}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full border border-line-strong" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-hi text-xs font-bold text-ink2">
                {getInitials(name)}
              </span>
            )}
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink">{name}</p>
                <p className="truncate text-xs text-ink3">{user.email}</p>
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          onClick={toggle}
          className="press flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-ink3 transition-colors hover:bg-card-hi hover:text-ink"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed ? "Collapse" : null}
        </button>
      </div>
    </aside>
  );
}
