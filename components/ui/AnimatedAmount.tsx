"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/helpers";

interface AnimatedAmountProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
  durationMs?: number;
}

/** Counts smoothly between values whenever `value` changes. */
export function AnimatedAmount({
  value,
  format = formatCurrency,
  className,
  durationMs = 650,
}: AnimatedAmountProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
