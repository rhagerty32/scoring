"use client";

import type { PublicGamePayload } from "@/lib/server/gameState";

export function YourStatsCard({ game, playerId }: { game: PublicGamePayload; playerId: string }) {
    const row = game.standings.find((s) => s.playerId === playerId);
    const numLocked = game.rounds.filter((r) => r.lockedAt != null).length;
    const name = game.players.find((p) => p.id === playerId)?.displayName ?? "You";

    if (!row) return null;

    const target = Math.max(1, game.targetScore);
    const progress = Math.min(1, row.cumulative / target);

    return (
        <div className="rounded-2xl border border-white/10 bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)] sm:rounded-[var(--game-radius)] sm:p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--game-muted)] sm:text-sm">Your stats</h3>
            <p className="mt-2 truncate text-lg font-semibold text-[var(--game-text)] sm:text-base">{name}</p>

            {numLocked === 0 ? (
                <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--game-muted)] sm:text-xs">
                    Stats appear after the first round is locked.
                </p>
            ) : (
                <>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:text-xs">
                        <div>
                            <dt className="text-[var(--game-muted)]">Total score</dt>
                            <dd className="mt-0.5 font-mono tabular-nums text-lg font-semibold text-[var(--game-text)] sm:text-base">
                                {row.cumulative}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[var(--game-muted)]">Goal</dt>
                            <dd className="mt-0.5 font-mono tabular-nums text-[var(--game-text)]">{game.targetScore}</dd>
                        </div>
                        <div>
                            <dt className="text-[var(--game-muted)]">Avg net / locked rnd</dt>
                            <dd className="mt-0.5 font-mono tabular-nums text-[var(--game-text)]">{row.averagePerLockedRound.toFixed(2)}</dd>
                        </div>
                        {game.type === "2500" ? (
                            <>
                                <div>
                                    <dt className="text-[var(--game-muted)]">Min / max rnd</dt>
                                    <dd className="mt-0.5 font-mono tabular-nums text-[var(--game-text)]">
                                        {row.minNetRound ?? "—"} / {row.maxNetRound ?? "—"}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[var(--game-muted)]">Wilds</dt>
                                    <dd className="mt-0.5 font-mono tabular-nums text-[var(--game-text)]">{row.hundredTapEvents ?? 0}</dd>
                                </div>
                            </>
                        ) : (
                            <div>
                                <dt className="text-[var(--game-muted)]">Avg penalty / locked rnd</dt>
                                <dd className="mt-0.5 font-mono tabular-nums text-[var(--game-text)]">{row.averagePenaltyPerLockedRound.toFixed(2)}</dd>
                            </div>
                        )}
                    </dl>
                    <div className="mt-4">
                        <div className="flex items-center justify-between gap-2 text-xs text-[var(--game-muted)] sm:text-[0.65rem]">
                            <span>Progress to goal</span>
                            <span className="shrink-0 font-mono tabular-nums text-[var(--game-text)]">
                                {Math.round(progress * 100)}%
                            </span>
                        </div>
                        <div
                            className="mt-2 h-2 overflow-hidden rounded-full bg-black/30"
                            role="progressbar"
                            aria-valuenow={Math.round(progress * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Progress toward target score"
                        >
                            <div
                                className="h-full rounded-full bg-[var(--game-accent)] transition-[width]"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
