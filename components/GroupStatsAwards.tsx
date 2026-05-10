"use client";

import type { PublicGamePayload } from "@/lib/server/gameState";

export function GroupStatsAwards({ game }: { game: PublicGamePayload }) {
  const numLocked = game.rounds.filter((r) => r.lockedAt != null).length;
  const nameById = new Map(game.players.map((p) => [p.id, p.displayName]));

  if (numLocked === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)] sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--game-muted)] sm:text-sm">
          Group awards
        </h2>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-[var(--game-muted)] sm:text-xs">
          Silly superlatives unlock after the first locked round.
        </p>
      </div>
    );
  }

  if (game.groupAwards.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)] sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--game-muted)] sm:text-sm">
          Group awards
        </h2>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-[var(--game-muted)] sm:text-xs">
          Everyone is statistically indistinguishable. Suspicious.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)] sm:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--game-muted)] sm:text-sm">
        Group awards
      </h2>
      <ul className="mt-4 space-y-4">
        {game.groupAwards.map((a) => {
          const names = a.playerIds.map((id) => nameById.get(id) ?? id).join(" · ");
          return (
            <li
              key={a.id}
              className="border-b border-white/5 pb-4 last:border-0 last:pb-0"
            >
              <p className="font-semibold text-[var(--game-accent)] sm:text-sm">{a.title}</p>
              <p className="mt-1 text-sm text-[var(--game-text)] sm:text-xs">{names}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
