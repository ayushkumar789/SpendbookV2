"use client";

import { useEffect, useRef, useState } from "react";

const THRESHOLD = 78;

/**
 * Touch-driven pull-to-refresh for mobile. Attach the returned props to a
 * scroll container (or leave it on window) and render <PullIndicator/>.
 */
export function usePullToRefresh(onRefresh: () => Promise<void>): { pull: number; refreshing: boolean } {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent): void => {
      if (window.scrollY <= 0 && !refreshing) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };
    const onTouchMove = (e: TouchEvent): void => {
      if (!pulling.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
        setPull(Math.min(delta * 0.45, THRESHOLD * 1.4));
      }
    };
    const onTouchEnd = (): void => {
      if (!pulling.current) return;
      pulling.current = false;
      startY.current = null;
      setPull((current) => {
        if (current >= THRESHOLD) {
          setRefreshing(true);
          void onRefresh().finally(() => {
            setRefreshing(false);
            setPull(0);
          });
          return THRESHOLD;
        }
        return 0;
      });
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh, refreshing]);

  return { pull, refreshing };
}

export function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  if (pull <= 0 && !refreshing) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex justify-center md:hidden"
      style={{ transform: `translateY(${Math.min(pull, 90) - 24}px)`, opacity: Math.min(pull / 40, 1) }}
    >
      <span className="glass-surface flex h-10 w-10 items-center justify-center rounded-full shadow-nav">
        <span
          className="inline-block h-4.5 w-4.5 rounded-full border-2 border-line-strong border-t-brand"
          style={{
            width: 18,
            height: 18,
            transform: `rotate(${pull * 3}deg)`,
            animation: refreshing ? "spin 0.8s linear infinite" : undefined,
          }}
        />
      </span>
    </div>
  );
}
