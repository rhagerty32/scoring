"use client";

import type { CSSProperties } from "react";
import { getGameDefinition } from "@/lib/games/registry";

export function GameTheme({ type, children }: { type: string; children: React.ReactNode }) {
  const def = getGameDefinition(type);
  const vars = (def?.theme.cssVars ?? {}) as CSSProperties;
  const attr = def?.theme.dataAttr ?? "nertz";
  return (
    <div
      data-game={attr}
      style={vars}
      className="game-shell flex min-h-dvh flex-col pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">{children}</div>
    </div>
  );
}
