"use client";

import { useEffect, type CSSProperties } from "react";
import { getGameDefinition } from "@/lib/games/registry";

const DEFAULT_DOCUMENT_TITLE = "Good Game — Nertz scoring";

export function GameTheme({ type, children }: { type: string; children: React.ReactNode }) {
  const def = getGameDefinition(type);

  useEffect(() => {
    document.title = def?.label ?? DEFAULT_DOCUMENT_TITLE;
    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE;
    };
  }, [def?.label]);

  useEffect(() => {
    const color = def?.theme.cssVars["--game-bg"] ?? "#17120f";
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    const previous = meta.getAttribute("content");
    meta.setAttribute("content", color);
    return () => {
      meta!.setAttribute("content", previous ?? "#17120f");
    };
  }, [def?.theme.cssVars]);

  const vars = (def?.theme.cssVars ?? {}) as CSSProperties;
  const attr = def?.theme.dataAttr ?? "nertz";
  return (
    <div
      data-game={attr}
      style={vars}
      className="game-shell flex min-h-dvh flex-col pb-[env(safe-area-inset-bottom,0px)]"
    >
      {children}
    </div>
  );
}
