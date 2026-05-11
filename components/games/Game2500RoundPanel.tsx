"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useCallback } from "react";
import { applyRankToggle, RANKS_2500, type ScoreTapMeta } from "@/lib/games/game2500";
import { playerColorMap } from "@/lib/client/playerColors";
import { readHostToken } from "@/lib/client/storage";
import type { PublicGamePayload, PublicRound, PublicRoundScore } from "@/lib/server/gameState";

const BTN_PRIMARY =
    "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent)] px-4 text-base font-semibold text-black active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

const BTN_CYAN =
    "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent-2)] px-4 text-base font-semibold text-black active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

const BTN_GHOST =
    "flex min-h-12 touch-manipulation items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-4 text-base font-medium text-[var(--game-text)] active:bg-white/10 disabled:pointer-events-none disabled:opacity-45";

const CALC_BTN =
    "flex min-h-[20vh] touch-manipulation items-center justify-center rounded-2xl border-2 border-white/15 bg-[var(--game-surface-2)] text-2xl font-bold text-[var(--game-text)] active:bg-white/10 sm:text-3xl";

const emptyTaps: ScoreTapMeta = { p5: 0, m5: 0, p10: 0, m10: 0, p100: 0, m100: 0 };

type TapeEntry = { delta: number; key: keyof ScoreTapMeta; label: string };

type PlayStatePatch =
    | { kind: "wild"; wildRank: string | null }
    | { kind: "rank"; rank: string; turnOn: boolean };

type PlayStateCtx = { previous?: PublicGamePayload; key?: string };

function pendingPlayKey(patch: PlayStatePatch): string {
    if (patch.kind === "wild") return patch.wildRank == null ? "w:clear" : `w:${patch.wildRank}`;
    return `r:${patch.rank}`;
}

function patchCurrentOpenRound(game: PublicGamePayload, update: (round: PublicRound) => PublicRound): PublicGamePayload {
    return {
        ...game,
        rounds: game.rounds.map((r) => {
            if (r.number !== game.currentRound || r.lockedAt != null) return r;
            return update(r);
        }),
    };
}

export function Game2500RoundPanel({
    game,
    stored,
    code,
    onSaved,
}: {
    game: PublicGamePayload;
    stored: { playerId: string; playerToken: string };
    code: string;
    onSaved: () => void;
}) {
    const qc = useQueryClient();
    const queryKey = ["game", code] as const;

    const current = game.rounds.find((r) => r.number === game.currentRound && r.lockedAt == null);
    const phase = current?.playPhase ?? "scoring";
    const colors = useMemo(() => playerColorMap(game.players.map((p) => p.id)), [game.players]);

    const [pendingPlayKeys, setPendingPlayKeys] = useState(() => new Set<string>());

    const playStateMutation = useMutation<void, Error, PlayStatePatch, PlayStateCtx>({
        mutationFn: async (patch: PlayStatePatch) => {
            const snap = qc.getQueryData<PublicGamePayload>(queryKey);
            if (patch.kind === "rank" && snap) {
                const open = snap.rounds.find((r) => r.number === snap.currentRound && r.lockedAt == null);
                if (open) {
                    const check = applyRankToggle({ ...open.rankClaims }, patch.rank, stored.playerId, patch.turnOn);
                    if (!check.ok) throw new Error(check.error);
                }
            }
            const body =
                patch.kind === "wild"
                    ? { action: "wild" as const, wildRank: patch.wildRank }
                    : { action: "rank" as const, rank: patch.rank, turnOn: patch.turnOn };
            const res = await fetch(`/api/games/${encodeURIComponent(code)}/round/play-state`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "content-type": "application/json",
                    "x-player-token": stored.playerToken,
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? "Update failed");
            }
        },
        onMutate: async (patch): Promise<PlayStateCtx> => {
            await qc.cancelQueries({ queryKey });
            const previous = qc.getQueryData<PublicGamePayload>(queryKey);
            if (!previous) return { previous: undefined };

            if (patch.kind === "wild") {
                const key = pendingPlayKey(patch);
                setPendingPlayKeys((s) => new Set(s).add(key));
                qc.setQueryData<PublicGamePayload>(queryKey, (g) =>
                    g ? patchCurrentOpenRound(g, (r) => ({ ...r, wildRank: patch.wildRank })) : g,
                );
                return { previous, key };
            }
            const open = previous.rounds.find((r) => r.number === previous.currentRound && r.lockedAt == null);
            if (!open) return { previous };
            const next = applyRankToggle({ ...open.rankClaims }, patch.rank, stored.playerId, patch.turnOn);
            if (!next.ok) return { previous };
            const key = pendingPlayKey(patch);
            setPendingPlayKeys((s) => new Set(s).add(key));
            qc.setQueryData<PublicGamePayload>(queryKey, (g) =>
                g ? patchCurrentOpenRound(g, (r) => ({ ...r, rankClaims: next.claims })) : g,
            );
            return { previous, key };
        },
        onError: (err, _patch, ctx) => {
            if (ctx?.key) {
                setPendingPlayKeys((s) => {
                    const n = new Set(s);
                    n.delete(ctx.key!);
                    return n;
                });
            }
            if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
            alert(err instanceof Error ? err.message : "Update failed");
        },
        onSettled: (_d, _e, _patch, ctx) => {
            if (ctx?.key) {
                setPendingPlayKeys((s) => {
                    const n = new Set(s);
                    n.delete(ctx.key!);
                    return n;
                });
            }
            void qc.invalidateQueries({ queryKey });
        },
    });

    const endRoundMutation = useMutation({
        mutationFn: async () => {
            const host = readHostToken(code);
            if (!host) throw new Error("Missing host session");
            const res = await fetch(`/api/games/${encodeURIComponent(code)}/round/end-playing`, {
                method: "POST",
                credentials: "include",
                headers: { "x-host-token": host },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? "Could not end round");
            }
        },
        onMutate: async () => {
            await qc.cancelQueries({ queryKey });
            const previous = qc.getQueryData<PublicGamePayload>(queryKey);
            if (!previous) return { previous: undefined as PublicGamePayload | undefined };
            qc.setQueryData<PublicGamePayload>(queryKey, (g) =>
                g
                    ? patchCurrentOpenRound(g, (r) => ({
                        ...r,
                        playPhase: "scoring",
                        wildRank: null,
                    }))
                    : g,
            );
            return { previous };
        },
        onError: (err, _v, ctx) => {
            if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
            alert(err instanceof Error ? err.message : "Could not end round");
        },
        onSettled: () => {
            void qc.invalidateQueries({ queryKey });
        },
    });

    const endBusy = endRoundMutation.isPending;

    const wildButtonPending = (target: string | null) =>
        pendingPlayKeys.has(target === null ? "w:clear" : `w:${target}`);
    const rankButtonPending = (rank: string) => pendingPlayKeys.has(`r:${rank}`);

    if (!current) {
        return <p className="mt-3 text-sm text-[var(--game-muted)]">Updating round…</p>;
    }

    return (
        <div className="mt-4 flex flex-col gap-5">
            {phase === "playing" ? (
                <>
                    <WildSection
                        wildRank={current.wildRank}
                        wildButtonPending={wildButtonPending}
                        onPick={(rank) => playStateMutation.mutate({ kind: "wild", wildRank: rank })}
                    />
                    <RankTrackerPlaying
                        rankClaims={current.rankClaims}
                        colors={colors}
                        youId={stored.playerId}
                        rankButtonPending={rankButtonPending}
                        onToggle={(rank, turnOn) => playStateMutation.mutate({ kind: "rank", rank, turnOn })}
                    />
                    {game.youAreHost ? (
                        <button
                            type="button"
                            className={BTN_CYAN}
                            disabled={endBusy}
                            onClick={() => endRoundMutation.mutate()}
                        >
                            {endBusy ? "Ending round…" : "End round (start scoring)"}
                        </button>
                    ) : (
                        <p className="text-center text-xs text-[var(--game-muted)]">Waiting for the host to end the round…</p>
                    )}
                </>
            ) : null}

            {phase === "scoring" ? (
                <>
                    <RankTrackerFrozen rankClaims={current.rankClaims} colors={colors} />
                    <Game2500ScoringForm
                        key={`${current.id}-${stored.playerId}`}
                        code={code}
                        stored={stored}
                        mine={current.scores.find((s) => s.playerId === stored.playerId)}
                        onSaved={onSaved}
                    />
                </>
            ) : null}
        </div>
    );
}

function WildSection({
    wildRank,
    wildButtonPending,
    onPick,
}: {
    wildRank: string | null;
    wildButtonPending: (target: string | null) => boolean;
    onPick: (rank: string | null) => void;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--game-muted)]">Wild card (this round)</p>
            <p className="mt-2 text-sm text-[var(--game-muted)]">
                {wildRank ? (
                    <>
                        Current wild: <span className="font-mono text-lg font-bold text-[var(--game-accent)]">{wildRank}</span>
                    </>
                ) : (
                    "Not set yet — pick the wild for this round."
                )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    className={`${BTN_GHOST} min-h-10 px-3 py-2 text-sm`}
                    disabled={wildButtonPending(null)}
                    onClick={() => onPick(null)}
                >
                    Clear
                </button>
                {RANKS_2500.map((r) => (
                    <button
                        key={r}
                        type="button"
                        disabled={wildButtonPending(r)}
                        className={`min-h-10 min-w-10 rounded-xl border px-2 py-2 font-mono text-sm ${wildRank === r
                            ? "border-[var(--game-accent)] bg-[var(--game-accent)]/25 text-[var(--game-text)]"
                            : "border-white/15 bg-black/25 text-[var(--game-muted)]"
                            }`}
                        onClick={() => onPick(r)}
                    >
                        {r}
                    </button>
                ))}
            </div>
        </div>
    );
}

function RankTrackerPlaying({
    rankClaims,
    colors,
    youId,
    rankButtonPending,
    onToggle,
}: {
    rankClaims: Record<string, string>;
    colors: Map<string, string>;
    youId: string;
    rankButtonPending: (rank: string) => boolean;
    onToggle: (rank: string, turnOn: boolean) => void;
}) {
    return (
        <details className="rounded-2xl border border-white/10 bg-black/20 p-4" open>
            <summary className="cursor-pointer text-sm font-semibold text-[var(--game-text)]">Cards played (tap to track)</summary>
            <p className="mt-2 text-xs text-[var(--game-muted)]">
                Turn a rank on when your group lays that rank down. Only you can turn off a card you marked.
            </p>
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {RANKS_2500.map((rank) => {
                    const owner = rankClaims[rank];
                    const on = Boolean(owner);
                    const border = on ? colors.get(owner!) ?? "var(--game-accent)" : "transparent";
                    const canOff = on && owner === youId;
                    const pending = rankButtonPending(rank);
                    return (
                        <li key={rank}>
                            <button
                                type="button"
                                className="flex min-h-14 w-full flex-col items-center justify-center rounded-xl border-2 bg-[var(--game-surface-2)] px-2 py-2 text-sm font-semibold transition disabled:opacity-45"
                                style={{ borderColor: border }}
                                onClick={() => {
                                    if (!on) onToggle(rank, true);
                                    else if (canOff) onToggle(rank, false);
                                }}
                                disabled={pending || (on && !canOff)}
                            >
                                <span className="font-mono text-base">{rank}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </details>
    );
}

function RankTrackerFrozen({
    rankClaims,
    colors,
}: {
    rankClaims: Record<string, string>;
    colors: Map<string, string>;
}) {
    const played = RANKS_2500.filter((rank) => Boolean(rankClaims[rank]));
    return (
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4 opacity-95">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--game-muted)]">Cards played (frozen)</p>
            {played.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--game-muted)]">No ranks were marked during play.</p>
            ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                    {played.map((rank) => {
                        const owner = rankClaims[rank]!;
                        const border = colors.get(owner) ?? "var(--game-accent)";
                        return (
                            <li
                                key={rank}
                                className="rounded-lg border-2 px-3 py-1.5 font-mono text-sm"
                                style={{ borderColor: border }}
                            >
                                {rank}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function Game2500ScoringForm({
    code,
    stored,
    mine,
    onSaved,
}: {
    code: string;
    stored: { playerId: string; playerToken: string };
    mine: PublicRoundScore | undefined;
    onSaved: () => void;
}) {
    const [tape, setTape] = useState<TapeEntry[]>([]);
    const [saving, setSaving] = useState(false);

    const tapsBase = useMemo<ScoreTapMeta>(
        () => (mine?.scoreMeta ? { ...emptyTaps, ...mine.scoreMeta } : { ...emptyTaps }),
        [mine?.scoreMeta],
    );

    const baselineTotal = mine?.total ?? 0;
    const draft = useMemo(
        () => baselineTotal + tape.reduce((sum, e) => sum + e.delta, 0),
        [baselineTotal, tape],
    );
    const taps = useMemo(() => {
        const t: ScoreTapMeta = { ...tapsBase };
        for (const e of tape) t[e.key] += 1;
        return t;
    }, [tapsBase, tape]);

    const applyDelta = useCallback((delta: number, key: keyof ScoreTapMeta, label: string) => {
        setTape((prev) => [...prev, { delta, key, label }]);
    }, []);

    const undoLastTap = useCallback(() => {
        setTape((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
    }, []);

    const finish = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/games/${encodeURIComponent(code)}/scores`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "content-type": "application/json",
                    "x-player-token": stored.playerToken,
                },
                body: JSON.stringify({
                    playerId: stored.playerId,
                    score: draft,
                    penalty: 0,
                    bonus: 0,
                    scoreMeta: taps,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert((err as { error?: string }).error ?? "Could not save");
                return;
            }
            onSaved();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs font-medium text-[var(--game-muted)]">Round net (this entry)</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="min-w-0 font-mono text-4xl font-bold tabular-nums text-[var(--game-text)]">{draft}</p>
                    <button
                        type="button"
                        className="shrink-0 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-[var(--game-text)] touch-manipulation active:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                        disabled={tape.length === 0}
                        onClick={undoLastTap}
                    >
                        Undo
                    </button>
                </div>
                <p className="mt-2 max-h-16 overflow-y-auto font-mono text-[0.65rem] leading-relaxed text-[var(--game-muted)]">
                    {tape.length === 0
                        ? "Tap the big buttons to add up melds and hand penalties."
                        : tape.map((e) => e.label).join(" ")}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button type="button" className={`${CALC_BTN} text-rose-300`} onClick={() => applyDelta(-5, "m5", "−5")}>
                    −5
                </button>
                <button type="button" className={`${CALC_BTN} text-emerald-300`} onClick={() => applyDelta(5, "p5", "+5")}>
                    +5
                </button>
                <button type="button" className={`${CALC_BTN} text-rose-300`} onClick={() => applyDelta(-10, "m10", "−10")}>
                    −10
                </button>
                <button type="button" className={`${CALC_BTN} text-emerald-300`} onClick={() => applyDelta(10, "p10", "+10")}>
                    +10
                </button>
                <button type="button" className={`${CALC_BTN} text-rose-300`} onClick={() => applyDelta(-100, "m100", "−100")}>
                    −100
                </button>
                <button type="button" className={`${CALC_BTN} text-emerald-300`} onClick={() => applyDelta(100, "p100", "+100")}>
                    +100
                </button>
            </div>

            <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void finish()}>
                {saving ? "Saving…" : mine ? "Update round score" : "Finish round"}
            </button>
        </div>
    );
}
