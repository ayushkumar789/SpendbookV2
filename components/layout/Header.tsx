"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/helpers";

interface HeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  actions?: ReactNode;
  /** Large editorial title on desktop; compact on mobile. */
  hero?: boolean;
}

export function Header({ title, subtitle, back = false, actions, hero = false }: HeaderProps) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40">
      <div className="glass-surface border-x-0 border-t-0">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8 md:py-4">
          {back ? (
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="press -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-sunken hover:text-ink"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                "truncate font-display tracking-tight text-ink",
                hero ? "text-2xl md:text-[28px]" : "text-xl md:text-2xl"
              )}
            >
              {title}
            </h1>
            {subtitle ? <p className="truncate text-xs text-ink3 md:text-[13px]">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {user ? <GlobalSearch /> : null}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
