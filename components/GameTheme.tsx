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
