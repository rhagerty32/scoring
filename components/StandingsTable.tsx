"use client";

import type { PublicGamePayload } from "@/lib/server/gameState";

const PALETTE = ["#f97316", "#5eead4", "#fbbf24", "#fb7185", "#4ade80", "#38bdf8", "#fcd34d", "#f472b6"];

export function StandingsTable({ game }: { game: PublicGamePayload }) {
    const favoritePlayerId = game.favoritePlayerId;
    const rows = [...game.standings].sort((a, b) => b.cumulative - a.cumulative);
    const is2500 = game.type === "2500";

    return (
        <>
            {/* Mobile-first: readable cards, no horizontal scroll */}
            <ul className="space-y-3 md:hidden">
                {rows.map((r, idx) => {
                    const proj = game.projections.find((p) => p.playerId === r.playerId);
                    const pace =
                        proj?.estimatedRoundsRemaining == null ? "—" : `~${proj.estimatedRoundsRemaining} rounds to goal`;
                    const isFav = favoritePlayerId === r.playerId;
                    const color = PALETTE[idx % PALETTE.length]!;
                    return (
                        <li
                            key={r.playerId}
                            className="rounded-2xl border border-white/10 bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)]"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <span
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold text-[var(--game-bg)]"
                                        style={{ background: color }}
                                    >
                                        {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-[var(--game-text)]">{r.displayName}</p>
                                        {isFav ? (
                                            <p className="mt-1 text-xs font-medium text-[var(--game-accent-2)]">On pace</p>
                                        ) : null}
                                    </div>
                                </div>
                                <p className="shrink-0 font-mono text-2xl font-semibold tabular-nums text-[var(--game-text)]">
                                    {r.cumulative}
                                </p>
                            </div>
                            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
                                <div>
                                    <dt className="text-xs text-[var(--game-muted)]">Avg net / locked rnd</dt>
                                    <dd className="mt-0.5 font-mono tabular-nums text-[var(--game-text)]">
                                        {r.averagePerLockedRound.toFixed(2)}
                                    </dd>
                                </div>
                                {is2500 ? (
                                    <>
                                        <div>
                                            <dt className="text-xs text-[var(--game-muted)]">Min / max rnd</dt>
                                            <dd className="mt-0.5 font-mono tabular-nums text-[var(--game-text)]">
                                                {r.minNetRound ?? "—"} / {r.maxNetRound ?? "—"}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-[var(--game-muted)]">Wilds (rnd)</dt>
                                            <dd className="mt-0.5 font-mono tabular-nums text-[var(--game-text)]">{r.hundredTapEvents ?? 0}</dd>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <dt className="text-xs text-[var(--game-muted)]">Avg penalty / locked rnd</dt>
                                        <dd className="mt-0.5 font-mono tabular-nums text-[var(--game-text)]">
                                            {r.averagePenaltyPerLockedRound.toFixed(2)}
                                        </dd>
                                    </div>
                                )}
                                {!is2500 ? (
                                    <div>
                                        <dt className="text-xs text-[var(--game-muted)]">Avg points / locked rnd</dt>
                                        <dd className="mt-0.5 font-mono tabular-nums text-[var(--game-text)]">
                                            {r.averageRawScorePerLockedRound.toFixed(2)}
                                        </dd>
                                    </div>
                                ) : null}
                                <div>
                                    <dt className="text-xs text-[var(--game-muted)]">Est. rounds to goal</dt>
                                    <dd className="mt-0.5 text-[var(--game-muted)]">{pace}</dd>
                                </div>
                            </dl>
                        </li>
                    );
                })}
            </ul>

            {/* md+: compact table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-[var(--game-surface)] shadow-[var(--game-shadow)] md:block">
                <table className={`w-full text-left text-sm ${is2500 ? "min-w-[880px]" : "min-w-[720px]"}`}>
                    <thead className="text-[var(--game-muted)]">
                        <tr className="border-b border-white/10">
                            <th className="px-4 py-3 font-medium">#</th>
                            <th className="px-4 py-3 font-medium">Player</th>
                            <th className="px-4 py-3 text-right font-medium">Total</th>
                            <th className="px-4 py-3 text-right font-medium">Avg net</th>
                            {is2500 ? (
                                <>
                                    <th className="px-4 py-3 text-right font-medium">Min rnd</th>
                                    <th className="px-4 py-3 text-right font-medium">Max rnd</th>
                                    <th className="px-4 py-3 text-right font-medium">Wilds</th>
                                </>
                            ) : (
                                <>
                                    <th className="px-4 py-3 text-right font-medium">Avg penalty</th>
                                    <th className="px-4 py-3 text-right font-medium">Avg points</th>
                                </>
                            )}
                            <th className="px-4 py-3 text-right font-medium">To goal</th>
                        </tr>
                    </thead>
                    <tbody className="text-[var(--game-text)]">
                        {rows.map((r, idx) => {
                            const proj = game.projections.find((p) => p.playerId === r.playerId);
                            const pace =
                                proj?.estimatedRoundsRemaining == null
                                    ? "—"
                                    : `${proj.estimatedRoundsRemaining} rounds est.`;
                            const isFav = favoritePlayerId === r.playerId;
                            const color = PALETTE[idx % PALETTE.length]!;
                            return (
                                <tr key={r.playerId} className="border-b border-white/5 last:border-0">
                                    <td className="px-4 py-3 font-mono text-[var(--game-muted)]">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-2">
                                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                                            <span className="font-medium">{r.displayName}</span>
                                            {isFav ? (
                                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--game-accent-2)]">
                                                    On pace
                                                </span>
                                            ) : null}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono tabular-nums">{r.cumulative}</td>
                                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                                        {r.averagePerLockedRound.toFixed(2)}
                                    </td>
                                    {is2500 ? (
                                        <>
                                            <td className="px-4 py-3 text-right font-mono tabular-nums">{r.minNetRound ?? "—"}</td>
                                            <td className="px-4 py-3 text-right font-mono tabular-nums">{r.maxNetRound ?? "—"}</td>
                                            <td className="px-4 py-3 text-right font-mono tabular-nums">{r.hundredTapEvents ?? 0}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-4 py-3 text-right font-mono tabular-nums">
                                                {r.averagePenaltyPerLockedRound.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono tabular-nums">
                                                {r.averageRawScorePerLockedRound.toFixed(2)}
                                            </td>
                                        </>
                                    )}
                                    <td className="px-4 py-3 text-right text-xs text-[var(--game-muted)]">{pace}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
}
