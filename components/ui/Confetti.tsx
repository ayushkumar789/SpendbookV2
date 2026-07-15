"use client";

import { useMemo } from "react";

const COLORS = ["#D6F62F", "#4BDFA4", "#FF8672", "#28A4C4", "#9D64C8", "#F5C044"];

/** A lightweight CSS confetti burst — mount it to fire once. */
export function Confetti({ seed = 1, count = 42 }: { seed?: number; count?: number }) {
  const pieces = useMemo(() => {
    // deterministic pseudo-random so SSR/CSR agree
    let s = seed * 9301 + 49297;
    const rand = (): number => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return Array.from({ length: count }, (_, i) => {
      const angle = rand() * Math.PI * 2;
      const dist = 70 + rand() * 150;
      return {
        id: i,
        x: `${Math.cos(angle) * dist}px`,
        y: `${Math.sin(angle) * dist - 60}px`,
        r: `${(rand() - 0.5) * 720}deg`,
        delay: `${rand() * 0.18}s`,
        color: COLORS[i % COLORS.length],
      };
    });
  }, [seed, count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              background: p.color,
              "--cf-x": p.x,
              "--cf-y": p.y,
              "--cf-r": p.r,
              "--cf-delay": p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
