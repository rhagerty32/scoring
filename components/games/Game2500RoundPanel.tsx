"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useCallback, useEffect } from "react";
import { applyRankToggle, applyWentOutToggle, RANKS_2500, WENT_OUT_BONUS, type ScoreTapMeta } from "@/lib/games/game2500";
import { playerColorMapFromStandings } from "@/lib/client/playerColors";
import { readHostToken } from "@/lib/client/storage";

const WILD_OVERLAY =
    "fixed inset-0 z-[100] flex flex-col bg-[var(--game-bg)] px-[max(1rem,env(safe-area-inset-left))] py-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))]";
import type { PublicGamePayload, PublicRound, PublicRoundScore } from "@/lib/server/gameState";

const BTN_PRIMARY =
    "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent)] px-4 text-base font-semibold text-[var(--game-on-accent)] active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

const BTN_CYAN =
    "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent-2)] px-4 text-base font-semibold text-[var(--game-on-accent-2)] active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

const BTN_GHOST =
    "flex min-h-12 touch-manipulation items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-4 text-base font-medium text-[var(--game-text)] active:bg-white/10 disabled:pointer-events-none disabled:opacity-45";

const CALC_BTN =
    "flex min-h-[20vh] touch-manipulation items-center justify-center rounded-2xl border-2 border-white/15 bg-[var(--game-surface-2)] text-2xl font-bold text-[var(--game-text)] active:bg-white/10 sm:text-3xl";

const emptyTaps: ScoreTapMeta = { p5: 0, m5: 0, p10: 0, m10: 0, p100: 0, m100: 0 };

type TapeEntry = { delta: number; key: keyof ScoreTapMeta; label: string };

type PlayStatePatch =
    | { kind: "wild"; wildRank: string | null }
    | { kind: "rank"; rank: string; turnOn: boolean }
    | { kind: "wentOut"; turnOn: boolean };

type PlayStateCtx = { previous?: PublicGamePayload; key?: string };

function pendingPlayKey(patch: PlayStatePatch): string {
    if (patch.kind === "wild") return patch.wildRank == null ? "w:clear" : `w:${patch.wildRank}`;
    if (patch.kind === "wentOut") return patch.turnOn ? "wo:on" : "wo:off";
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
    const showPlayedCards = game.showPlayedCards;
    const colors = useMemo(() => playerColorMapFromStandings(game.standings), [game.standings]);

    const [pendingPlayKeys, setPendingPlayKeys] = useState(() => new Set<string>());
    const [editingWild, setEditingWild] = useState(false);

    const youAreHost = game.youAreHost;
    const wildRank = current?.wildRank ?? null;
    const wildUnset = wildRank == null;
    const showWildPicker = phase === "playing" && youAreHost && (wildUnset || editingWild);
    const showWildWaiting = phase === "playing" && !youAreHost && wildUnset;

    useEffect(() => {
        if (wildUnset) setEditingWild(false);
    }, [wildUnset, game.currentRound]);

    const playStateMutation = useMutation<void, Error, PlayStatePatch, PlayStateCtx>({
        mutationFn: async (patch: PlayStatePatch) => {
            const snap = qc.getQueryData<PublicGamePayload>(queryKey);
            if (snap) {
                const open = snap.rounds.find((r) => r.number === snap.currentRound && r.lockedAt == null);
                if (open) {
                    if (patch.kind === "rank") {
                        const check = applyRankToggle({ ...open.rankClaims }, patch.rank, stored.playerId, patch.turnOn);
                        if (!check.ok) throw new Error(check.error);
                    }
                    if (patch.kind === "wentOut") {
                        const check = applyWentOutToggle(open.wentOutPlayerId, stored.playerId, patch.turnOn);
                        if (!check.ok) throw new Error(check.error);
                    }
                }
            }
            const body =
                patch.kind === "wild"
                    ? { action: "wild" as const, wildRank: patch.wildRank }
                    : patch.kind === "wentOut"
                        ? { action: "wentOut" as const, turnOn: patch.turnOn }
                        : { action: "rank" as const, rank: patch.rank, turnOn: patch.turnOn };
            const headers: Record<string, string> = {
                "content-type": "application/json",
                "x-player-token": stored.playerToken,
            };
            if (patch.kind === "wild") {
                const host = readHostToken(code);
                if (!host) throw new Error("Host session required to set the wild card");
                headers["x-host-token"] = host;
            }
            const res = await fetch(`/api/games/${encodeURIComponent(code)}/round/play-state`, {
                method: "PATCH",
                credentials: "include",
                headers,
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
            if (patch.kind === "wentOut") {
                const open = previous.rounds.find((r) => r.number === previous.currentRound && r.lockedAt == null);
                if (!open) return { previous };
                const next = applyWentOutToggle(open.wentOutPlayerId, stored.playerId, patch.turnOn);
                if (!next.ok) return { previous };
                const key = pendingPlayKey(patch);
                setPendingPlayKeys((s) => new Set(s).add(key));
                qc.setQueryData<PublicGamePayload>(queryKey, (g) =>
                    g ? patchCurrentOpenRound(g, (r) => ({ ...r, wentOutPlayerId: next.wentOutPlayerId })) : g,
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

    const finalizeRoundMutation = useMutation({
        mutationFn: async () => {
            const host = readHostToken(code);
            if (!host) throw new Error("Missing host session");
            const res = await fetch(`/api/games/${encodeURIComponent(code)}/finalize`, {
                method: "POST",
                credentials: "include",
                headers: { "x-host-token": host },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? "Could not lock round");
            }
        },
        onSettled: () => {
            void qc.invalidateQueries({ queryKey });
            onSaved();
        },
        onError: (err) => {
            alert(err instanceof Error ? err.message : "Could not lock round");
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
    const finalizeBusy = finalizeRoundMutation.isPending;
    const roundScoresComplete = game.currentRoundComplete;
    const gameEndsOnLock = game.standings.some((s) => s.cumulative >= game.targetScore);

    const wildButtonPending = (target: string | null) =>
        pendingPlayKeys.has(target === null ? "w:clear" : `w:${target}`);
    const rankButtonPending = (rank: string) => pendingPlayKeys.has(`r:${rank}`);

    if (!current) {
        return <p className="mt-3 text-sm text-[var(--game-muted)]">Updating round…</p>;
    }

    const pickWild = (rank: string) => {
        playStateMutation.mutate(
            { kind: "wild", wildRank: rank },
            { onSuccess: () => setEditingWild(false) },
        );
    };

    return (
        <div className="mt-4 flex flex-col gap-5">
            {showWildWaiting ? <WildWaitingOverlay /> : null}
            {showWildPicker ? (
                <WildPickerOverlay
                    wildRank={wildRank}
                    wildButtonPending={wildButtonPending}
                    editing={editingWild}
                    onPick={pickWild}
                    onCancel={() => setEditingWild(false)}
                />
            ) : null}

            {phase === "playing" && !wildUnset && !showWildPicker ? (
                <>
                    <WildCardDisplay
                        wildRank={wildRank!}
                        youAreHost={youAreHost}
                        onEdit={() => setEditingWild(true)}
                    />
                    {showPlayedCards ? (
                        <RankTrackerPlaying
                            rankClaims={current.rankClaims}
                            colors={colors}
                            youId={stored.playerId}
                            rankButtonPending={rankButtonPending}
                            onToggle={(rank, turnOn) => playStateMutation.mutate({ kind: "rank", rank, turnOn })}
                        />
                    ) : null}
                    {youAreHost ? (
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
                    {showPlayedCards ? (
                        <RankTrackerFrozen rankClaims={current.rankClaims} colors={colors} />
                    ) : null}
                    <Game2500ScoringForm
                        key={`${current.id}-${stored.playerId}-${current.wentOutPlayerId ?? "none"}`}
                        code={code}
                        stored={stored}
                        wentOutPlayerId={current.wentOutPlayerId}
                        players={game.players}
                        wentOutPending={pendingPlayKeys.has("wo:on") || pendingPlayKeys.has("wo:off")}
                        onWentOutToggle={(turnOn) => playStateMutation.mutate({ kind: "wentOut", turnOn })}
                        mine={current.scores.find((s) => s.playerId === stored.playerId)}
                        onSaved={onSaved}
                    />
                    {youAreHost ? (
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                className={BTN_CYAN}
                                disabled={finalizeBusy || !roundScoresComplete}
                                onClick={() => finalizeRoundMutation.mutate()}
                            >
                                {finalizeBusy
                                    ? "Locking round…"
                                    : gameEndsOnLock
                                      ? "End game"
                                      : "Next round"}
                            </button>
                            {!roundScoresComplete ? (
                                <p className="text-center text-xs text-[var(--game-muted)]">
                                    Waiting for every player to submit before you can lock the round.
                                </p>
                            ) : (
                                <p className="text-center text-xs text-[var(--game-muted)]">
                                    Players can still edit scores until you lock the round.
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-center text-xs text-[var(--game-muted)]">
                            {roundScoresComplete
                                ? "Waiting for the host to start the next round. You can still edit your score above."
                                : "Enter your score above. You can change it until the host locks the round."}
                        </p>
                    )}
                </>
            ) : null}
        </div>
    );
}

function WildWaitingOverlay() {
    return (
        <div className={WILD_OVERLAY} role="status" aria-live="polite">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--game-muted)]">Round starting</p>
                <p className="mt-4 max-w-xs text-pretty text-lg leading-relaxed text-[var(--game-text)]">
                    Waiting for the host to choose the wild card…
                </p>
            </div>
        </div>
    );
}

function WildPickerOverlay({
    wildRank,
    wildButtonPending,
    editing,
    onPick,
    onCancel,
}: {
    wildRank: string | null;
    wildButtonPending: (rank: string) => boolean;
    editing: boolean;
    onPick: (rank: string) => void;
    onCancel: () => void;
}) {
    return (
        <div className={WILD_OVERLAY}>
            <div className="flex flex-1 flex-col justify-center">
                <header className="text-center">
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--game-muted)]">Wild card</p>
                    <h2 className="mt-2 text-balance text-2xl font-semibold text-[var(--game-text)]">
                        {editing ? "Choose a new wild" : "Which card is wild?"}
                    </h2>
                    <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-[var(--game-muted)]">
                        Tap the card rank that is wild for everyone this round.
                    </p>
                </header>
                <ul className="mx-auto mt-10 grid w-full max-w-md grid-cols-4 gap-2 sm:grid-cols-4 sm:gap-3">
                    {RANKS_2500.map((r) => {
                        const selected = wildRank === r;
                        const pending = wildButtonPending(r);
                        return (
                            <li key={r}>
                                <button
                                    type="button"
                                    disabled={pending}
                                    className={`flex min-h-[4.5rem] w-full touch-manipulation items-center justify-center rounded-2xl border-2 font-mono text-2xl font-bold transition active:scale-[0.98] disabled:opacity-45 sm:min-h-20 sm:text-3xl ${selected
                                        ? "border-[var(--game-accent)] bg-[var(--game-accent)]/20 text-[var(--game-text)] shadow-[0_0_24px_var(--game-accent)]/15"
                                        : "border-white/15 bg-[var(--game-surface)] text-[var(--game-text)]"
                                        }`}
                                    onClick={() => onPick(r)}
                                >
                                    {r}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
            {editing ? (
                <button type="button" className={`${BTN_GHOST} mb-2 w-full`} onClick={onCancel}>
                    Cancel
                </button>
            ) : null}
        </div>
    );
}

function WildCardDisplay({
    wildRank,
    youAreHost,
    onEdit,
}: {
    wildRank: string;
    youAreHost: boolean;
    onEdit?: () => void;
}) {
    return (
        <div className="flex flex-col items-center rounded-2xl border border-[var(--game-accent)]/20 bg-black/30 px-4 py-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--game-muted)]">Wild card</p>
            <p
                className="mt-3 flex min-h-[5.5rem] min-w-[4.5rem] items-center justify-center rounded-2xl border-2 border-[var(--game-accent)]/40 bg-[var(--game-accent)]/10 px-6 font-mono text-5xl font-bold tabular-nums text-[var(--game-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:text-6xl"
                aria-label={`Wild rank ${wildRank}`}
            >
                {wildRank}
            </p>
            <p className="mt-3 max-w-xs text-pretty text-sm leading-relaxed text-[var(--game-muted)]">
                All cards of this rank are wild this round.
            </p>
            {youAreHost && onEdit ? (
                <button
                    type="button"
                    className="mt-4 text-sm font-medium text-[var(--game-accent-2)] underline underline-offset-4 touch-manipulation"
                    onClick={onEdit}
                >
                    Change wild card
                </button>
            ) : null}
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

function WentOutRow({
    wentOutPlayerId,
    youId,
    players,
    wentOutPending,
    onToggle,
}: {
    wentOutPlayerId: string | null;
    youId: string;
    players: PublicGamePayload["players"];
    wentOutPending: boolean;
    onToggle: (turnOn: boolean) => void;
}) {
    const youWentOut = wentOutPlayerId === youId;
    const someoneElseWentOut = wentOutPlayerId != null && !youWentOut;
    const claimer = wentOutPlayerId ? players.find((p) => p.id === wentOutPlayerId) : null;

    const pillBase =
        "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold touch-manipulation transition disabled:pointer-events-none disabled:opacity-45";
    const pillClass = youWentOut
        ? `${pillBase} border-[var(--game-accent)] bg-[var(--game-accent)]/20 text-[var(--game-accent)]`
        : someoneElseWentOut
            ? `${pillBase} border-white/10 text-[var(--game-muted)]`
            : `${pillBase} border-white/20 bg-white/5 text-[var(--game-text)] active:bg-white/10`;

    const pillLabel = wentOutPending
        ? "…"
        : youWentOut
            ? "Undo"
            : someoneElseWentOut
                ? "Taken"
                : "I went out";

    return (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--game-text)]">Went out</p>
                <p className="mt-0.5 text-xs leading-snug text-[var(--game-muted)]">
                    {claimer ? (
                        <>
                            <span className="text-[var(--game-text)]">{claimer.displayName}</span>
                            {youWentOut ? " · you" : null} · +{WENT_OUT_BONUS}
                        </>
                    ) : (
                        <>+{WENT_OUT_BONUS} to your total · one per round</>
                    )}
                </p>
            </div>
            <button
                type="button"
                className={pillClass}
                disabled={wentOutPending || someoneElseWentOut}
                onClick={() => onToggle(!youWentOut)}
            >
                {pillLabel}
            </button>
        </div>
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
    wentOutPlayerId,
    players,
    wentOutPending,
    onWentOutToggle,
    mine,
    onSaved,
}: {
    code: string;
    stored: { playerId: string; playerToken: string };
    wentOutPlayerId: string | null;
    players: PublicGamePayload["players"];
    wentOutPending: boolean;
    onWentOutToggle: (turnOn: boolean) => void;
    mine: PublicRoundScore | undefined;
    onSaved: () => void;
}) {
    const [tape, setTape] = useState<TapeEntry[]>([]);
    const [saving, setSaving] = useState(false);

    const savedScoreRevision = useMemo(
        () => [mine?.total ?? null, mine?.scoreMeta ? JSON.stringify(mine.scoreMeta) : null] as const,
        [mine?.total, mine?.scoreMeta],
    );

    useEffect(() => {
        setTape([]);
    }, [savedScoreRevision]);

    const tapsBase = useMemo<ScoreTapMeta>(
        () => (mine?.scoreMeta ? { ...emptyTaps, ...mine.scoreMeta } : { ...emptyTaps }),
        [mine?.scoreMeta],
    );

    const iWentOut = wentOutPlayerId === stored.playerId;
    const savedWentOutBonus = mine?.scoreMeta?.wentOut === 1 ? WENT_OUT_BONUS : 0;
    const calculatorBaseline = (mine?.total ?? 0) - savedWentOutBonus;
    const calculatorDraft = useMemo(
        () => calculatorBaseline + tape.reduce((sum, e) => sum + e.delta, 0),
        [calculatorBaseline, tape],
    );
    const draft = calculatorDraft + (iWentOut ? WENT_OUT_BONUS : 0);
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
                    score: calculatorDraft,
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
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-[var(--game-muted)]">Total</p>
                        <p className="mt-1 font-mono text-4xl font-bold tabular-nums leading-none text-[var(--game-text)]">
                            {draft}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="shrink-0 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-[var(--game-text)] touch-manipulation active:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                        disabled={tape.length === 0}
                        onClick={undoLastTap}
                    >
                        Undo
                    </button>
                </div>
                <WentOutRow
                    wentOutPlayerId={wentOutPlayerId}
                    youId={stored.playerId}
                    players={players}
                    wentOutPending={wentOutPending}
                    onToggle={onWentOutToggle}
                />
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

            <p className="text-center text-xs text-[var(--game-muted)]">
                {mine
                    ? "You can update your score until the host locks this round."
                    : "Save when ready — you can edit again before the host locks the round."}
            </p>
            <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void finish()}>
                {saving ? "Saving…" : mine ? "Update score" : "Save score"}
            </button>
        </div>
    );
}
