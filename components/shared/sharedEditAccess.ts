"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveShareAccess } from "@/lib/features/sharing";
import { useAuth } from "@/hooks/useAuth";
import type { SharedBookAccess } from "@/types/features";

/** Guard for the shared add/edit transaction pages: requires a signed-in
 *  user and a valid, active Edit-level share. Anything else bounces back to
 *  /shared/[shareId], which renders the right screen (sign-in gate, paused,
 *  or gone). */
export function useSharedEditAccess(shareId: string): {
  access: SharedBookAccess | null;
  ready: boolean;
} {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<SharedBookAccess | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/shared/${shareId}`);
      return;
    }
    let cancelled = false;
    resolveShareAccess(shareId)
      .then((a) => {
        if (cancelled) return;
        if (!a || a.access_level !== "edit") {
          router.replace(`/shared/${shareId}`);
          return;
        }
        setAccess(a);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace(`/shared/${shareId}`);
      });
    return () => {
      cancelled = true;
    };
  }, [shareId, user, authLoading, router]);

  return { access, ready };
}
