"use client";

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import QRCode from "react-qr-code";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CopyTextButton } from "@/components/CopyTextButton";
import { Game2500RoundPanel } from "@/components/games/Game2500RoundPanel";
import { AnimatedWizardStep, scheduleAfterEnterStable } from "@/components/step-wizard";
import { randomGuestDisplayName } from "@/lib/client/randomGuestName";
import {
    getOrCreateClientKey,
    readHostToken,
    readShowStandings,
    readStoredPlayer,
    writeShowStandings,
    writeStoredPlayer,
} from "@/lib/client/storage";
import { computeRoundTotal } from "@/lib/games/nertz";
import type { PublicGamePayload, PublicRoundScore } from "@/lib/server/gameState";
import { GameTheme } from "./GameTheme";
import { GroupStatsAwards } from "./GroupStatsAwards";
import { ScoreChart } from "./ScoreChart";
import { StandingsTable } from "./StandingsTable";
import { YourStatsCard } from "./YourStatsCard";

/** 16px+ text on inputs avoids iOS zoom; min-h-12 is a comfortable touch target. */
const FIELD =
    "min-h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-base text-[var(--game-text)] outline-none transition focus:border-[var(--game-accent)] focus:ring-2 focus:ring-[var(--game-accent)]/30";

const BTN_PRIMARY =
    "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent)] px-4 text-base font-semibold text-black active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

const BTN_CYAN =
    "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent-2)] px-4 text-base font-semibold text-black active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

const BTN_GHOST =
    "flex min-h-12 touch-manipulation items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-4 text-base font-medium text-[var(--game-text)] active:bg-white/10 disabled:pointer-events-none disabled:opacity-45";

async function fetchGame(code: string): Promise<PublicGamePayload> {
    const headers = new Headers();
    const host = readHostToken(code);
    if (host) headers.set("x-host-token", host);
    const res = await fetch(`/api/games/${encodeURIComponent(code)}`, {
        headers,
        cache: "no-store",
        credentials: "include",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to load game");
    }
    return res.json();
}

export function GameRoom({ code }: { code: string }) {
    const normalized = code.trim().toUpperCase();
    const qc = useQueryClient();

    const [tabVisible, setTabVisible] = useState(true);
    useEffect(() => {
        const sync = () => setTabVisible(typeof document !== "undefined" && !document.hidden);
        sync();
        document.addEventListener("visibilitychange", sync);
        return () => document.removeEventListener("visibilitychange", sync);
    }, []);

    const gameQuery = useQuery({
        queryKey: ["game", normalized],
        queryFn: () => fetchGame(normalized),
        refetchInterval: (query) => {
            const d = query.state.data;
            if (!d || d.status !== "active") return 4000;
            return tabVisible ? 1000 : 5000;
        },
    });

    const themeType = gameQuery.data?.type ?? "nertz";

    const [joinName, setJoinName] = useState("");
    const [joinError, setJoinError] = useState<string | null>(null);

    const joinMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/games/${encodeURIComponent(normalized)}/join`, {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    displayName: joinName.trim(),
                    clientKey: getOrCreateClientKey(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as { error?: string }).error ?? "Join failed");
            return data as { playerId: string; playerToken: string };
        },
        onSuccess: (data) => {
            writeStoredPlayer(normalized, { playerId: data.playerId, playerToken: data.playerToken });
            setJoinError(null);
            void qc.invalidateQueries({ queryKey: ["game", normalized] });
        },
        onError: (e: Error) => setJoinError(e.message),
    });

    const startMutation = useMutation({
        mutationFn: async () => {
            const host = readHostToken(normalized);
            if (!host) throw new Error("Missing host session");
            const res = await fetch(`/api/games/${encodeURIComponent(normalized)}/start`, {
                method: "POST",
                credentials: "include",
                headers: { "x-host-token": host },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as { error?: string }).error ?? "Start failed");
            return data;
        },
        onSuccess: () => void qc.invalidateQueries({ queryKey: ["game", normalized] }),
    });

    const settingsMutation = useMutation({
        mutationFn: async (payload: { targetScore?: number; roundWinBonus?: number }) => {
            const host = readHostToken(normalized);
            if (!host) throw new Error("Missing host session");
            const res = await fetch(`/api/games/${encodeURIComponent(normalized)}/settings`, {
                method: "PATCH",
                credentials: "include",
                headers: { "content-type": "application/json", "x-host-token": host },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as { error?: string }).error ?? "Update failed");
            return data;
        },
        onSuccess: () => void qc.invalidateQueries({ queryKey: ["game", normalized] }),
    });

    const stored = readStoredPlayer(normalized);

    return (
        <GameTheme type={themeType}>
            {gameQuery.isPending ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-base text-[var(--game-muted)]">
                    <span className="inline-block size-8 animate-pulse rounded-full bg-white/20" aria-hidden />
                    Loading…
                </div>
            ) : gameQuery.isError ? (
                <div className="flex min-h-0 flex-1 flex-col justify-center px-[max(1.25rem,env(safe-area-inset-left))] py-16 pr-[max(1.25rem,env(safe-area-inset-right))]">
                    <p className="text-pretty text-lg text-[var(--game-warn)]">{(gameQuery.error as Error).message}</p>
                    <Link
                        className="mt-6 inline-flex min-h-12 items-center text-base font-medium text-[var(--game-accent-2)] underline underline-offset-4"
                        href="/"
                    >
                        Home
                    </Link>
                </div>
            ) : (
                <GameRoomInner
                    game={gameQuery.data}
                    normalized={normalized}
                    joinName={joinName}
                    setJoinName={setJoinName}
                    joinError={joinError}
                    onJoin={() => joinMutation.mutate()}
                    joining={joinMutation.isPending}
                    stored={stored}
                    onStart={() => startMutation.mutateAsync()}
                    starting={startMutation.isPending}
                    onSaveSettings={(p) => settingsMutation.mutateAsync(p)}
                    saving={settingsMutation.isPending}
                    qc={qc}
                />
            )}
        </GameTheme>
    );
}

function GameRoomInner({
    game,
    normalized,
    joinName,
    setJoinName,
    joinError,
    onJoin,
    joining,
    stored,
    onStart,
    starting,
    onSaveSettings,
    saving,
    qc,
}: {
    game: PublicGamePayload;
    normalized: string;
    joinName: string;
    setJoinName: (v: string) => void;
    joinError: string | null;
    onJoin: () => void;
    joining: boolean;
    stored: { playerId: string; playerToken: string } | null;
    onStart: () => void | Promise<void>;
    starting: boolean;
    onSaveSettings: (p: { targetScore?: number; roundWinBonus?: number }) => Promise<unknown>;
    saving: boolean;
    qc: QueryClient;
}) {
    const [standingsVisible, setStandingsVisible] = useState(false);

    useEffect(() => {
        setStandingsVisible(readShowStandings());
    }, []);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-8 sm:p-8">
            {game.status === "active" && !stored ? (
                <div className="rounded-2xl border border-[var(--game-warn)]/45 bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)] sm:rounded-[var(--game-radius)] sm:p-5">
                    <p className="text-base font-semibold text-[var(--game-warn)]">Join to enter scores</p>
                    <p className="mt-2 text-pretty text-sm leading-relaxed text-[var(--game-muted)] sm:text-xs">
                        This game is in progress. Join as a guest: type a display name or tap{" "}
                        <span className="font-medium text-[var(--game-text)]">Random name</span>, then join.
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                        <input
                            className={FIELD}
                            placeholder="Your name"
                            autoComplete="nickname"
                            autoFocus
                            value={joinName}
                            onChange={(e) => setJoinName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && joinName.trim().length > 0 && !joining) {
                                    e.preventDefault();
                                    onJoin();
                                }
                            }}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                            <button
                                type="button"
                                className={`${BTN_GHOST} shrink-0 sm:min-w-[10.5rem]`}
                                disabled={joining}
                                onClick={() => setJoinName(randomGuestDisplayName())}
                            >
                                Random name
                            </button>
                            <button
                                type="button"
                                className={`${BTN_PRIMARY} min-w-0 flex-1`}
                                disabled={joining || joinName.trim().length === 0}
                                onClick={onJoin}
                            >
                                {joining ? "Joining…" : "Join"}
                            </button>
                        </div>
                    </div>
                    {joinError ? <p className="mt-3 text-base text-[var(--game-warn)] sm:text-sm">{joinError}</p> : null}
                </div>
            ) : null}

            <GameRoomChrome game={game} />

            {game.status === "done" ? (
                <div className="rounded-2xl border border-white/10 bg-[var(--game-surface-2)] p-5 text-[var(--game-text)] shadow-[var(--game-shadow)] sm:rounded-[var(--game-radius)]">
                    <p className="text-xl font-semibold sm:text-lg">Match finished</p>
                    {game.winnerPlayerIds.length ? (
                        <p className="mt-3 text-pretty text-base text-[var(--game-muted)] sm:text-sm">
                            Winners:{" "}
                            <span className="text-[var(--game-accent)]">
                                {game.players
                                    .filter((p) => game.winnerPlayerIds.includes(p.id))
                                    .map((p) => p.displayName)
                                    .join(", ")}
                            </span>
                        </p>
                    ) : null}
                </div>
            ) : null}

            {game.status === "lobby" ? (
                <Lobby
                    key={`lobby-${game.targetScore}-${game.roundWinBonus}`}
                    game={game}
                    joinName={joinName}
                    setJoinName={setJoinName}
                    joinError={joinError}
                    onJoin={onJoin}
                    joining={joining}
                    stored={stored}
                    onStart={onStart}
                    starting={starting}
                    onSaveSettings={onSaveSettings}
                    saving={saving}
                />
            ) : null}

            {game.status === "active" || game.status === "done" ? (
                <section className="grid min-h-0 gap-8 md:grid-cols-[1fr_minmax(280px,400px)] md:items-start md:gap-6">
                    <div className="order-2 flex flex-col gap-5 md:order-1">
                        {standingsVisible ? (
                            <>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--game-muted)] sm:text-sm">
                                        Standings
                                    </h2>
                                    <button
                                        type="button"
                                        className={`${BTN_GHOST} w-full shrink-0 sm:w-auto`}
                                        onClick={() => {
                                            writeShowStandings(false);
                                            setStandingsVisible(false);
                                        }}
                                    >
                                        Hide standings
                                    </button>
                                </div>
                                <StandingsTable game={game} />
                                <p className="text-pretty text-sm leading-relaxed text-[var(--game-muted)] sm:text-xs">
                                    The on-pace label uses average net points per <strong>locked</strong> round only. It is a rough
                                    estimate, not a prediction of who will win.
                                </p>
                                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--game-muted)] sm:text-sm">
                                    Chart
                                </h2>
                                <ScoreChart game={game} />
                                {game.type !== "2500" ? <GroupStatsAwards game={game} /> : null}
                            </>
                        ) : (
                            <button
                                type="button"
                                className={BTN_GHOST}
                                onClick={() => {
                                    writeShowStandings(true);
                                    setStandingsVisible(true);
                                }}
                            >
                                See standings & chart
                            </button>
                        )}
                    </div>

                    <aside className="order-1 flex min-h-0 flex-col gap-4 md:sticky md:top-4 md:order-2 md:self-start">
                        {game.status === "active" ? (
                            <RoundPanel
                                game={game}
                                stored={stored}
                                code={normalized}
                                onSaved={() => void qc.invalidateQueries({ queryKey: ["game", normalized] })}
                            />
                        ) : null}
                        {(game.status === "active" || game.status === "done") && stored ? (
                            <YourStatsCard game={game} playerId={stored.playerId} />
                        ) : null}
                    </aside>
                </section>
            ) : null}
        </div>
    );
}

function InviteLinkBlock({ code, stacked }: { code: string; stacked?: boolean }) {
    const path = `/g/${encodeURIComponent(code)}`;
    const [absoluteUrl, setAbsoluteUrl] = useState("");
    useEffect(() => {
        const id = window.setTimeout(() => {
            setAbsoluteUrl(`${window.location.origin}${path}`);
        }, 0);
        return () => window.clearTimeout(id);
    }, [path]);

    const shown = absoluteUrl || path;

    return (
        <div className={`w-full min-w-0 ${stacked ? "text-left" : "text-left sm:text-right"}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--game-muted)]">Invite link</p>
            <p className="mt-2 break-all rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm leading-snug text-[var(--game-text)] sm:text-xs">
                {shown}
            </p>
            <CopyTextButton
                text={absoluteUrl}
                idleLabel="Copy link"
                copiedLabel="Link copied"
                disabled={!absoluteUrl}
                className={`${BTN_GHOST} mt-3 w-full ${stacked ? "" : "sm:ml-auto sm:w-auto"}`}
            />
            {absoluteUrl ? (
                <div className="mt-4 flex flex-col items-center gap-2">
                    <p className="text-xs text-[var(--game-muted)]">Scan to join</p>
                    <div className="rounded-xl bg-white p-2">
                        <QRCode value={absoluteUrl} size={stacked ? 140 : 160} level="M" />
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function RoomDetailsFields({ game, variant }: { game: PublicGamePayload; variant: "header" | "popover" }) {
    const stackedInvite = variant === "popover";
    const outer =
        variant === "header"
            ? "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-3"
            : "flex flex-col gap-4";

    return (
        <div className={outer}>
            <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--game-muted)]">Room</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="break-all font-mono text-2xl font-semibold tracking-tight text-[var(--game-text)] sm:text-3xl">
                        {game.code}
                    </h1>
                    <CopyTextButton
                        text={game.code}
                        idleLabel="Copy code"
                        className={`${BTN_GHOST} shrink-0 px-4 py-2.5 text-sm font-semibold sm:min-h-0 sm:py-2 sm:text-xs`}
                    />
                </div>
                <p className="mt-2 text-pretty text-base leading-relaxed text-[var(--game-muted)] sm:text-sm">
                    {game.type === "2500" ? (
                        <>
                            Play to <span className="font-medium text-[var(--game-text)]">{game.targetScore}</span> points ·
                            Meld tracker and wild card per round · Aces low (A below 3)
                        </>
                    ) : (
                        <>
                            First to <span className="font-medium text-[var(--game-text)]">{game.targetScore}</span> · Round win
                            bonus <span className="font-medium text-[var(--game-text)]">{game.roundWinBonus}</span>
                        </>
                    )}
                </p>
            </div>
            <div
                className={`flex w-full min-w-0 flex-col gap-3 ${variant === "header" ? "sm:w-auto sm:max-w-md sm:items-end" : ""}`}
            >
                <InviteLinkBlock code={game.code} stacked={stackedInvite} />
                <div className={`flex flex-wrap gap-x-4 gap-y-2 ${variant === "header" ? "sm:justify-end" : ""}`}>
                    <Link
                        href="/join"
                        className="inline-flex min-h-11 items-center text-base text-[var(--game-accent-2)] underline underline-offset-4 sm:min-h-0 sm:text-sm"
                    >
                        Join with code
                    </Link>
                    <Link
                        href="/"
                        className="inline-flex min-h-11 items-center text-base text-[var(--game-accent-2)] underline underline-offset-4 sm:min-h-0 sm:text-sm"
                    >
                        New game
                    </Link>
                </div>
            </div>
        </div>
    );
}

const INFO_BTN =
    "flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/20 bg-white/5 text-[var(--game-text)] outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--game-accent)]/40";

function RoomInfoIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    );
}

function GameRoomChrome({ game }: { game: PublicGamePayload }) {
    const compact = game.status === "active";
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const panelId = useId();

    useEffect(() => {
        setOpen(false);
    }, [game.status]);

    useEffect(() => {
        if (!open || !compact) return;
        const onDoc = (e: PointerEvent) => {
            const el = wrapRef.current;
            if (!el?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onDoc, true);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onDoc, true);
            window.removeEventListener("keydown", onKey);
        };
    }, [open, compact]);

    if (!compact) {
        return (
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                <RoomDetailsFields game={game} variant="header" />
            </header>
        );
    }

    return (
        <header ref={wrapRef} className="relative flex justify-end">
            <button
                type="button"
                className={INFO_BTN}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-controls={panelId}
                onClick={() => setOpen((v) => !v)}
            >
                <span className="sr-only">Room details, invite link, and shortcuts</span>
                <RoomInfoIcon />
            </button>
            {open ? (
                <div
                    id={panelId}
                    role="dialog"
                    aria-label="Room details"
                    className="absolute right-0 top-full z-50 mt-2 max-h-[min(70dvh,28rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-white/10 bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)] sm:rounded-[var(--game-radius)] sm:p-5"
                >
                    <RoomDetailsFields game={game} variant="popover" />
                </div>
            ) : null}
        </header>
    );
}

function Lobby({
    game,
    joinName,
    setJoinName,
    joinError,
    onJoin,
    joining,
    stored,
    onStart,
    starting,
    onSaveSettings,
    saving,
}: {
    game: PublicGamePayload;
    joinName: string;
    setJoinName: (v: string) => void;
    joinError: string | null;
    onJoin: () => void;
    joining: boolean;
    stored: { playerId: string; playerToken: string } | null;
    onStart: () => void | Promise<void>;
    starting: boolean;
    onSaveSettings: (p: { targetScore?: number; roundWinBonus?: number }) => Promise<unknown>;
    saving: boolean;
}) {
    const [targetScore, setTargetScore] = useState(String(game.targetScore));
    const [roundWinBonus, setRoundWinBonus] = useState(String(game.roundWinBonus));
    const [settingsNote, setSettingsNote] = useState<"idle" | "saving" | "saved">("idle");

    const persistSettingsIfDirty = useCallback(async () => {
        const ts = Number(targetScore);
        const rwb = Number(roundWinBonus);
        if (!Number.isFinite(ts)) return;
        if (game.type === "2500") {
            if (ts === game.targetScore) return;
            setSettingsNote("saving");
            try {
                await onSaveSettings({ targetScore: ts, roundWinBonus: 0 });
                setSettingsNote("saved");
                window.setTimeout(() => setSettingsNote("idle"), 2000);
            } catch {
                setSettingsNote("idle");
            }
            return;
        }
        if (!Number.isFinite(rwb)) return;
        if (ts === game.targetScore && rwb === game.roundWinBonus) return;
        setSettingsNote("saving");
        try {
            await onSaveSettings({ targetScore: ts, roundWinBonus: rwb });
            setSettingsNote("saved");
            window.setTimeout(() => setSettingsNote("idle"), 2000);
        } catch {
            setSettingsNote("idle");
        }
    }, [targetScore, roundWinBonus, game.targetScore, game.roundWinBonus, game.type, onSaveSettings]);

    const handleStart = async () => {
        await persistSettingsIfDirty();
        await onStart();
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)] sm:rounded-[var(--game-radius)]">
                <h2 className="text-xl font-semibold text-[var(--game-text)] sm:text-lg">Join this room</h2>
                <p className="mt-2 text-pretty text-base leading-relaxed text-[var(--game-muted)] sm:text-sm">
                    Join as a guest: type a display name or tap Random name. This browser will remember you for this
                    room.
                </p>
                {!stored ? (
                    <div className="mt-5 flex flex-col gap-4">
                        <input
                            className={FIELD}
                            placeholder="Your name"
                            autoComplete="nickname"
                            autoFocus
                            value={joinName}
                            onChange={(e) => setJoinName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && joinName.trim().length > 0 && !joining) {
                                    e.preventDefault();
                                    onJoin();
                                }
                            }}
                        />
                        {joinError ? <p className="text-base text-[var(--game-warn)] sm:text-sm">{joinError}</p> : null}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                            <button
                                type="button"
                                className={`${BTN_GHOST} shrink-0 sm:min-w-[10.5rem]`}
                                disabled={joining}
                                onClick={() => setJoinName(randomGuestDisplayName())}
                            >
                                Random name
                            </button>
                            <button
                                type="button"
                                className={`${BTN_PRIMARY} min-w-0 flex-1`}
                                disabled={joining || joinName.trim().length === 0}
                                onClick={onJoin}
                            >
                                {joining ? "Joining…" : "Join"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="mt-5 text-base text-[var(--game-accent-2)] sm:text-sm">
                        You are in the room. Wait for the host to start the game.
                    </p>
                )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)] sm:rounded-[var(--game-radius)]">
                <h2 className="text-xl font-semibold text-[var(--game-text)] sm:text-lg">Lobby</h2>
                <ul className="mt-4 space-y-2 text-base text-[var(--game-text)] sm:text-sm">
                    {game.players.map((p) => (
                        <li
                            key={p.id}
                            className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-black/20 px-4 py-3"
                        >
                            <span className="min-w-0 truncate font-medium">{p.displayName}</span>
                            {stored?.playerId === p.id ? (
                                <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs text-[var(--game-muted)]">
                                    you
                                </span>
                            ) : null}
                        </li>
                    ))}
                    {game.players.length === 0 ? <li className="text-[var(--game-muted)]">No one has joined yet.</li> : null}
                </ul>

                {game.youAreHost ? (
                    <div className="mt-6 space-y-5 border-t border-white/10 pt-6">
                        <div className={`grid gap-5 sm:gap-4 ${game.type === "2500" ? "" : "sm:grid-cols-2"}`}>
                            <label className="text-sm font-medium text-[var(--game-muted)] sm:text-xs">
                                Target score
                                <input
                                    className={`${FIELD} mt-2 font-mono`}
                                    inputMode="numeric"
                                    value={targetScore}
                                    onChange={(e) => setTargetScore(e.target.value)}
                                    onBlur={() => void persistSettingsIfDirty()}
                                />
                            </label>
                            {game.type !== "2500" ? (
                                <label className="text-sm font-medium text-[var(--game-muted)] sm:text-xs">
                                    Round win bonus
                                    <input
                                        className={`${FIELD} mt-2 font-mono`}
                                        inputMode="numeric"
                                        value={roundWinBonus}
                                        onChange={(e) => setRoundWinBonus(e.target.value)}
                                        onBlur={() => void persistSettingsIfDirty()}
                                    />
                                </label>
                            ) : null}
                        </div>
                        <p className="text-xs text-[var(--game-muted)]">
                            Settings save when you leave a field.{" "}
                            {saving || settingsNote === "saving" ? (
                                <span className="text-[var(--game-accent-2)]">Saving…</span>
                            ) : settingsNote === "saved" ? (
                                <span className="text-[var(--game-accent)]">Saved.</span>
                            ) : null}
                        </p>
                        <button
                            type="button"
                            className={BTN_CYAN}
                            disabled={starting || game.players.length < 1}
                            onClick={() => void handleStart()}
                        >
                            {starting ? "Starting…" : "Start game"}
                        </button>
                    </div>
                ) : (
                    <p className="mt-5 text-base text-[var(--game-muted)] sm:text-sm">Waiting for the host to start the game…</p>
                )}
            </div>
        </div>
    );
}

function RoundSubmissionRoster({
    game,
    youPlayerId,
}: {
    game: PublicGamePayload;
    youPlayerId: string | null;
}) {
    const current = game.rounds.find((r) => r.number === game.currentRound && r.lockedAt == null);
    if (!current) {
        return (
            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs text-[var(--game-muted)] sm:text-[0.65rem]">Updating round…</p>
            </div>
        );
    }
    const is2500Playing = game.type === "2500" && current.playPhase === "playing";
    if (is2500Playing) {
        return (
            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--game-muted)] sm:text-[0.65rem]">
                    Scoring
                </p>
                <p className="mt-3 text-pretty text-xs leading-relaxed text-[var(--game-muted)] sm:text-[0.65rem]">
                    The host will end the round when play stops; then everyone enters their score here.
                </p>
            </div>
        );
    }
    const submitted = new Set(current.scores.map((s) => s.playerId));

    return (
        <div className="mt-6 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--game-muted)] sm:text-[0.65rem]">
                Scores in this round
            </p>
            <ul className="mt-3 space-y-2.5" aria-label="Who has submitted scores for the current round">
                {game.players.map((p) => {
                    const done = submitted.has(p.id);
                    const isYou = youPlayerId != null && p.id === youPlayerId;
                    return (
                        <li key={p.id} className="flex items-center justify-between gap-3 text-sm sm:text-xs">
                            <span className={`min-w-0 truncate ${isYou ? "font-semibold text-[var(--game-text)]" : "text-[var(--game-muted)]"}`}>
                                {p.displayName}
                                {isYou ? <span className="font-normal text-[var(--game-muted)]"> (you)</span> : null}
                            </span>
                            <span
                                className={
                                    done ? "shrink-0 font-medium text-[var(--game-accent)]" : "shrink-0 text-[var(--game-muted)]"
                                }
                            >
                                {done ? "Submitted" : "Not yet"}
                            </span>
                        </li>
                    );
                })}
            </ul>
            {game.currentRoundComplete ? (
                <p className="mt-3 text-pretty text-xs leading-relaxed text-[var(--game-muted)] sm:text-[0.65rem]">
                    {game.type === "2500"
                        ? "All scores are in. The next round starts automatically."
                        : "All scores are in. The round will advance on its own."}
                </p>
            ) : (
                <p className="mt-3 text-pretty text-xs leading-relaxed text-[var(--game-muted)] sm:text-[0.65rem]">
                    {game.type === "2500"
                        ? "When everyone has finished scoring, the round locks and the next round begins."
                        : "The round locks once every player has saved their row."}
                </p>
            )}
        </div>
    );
}

function RoundPanel({
    game,
    stored,
    code,
    onSaved,
}: {
    game: PublicGamePayload;
    stored: { playerId: string; playerToken: string } | null;
    code: string;
    onSaved: () => void;
}) {
    const current = game.rounds.find((r) => r.number === game.currentRound && r.lockedAt == null);
    const mine = current?.scores.find((s) => s.playerId === stored?.playerId);
    const formKey = `${game.currentRound}-${stored?.playerId ?? "x"}-${mine ? "m" : "e"}`;
    const [wizardStep, setWizardStep] = useState(0);

    useEffect(() => {
        setWizardStep(0);
    }, [formKey]);

    const reviewStep = Boolean(stored && wizardStep === 2);
    /** 2500 uses Game2500RoundPanel (no wizard steps); avoid a clipped scroll area so play UI is fully visible. */
    const relaxPanelHeight = reviewStep || game.type === "2500";
    const panelLayout = relaxPanelHeight
        ? "max-md:max-h-none max-md:overflow-visible md:min-h-0 md:overflow-visible"
        : "max-md:max-h-[min(90dvh,36rem)] max-md:overflow-y-auto md:max-h-none md:min-h-[min(36rem,calc(100dvh-6rem))] md:overflow-visible";

    return (
        <div
            className={`flex min-h-0 flex-col rounded-2xl border border-white/10 bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)] sm:rounded-[var(--game-radius)] ${panelLayout}`}
        >
            <h3 className="text-lg font-semibold text-[var(--game-text)]">
                Round {game.currentRound}
                {game.type === "2500" && current ? (
                    <span className="ml-2 text-sm font-normal text-[var(--game-muted)]">
                        · {current.playPhase === "playing" ? "Play" : current.playPhase === "scoring" ? "Score" : ""}
                    </span>
                ) : null}
            </h3>
            {!stored ? (
                <p className="mt-3 text-pretty text-base leading-relaxed text-[var(--game-muted)] sm:text-sm">
                    Join from the lobby first. If you just joined, refresh the page to update.
                </p>
            ) : game.type === "2500" ? (
                <Game2500RoundPanel game={game} stored={stored} code={code} onSaved={onSaved} />
            ) : (
                <RoundScoreForm
                    key={formKey}
                    game={game}
                    stored={stored}
                    code={code}
                    mine={mine}
                    onSaved={onSaved}
                    onStepChange={setWizardStep}
                />
            )}

            <RoundSubmissionRoster game={game} youPlayerId={stored?.playerId ?? null} />
        </div>
    );
}

const ROUND_FORM_STEPS = 3;

function RoundScoreForm({
    game,
    stored,
    code,
    mine,
    onSaved,
    onStepChange,
}: {
    game: PublicGamePayload;
    stored: { playerId: string; playerToken: string };
    code: string;
    mine: PublicRoundScore | undefined;
    onSaved: () => void;
    onStepChange?: (step: number) => void;
}) {
    const currentRound = game.rounds.find((r) => r.number === game.currentRound && r.lockedAt == null);
    const roundWinTakenByOther = Boolean(
        currentRound?.scores.some(
            (s) =>
                s.playerId !== stored.playerId &&
                game.roundWinBonus > 0 &&
                s.bonus === game.roundWinBonus,
        ),
    );
    const iAmCommittedWinner = Boolean(
        mine && game.roundWinBonus > 0 && mine.bonus === game.roundWinBonus,
    );
    const roundWinChoiceLocked = roundWinTakenByOther && !iAmCommittedWinner;

    const [score, setScore] = useState(() => (mine != null ? String(mine.score) : ""));
    const [penalty, setPenalty] = useState(() => (mine != null ? String(mine.penalty) : ""));
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);
    const [saving, setSaving] = useState(false);

    const scoreRef = useRef<HTMLInputElement>(null);
    const penaltyRef = useRef<HTMLInputElement>(null);
    const saveRef = useRef<HTMLButtonElement>(null);

    const focusWizardStep = useCallback((s: number) => {
        if (s === 0) scoreRef.current?.focus({ preventScroll: true });
        else if (s === 1) penaltyRef.current?.focus({ preventScroll: true });
        else if (s === 2) saveRef.current?.focus({ preventScroll: true });
    }, []);

    useEffect(() => {
        return scheduleAfterEnterStable(() => focusWizardStep(step));
    }, [step, focusWizardStep]);

    useEffect(() => {
        onStepChange?.(step);
    }, [step, onStepChange]);

    useEffect(() => {
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape" && step > 0) {
                e.preventDefault();
                setDirection(-1);
                setStep((s) => Math.max(0, s - 1));
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [step]);

    const goNext = () => {
        setDirection(1);
        setStep((s) => Math.min(ROUND_FORM_STEPS - 1, s + 1));
    };

    const goBack = () => {
        setDirection(-1);
        setStep((s) => Math.max(0, s - 1));
    };

    const jumpToStep = (target: number) => {
        setDirection(target < step ? -1 : 1);
        setStep(Math.max(0, Math.min(ROUND_FORM_STEPS - 1, target)));
    };

    const ns = score.trim() === "" ? 0 : Number(score);
    const np = penalty.trim() === "" ? 0 : Number(penalty);
    const bonusVal =
        game.roundWinBonus > 0 && !roundWinChoiceLocked && Number.isFinite(np) && np === 0
            ? game.roundWinBonus
            : 0;
    const previewTotal =
        Number.isFinite(ns) && Number.isFinite(np)
            ? computeRoundTotal(ns, np, bonusVal)
            : null;

    const save = async () => {
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
                    score: score.trim() === "" ? 0 : Number(score),
                    penalty: penalty.trim() === "" ? 0 : Number(penalty),
                    bonus: bonusVal,
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

    const nav = (
        <div className="mt-8 flex min-w-0 flex-row flex-nowrap items-stretch gap-3 sm:mt-10">
            <button
                type="button"
                className={`${BTN_GHOST} shrink-0 sm:min-w-[5.5rem]`}
                disabled={step === 0}
                onClick={goBack}
            >
                Back
            </button>
            {step < ROUND_FORM_STEPS - 1 ? (
                <button
                    type="button"
                    className={`${BTN_PRIMARY} min-w-0 flex-1 !w-auto sm:min-w-[6.5rem] sm:flex-none`}
                    onClick={goNext}
                >
                    Next
                </button>
            ) : (
                <button
                    ref={saveRef}
                    type="button"
                    className={`${BTN_PRIMARY} min-w-0 flex-1 !w-auto sm:min-w-[6.5rem] sm:flex-none`}
                    disabled={saving}
                    onClick={() => void save()}
                >
                    {saving ? "Saving…" : "Save my score"}
                </button>
            )}
        </div>
    );

    const onInputEnter = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (step < ROUND_FORM_STEPS - 1) goNext();
        else void save();
    };

    return (
        <div className={`mt-2 flex flex-col sm:flex-1 ${step === 2 ? "sm:min-h-0" : "sm:min-h-[min(70dvh,28rem)]"}`}>
            <p className="text-pretty text-sm leading-relaxed text-[var(--game-muted)] sm:text-xs">
                Enter your scores for this round — step {step + 1} of {ROUND_FORM_STEPS}.
                <span className="hidden sm:inline"> Press Enter to continue; Esc to go back.</span>
                <span className="sm:hidden"> Use Next and Back below.</span>
            </p>
            <AnimatedWizardStep
                stepKey={step}
                direction={direction}
                presenceMode="sync"
                className={step === 2 ? "mt-5 flex flex-col sm:min-h-0" : "mt-5 flex flex-col sm:min-h-0 sm:flex-1"}
            >
                {step === 0 ? (
                    <div className="flex flex-col justify-start sm:flex-1 sm:justify-center">
                        <label className="block text-sm font-medium text-[var(--game-muted)] sm:text-xs">
                            Points
                            <input
                                ref={scoreRef}
                                className={`${FIELD} mt-2 font-mono`}
                                inputMode="numeric"
                                placeholder="0"
                                value={score}
                                onChange={(e) => setScore(e.target.value)}
                                onKeyDown={onInputEnter}
                            />
                        </label>
                        {nav}
                    </div>
                ) : null}
                {step === 1 ? (
                    <div className="flex flex-col justify-start gap-4 sm:flex-1 sm:justify-center">
                        <label className="block text-sm font-medium text-[var(--game-muted)] sm:text-xs">
                            Penalty (subtracted)
                            <input
                                ref={penaltyRef}
                                className={`${FIELD} mt-2 font-mono`}
                                inputMode="numeric"
                                placeholder="0"
                                value={penalty}
                                onChange={(e) => setPenalty(e.target.value)}
                                onKeyDown={onInputEnter}
                            />
                        </label>
                        {game.roundWinBonus > 0 ? (
                            <div className="space-y-3 text-pretty text-base leading-relaxed text-(--game-text) sm:text-sm">
                                {roundWinChoiceLocked ? (
                                    <p>
                                        Another player already claimed this round&apos;s win bonus (+{game.roundWinBonus}). Enter your
                                        penalty as usual; your total will not include that bonus.
                                    </p>
                                ) : (
                                    <p>
                                        If you have <span className="font-semibold mr-1">0</span> penalty points left (you went out), you won
                                        this round — you&apos;ll get the <span className="font-semibold">+{game.roundWinBonus}</span> round
                                        win bonus automatically.
                                    </p>
                                )}
                            </div>
                        ) : null}
                        {nav}
                    </div>
                ) : null}
                {step === 2 ? (
                    <div className="flex flex-col justify-start gap-4 sm:flex-1 sm:justify-center">
                        <p className="text-sm font-medium text-[var(--game-muted)] sm:text-xs">Review</p>
                        <ul className="space-y-2 rounded-2xl border border-white/10 bg-black/15 px-4 py-4 text-base text-[var(--game-text)] sm:text-sm">
                            <li className="flex items-start justify-between gap-4">
                                <span className="text-[var(--game-muted)]">Points</span>
                                <span className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="font-mono font-medium">{score.trim() === "" ? "0" : score}</span>
                                    <button type="button" className={`${BTN_GHOST} !min-h-9 px-3 py-1.5 text-xs`} onClick={() => jumpToStep(0)}>
                                        Edit
                                    </button>
                                </span>
                            </li>
                            <li className="flex items-start justify-between gap-4">
                                <span className="text-[var(--game-muted)]">Penalty</span>
                                <span className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="font-mono font-medium">{penalty.trim() === "" ? "0" : penalty}</span>
                                    <button type="button" className={`${BTN_GHOST} !min-h-9 px-3 py-1.5 text-xs`} onClick={() => jumpToStep(1)}>
                                        Edit
                                    </button>
                                </span>
                            </li>
                            <li className="flex items-start justify-between gap-4">
                                <span className="text-[var(--game-muted)]">
                                    {game.roundWinBonus > 0 ? "Round win bonus" : "Bonus"}
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="font-mono font-medium">{bonusVal}</span>
                                    <button
                                        type="button"
                                        className={`${BTN_GHOST} !min-h-9 px-3 py-1.5 text-xs`}
                                        onClick={() => jumpToStep(1)}
                                    >
                                        Edit
                                    </button>
                                </span>
                            </li>
                            <li className="flex justify-between gap-4 border-t border-white/10 pt-2 font-semibold">
                                <span className="text-[var(--game-muted)]">Round total</span>
                                <span className="font-mono">{previewTotal ?? "—"}</span>
                            </li>
                        </ul>
                        {game.roundWinBonus > 0 && bonusVal === game.roundWinBonus ? (
                            <p className="text-pretty text-sm leading-relaxed text-[var(--game-text)] sm:text-xs">
                                You won this round: you entered <span className="font-semibold">0</span> penalty points, so the round
                                win bonus is included above.
                            </p>
                        ) : null}
                        {game.roundWinBonus > 0 && roundWinChoiceLocked && Number.isFinite(np) && np === 0 ? (
                            <p className="text-pretty text-sm leading-relaxed text-[var(--game-text)] sm:text-xs">
                                You had 0 penalty points, but another player already claimed this round&apos;s win bonus, so no bonus
                                is applied to your total.
                            </p>
                        ) : null}
                        <p className="text-pretty text-xs leading-relaxed text-[var(--game-muted)] sm:text-[0.65rem]">
                            You can edit and save again until the host finalizes this round.
                        </p>
                        {nav}
                    </div>
                ) : null}
            </AnimatedWizardStep>
        </div>
    );
}
