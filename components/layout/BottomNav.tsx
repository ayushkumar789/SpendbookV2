"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Flag, Home, Link2, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/helpers";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/goals", label: "Goals", icon: Flag },
  { href: "/wallet", label: "Wallet", icon: ShieldCheck },
  { href: "/links", label: "Links", icon: Link2 },
  { href: "/payment-methods", label: "Methods", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Frosted floating pill — the active tab gets a glow-dot indicator. */
export function BottomNav() {
  const pathname = usePathname();
  const activeIndex = NAV.findIndex((n) => pathname.startsWith(n.href));

  return (
    <nav
      className="glass-surface fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex w-[min(26rem,calc(100%-1.5rem))] items-center rounded-full p-1 shadow-nav md:hidden"
      aria-label="Primary"
    >
      {NAV.map(({ href, label, icon: Icon }, i) => {
        const active = i === activeIndex;
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={cn(
              "press relative z-10 flex flex-1 flex-col items-center gap-1 rounded-full py-2.5 transition-colors duration-300",
              active ? "text-ink" : "text-ink3"
            )}
          >
            <Icon
              className="h-[19px] w-[19px] transition-all duration-300"
              style={active ? { color: "var(--brand)", filter: "drop-shadow(0 0 8px var(--brand-glow))" } : undefined}
            />
            <span
              className={cn(
                "h-1 w-1 rounded-full transition-all duration-300",
                active ? "bg-brand shadow-[0_0_8px_2px_var(--brand-glow)]" : "bg-transparent"
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
