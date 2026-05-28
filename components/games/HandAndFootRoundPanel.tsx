"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { HAND_AND_FOOT_SCORING_REFERENCE } from "@/lib/games/handAndFoot";
import { readHostToken } from "@/lib/client/storage";
import type { PublicGamePayload, PublicRoundScore } from "@/lib/server/gameState";

const BTN_PRIMARY =
    "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent)] px-4 text-base font-semibold text-black active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

const FIELD =
    "min-h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-base font-mono text-[var(--game-text)] outline-none transition focus:border-[var(--game-accent)] focus:ring-2 focus:ring-[var(--game-accent)]/30";

function parseNum(v: string): number {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function TeamScoreCard({
    teamName,
    playerNames,
    score,
    isYou,
}: {
    teamName: string;
    playerNames: string;
    score: PublicRoundScore | undefined;
    isYou: boolean;
}) {
    const meta = score?.handAndFootMeta;
    return (
        <div
            className={`rounded-2xl border p-4 ${isYou ? "border-[var(--game-accent)]/50 bg-[var(--game-accent)]/5" : "border-white/10 bg-black/20"}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="font-medium text-[var(--game-text)]">{teamName}</p>
                    <p className="text-xs text-[var(--game-muted)]">{playerNames}</p>
                </div>
                {score ? (
                    <p className="font-mono text-2xl font-bold tabular-nums text-[var(--game-text)]">{score.total}</p>
                ) : (
                    <p className="text-sm text-[var(--game-muted)]">Pending</p>
                )}
            </div>
            {meta ? (
                <p className="mt-2 font-mono text-[0.65rem] leading-relaxed text-[var(--game-muted)]">
                    Books {meta.books} · Cards {meta.cards} · Penalties {meta.penalties}
                </p>
            ) : null}
        </div>
    );
}

function ScoringForm({
    code,
    stored,
    teamId,
    teamName,
    mine,
    onSaved,
}: {
    code: string;
    stored: { playerId: string; playerToken: string };
    teamId: string;
    teamName: string;
    mine: PublicRoundScore | undefined;
    onSaved: () => void;
}) {
    const meta = mine?.handAndFootMeta;
    const [books, setBooks] = useState(() => (meta != null ? String(meta.books) : ""));
    const [cards, setCards] = useState(() => (meta != null ? String(meta.cards) : ""));
    const [penalties, setPenalties] = useState(() => (meta != null ? String(meta.penalties) : ""));
    const [saving, setSaving] = useState(false);

    const b = parseNum(books);
    const c = parseNum(cards);
    const p = parseNum(penalties);
    const total = b + c - p;

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
                    teamId,
                    books: b,
                    cards: c,
                    penalties: p,
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
            <p className="text-sm font-medium text-[var(--game-accent)]">Scoring for {teamName}</p>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs font-medium text-[var(--game-muted)]">Round total</p>
                <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-[var(--game-text)]">{total}</p>
                <p className="mt-2 font-mono text-[0.65rem] leading-relaxed text-[var(--game-muted)]">
                    Books {b} · Cards {c} · Penalties {p}
                </p>
            </div>

            <label className="text-xs font-medium text-[var(--game-muted)]">
                Books (dirty ×300, clean ×500)
                <input
                    className={`${FIELD} mt-1`}
                    inputMode="numeric"
                    value={books}
                    onChange={(e) => setBooks(e.target.value)}
                />
            </label>
            <label className="text-xs font-medium text-[var(--game-muted)]">
                Cards (4–7=5, 8–K=10, A/2=20, Joker=50)
                <input
                    className={`${FIELD} mt-1`}
                    inputMode="numeric"
                    value={cards}
                    onChange={(e) => setCards(e.target.value)}
                />
            </label>
            <label className="text-xs font-medium text-[var(--game-muted)]">
                Penalties (black 3=30, red 3=300 — entered positive, subtracted)
                <input
                    className={`${FIELD} mt-1 text-rose-300`}
                    inputMode="numeric"
                    value={penalties}
                    onChange={(e) => setPenalties(e.target.value)}
                />
            </label>

            <ul className="space-y-1 text-[0.65rem] leading-relaxed text-[var(--game-muted)]">
                {HAND_AND_FOOT_SCORING_REFERENCE.map((line) => (
                    <li key={line}>{line}</li>
                ))}
            </ul>

            <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void finish()}>
                {saving ? "Saving…" : mine ? "Update round score" : "Save round score"}
            </button>
        </div>
    );
}

export function HandAndFootRoundPanel({
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
    const youAreHost = game.youAreHost;

    const myPlayer = game.players.find((p) => p.id === stored.playerId);
    const myTeamId = myPlayer?.teamId ?? null;

    const teamScores = useMemo(() => {
        const map = new Map<string, PublicRoundScore>();
        for (const s of current?.scores ?? []) {
            if (s.teamId) map.set(s.teamId, s);
        }
        return map;
    }, [current?.scores]);

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
            const prev = qc.getQueryData<PublicGamePayload>(queryKey);
            if (prev) {
                qc.setQueryData<PublicGamePayload>(queryKey, {
                    ...prev,
                    rounds: prev.rounds.map((r) => {
                        if (r.number !== prev.currentRound || r.lockedAt != null) return r;
                        return { ...r, playPhase: "scoring" };
                    }),
                });
            }
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
        },
        onSettled: () => void qc.invalidateQueries({ queryKey }),
    });

    if (phase === "playing") {
        return (
            <div className="mt-4 flex flex-col gap-4">
                <p className="text-pretty text-sm leading-relaxed text-[var(--game-muted)]">
                    Play your hand — the host will start scoring when the round ends.
                </p>
                {youAreHost ? (
                    <button
                        type="button"
                        className={BTN_PRIMARY}
                        disabled={endRoundMutation.isPending}
                        onClick={() => endRoundMutation.mutate()}
                    >
                        {endRoundMutation.isPending ? "Ending…" : "End round (start scoring)"}
                    </button>
                ) : (
                    <p className="text-sm text-[var(--game-muted)]">Waiting for the host to end the round…</p>
                )}
            </div>
        );
    }

    const teamsSorted = [...game.teams].sort((a, b) => a.sortOrder - b.sortOrder);

    return (
        <div className="mt-4 flex flex-col gap-5">
            {myTeamId ? (
                <ScoringForm
                    code={code}
                    stored={stored}
                    teamId={myTeamId}
                    teamName={game.teams.find((t) => t.id === myTeamId)?.name ?? "Your team"}
                    mine={teamScores.get(myTeamId)}
                    onSaved={onSaved}
                />
            ) : (
                <p className="text-sm text-[var(--game-warn)]">You are not on a team for this game.</p>
            )}

            <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--game-muted)]">All teams</p>
                {teamsSorted.map((t) => {
                    const members = game.players.filter((p) => p.teamId === t.id);
                    return (
                        <TeamScoreCard
                            key={t.id}
                            teamName={t.name}
                            playerNames={members.map((p) => p.displayName).join(", ")}
                            score={teamScores.get(t.id)}
                            isYou={t.id === myTeamId}
                        />
                    );
                })}
            </div>
        </div>
    );
}
