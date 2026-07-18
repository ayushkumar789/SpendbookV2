"use client";

import { useEffect, type CSSProperties } from "react";

/** Backdrop truly fixed to the viewport — Android WebView scrolls the page
 *  under `position: fixed` elements unless the body itself is frozen, so use
 *  this together with useBodyScrollLock. */
export const OVERLAY_STYLE: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "rgba(0,0,0,0.8)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};

export const PANEL_STYLE: CSSProperties = {
  position: "relative",
  backgroundColor: "var(--card)",
  borderRadius: "16px",
  width: "100%",
  maxWidth: "500px",
  maxHeight: "80vh",
  overflowY: "auto",
  padding: "20px",
  margin: "auto",
};

let locks = 0;

/** Freezes the page behind an overlay while `open` is true. Counted, so
 *  stacked overlays (e.g. a ConfirmDialog above a modal) unlock correctly. */
export function useBodyScrollLock(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    locks += 1;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
      }
    };
  }, [open]);
}
