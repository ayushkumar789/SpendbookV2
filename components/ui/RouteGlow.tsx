"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Linear-style atmospheric page-load glow: a soft blurred wash of light
 * blooms in and fades out on every route change (and first load).
 */
export function RouteGlow() {
  const pathname = usePathname();
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    setBurst((b) => b + 1);
  }, [pathname]);

  if (burst === 0) return null;
  return <div key={burst} className="route-glow" aria-hidden />;
}
