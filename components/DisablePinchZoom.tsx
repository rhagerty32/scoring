"use client";

import { useEffect } from "react";

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, label, option, [role='button'], [role='link'], [role='textbox'], [role='menuitem'], [contenteditable='true']",
    ),
  );
}

/**
 * iOS Safari often ignores viewport user-scalable/maximum-scale.
 * - WebKit gesture events: block pinch-zoom.
 * - Same-spot touchend pair: Safari can still double-tap-zoom on non-interactive
 *   areas even when touch-action is set; avoid blocking rapid taps on controls.
 * - dblclick: some engines map double-tap to double-click zoom.
 */
export function DisablePinchZoom() {
  useEffect(() => {
    const blockGesture = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener("gesturestart", blockGesture, { passive: false });
    document.addEventListener("gesturechange", blockGesture, { passive: false });
    document.addEventListener("gestureend", blockGesture, { passive: false });

    let lastEnd = { at: 0, x: 0, y: 0 };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0]!;
      const now = Date.now();
      const dt = now - lastEnd.at;
      const dx = t.clientX - lastEnd.x;
      const dy = t.clientY - lastEnd.y;
      lastEnd = { at: now, x: t.clientX, y: t.clientY };
      if (isInteractiveTarget(e.target)) return;
      if (dt < 420 && Math.hypot(dx, dy) < 56) {
        e.preventDefault();
      }
    };
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });

    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("dblclick", onDblClick, { capture: true, passive: false });

    return () => {
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("gestureend", blockGesture);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("dblclick", onDblClick, true);
    };
  }, []);
  return null;
}
