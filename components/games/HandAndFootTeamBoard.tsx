"use client";

import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { PublicGamePayload } from "@/lib/server/gameState";

const UNASSIGNED = "unassigned";

type TeamSnapshot = { id?: string; name: string; playerIds: string[] };

function buildSnapshot(game: PublicGamePayload): TeamSnapshot[] {
    return game.teams.map((t) => ({
        id: t.id,
        name: t.name,
        playerIds: game.players.filter((p) => p.teamId === t.id).map((p) => p.id),
    }));
}

function DraggablePlayer({ id, name }: { id: string; name: string }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
    const style = transform
        ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
        : undefined;

    return (
        <button
            type="button"
            ref={setNodeRef}
            style={style}
            className={`touch-manipulation rounded-xl border border-white/15 bg-[var(--game-surface-2)] px-3 py-2 text-sm font-medium text-[var(--game-text)] active:bg-white/10 ${isDragging ? "opacity-40" : ""}`}
            {...listeners}
            {...attributes}
        >
            {name}
        </button>
    );
}

function DropZone({
    id,
    label,
    children,
    emptyHint,
}: {
    id: string;
    label: string;
    children: React.ReactNode;
    emptyHint?: string;
}) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`min-h-[4.5rem] rounded-2xl border-2 border-dashed p-3 transition ${
                isOver ? "border-[var(--game-accent)] bg-[var(--game-accent)]/10" : "border-white/15 bg-black/15"
            }`}
        >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--game-muted)]">{label}</p>
            <div className="mt-2 flex flex-wrap gap-2">{children}</div>
            {emptyHint && !children ? (
                <p className="mt-2 text-xs text-[var(--game-muted)]">{emptyHint}</p>
            ) : null}
        </div>
    );
}

export function handAndFootLobbyValid(game: PublicGamePayload): { ok: boolean; message: string | null } {
    if (game.players.length < 1) return { ok: false, message: "Need at least one player" };
    const teams = game.teams.length >= 2 ? game.teams : [];
    if (teams.length < 2) return { ok: false, message: "Need at least two teams" };
    const unassigned = game.players.filter((p) => !p.teamId);
    if (unassigned.length > 0) return { ok: false, message: "Assign every player to a team" };
    for (const t of teams) {
        const count = game.players.filter((p) => p.teamId === t.id).length;
        if (count < 1) return { ok: false, message: `${t.name} needs at least one player` };
    }
    return { ok: true, message: null };
}

export function HandAndFootTeamBoard({
    game,
    code,
    stored,
}: {
    game: PublicGamePayload;
    code: string;
    stored: { playerId: string; playerToken: string } | null;
}) {
    const qc = useQueryClient();
    const queryKey = ["game", code] as const;
    const [activeId, setActiveId] = useState<string | null>(null);

    const snapshot = useMemo(() => buildSnapshot(game), [game]);
    const unassigned = game.players.filter((p) => !p.teamId);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const teamsMutation = useMutation({
        mutationFn: async (teamsPayload: TeamSnapshot[]) => {
            if (!stored) throw new Error("Join the room first");
            const res = await fetch(`/api/games/${encodeURIComponent(code)}/teams`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "content-type": "application/json",
                    "x-player-token": stored.playerToken,
                },
                body: JSON.stringify({ teams: teamsPayload }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? "Could not save teams");
            }
            return (await res.json()) as PublicGamePayload;
        },
        onSuccess: (data) => {
            qc.setQueryData(queryKey, data);
        },
    });

    const persist = (next: TeamSnapshot[]) => {
        if (!stored) return;
        teamsMutation.mutate(next);
    };

    const movePlayer = (playerId: string, toTeamId: string | null) => {
        const next = snapshot.map((t) => ({
            ...t,
            playerIds: t.playerIds.filter((id) => id !== playerId),
        }));
        if (toTeamId === null) {
            persist(next);
            return;
        }
        const team = next.find((t) => t.id === toTeamId);
        if (!team) return;
        team.playerIds = [...team.playerIds, playerId];
        persist(next);
    };

    const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

    const onDragEnd = (e: DragEndEvent) => {
        setActiveId(null);
        const playerId = String(e.active.id);
        const over = e.over?.id != null ? String(e.over.id) : null;
        if (!over) return;
        if (over === UNASSIGNED) movePlayer(playerId, null);
        else movePlayer(playerId, over);
    };

    const addTeam = () => {
        const n = snapshot.length + 1;
        persist([...snapshot, { name: `Team ${n}`, playerIds: [] }]);
    };

    const activePlayer = activeId ? game.players.find((p) => p.id === activeId) : null;
    const validation = handAndFootLobbyValid(game);

    useEffect(() => {
        if (!stored || game.teams.length > 0 || teamsMutation.isPending) return;
        persist([
            { name: "Team 1", playerIds: [] },
            { name: "Team 2", playerIds: [] },
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when lobby has no teams
    }, [stored, game.teams.length]);

    if (!stored) {
        return (
            <p className="mt-4 text-sm text-[var(--game-muted)]">Join the room to help arrange teams.</p>
        );
    }

    return (
        <div className="mt-5 flex flex-col gap-4">
            <p className="text-pretty text-sm text-[var(--game-muted)]">
                Drag players into teams. Everyone can rearrange until the host starts the game.
            </p>

            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <DropZone id={UNASSIGNED} label="Unassigned" emptyHint="Drop players here to unassign">
                    {unassigned.map((p) => (
                        <DraggablePlayer key={p.id} id={p.id} name={p.displayName} />
                    ))}
                </DropZone>

                <div className="grid gap-3 sm:grid-cols-2">
                    {snapshot.map((t) =>
                        t.id ? (
                        <DropZone key={t.id} id={t.id} label={t.name} emptyHint="Drop players here">
                            {game.players
                                .filter((p) => p.teamId === t.id)
                                .map((p) => (
                                    <DraggablePlayer key={p.id} id={p.id} name={p.displayName} />
                                ))}
                        </DropZone>
                        ) : null,
                    )}
                </div>

                <DragOverlay>
                    {activePlayer ? (
                        <span className="rounded-xl border border-[var(--game-accent)] bg-[var(--game-surface-2)] px-3 py-2 text-sm font-medium shadow-lg">
                            {activePlayer.displayName}
                        </span>
                    ) : null}
                </DragOverlay>
            </DndContext>

            <button
                type="button"
                className="self-start rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-[var(--game-text)] touch-manipulation active:bg-white/10 disabled:opacity-45"
                disabled={teamsMutation.isPending}
                onClick={addTeam}
            >
                + Add team
            </button>

            {teamsMutation.isError ? (
                <p className="text-sm text-[var(--game-warn)]">{(teamsMutation.error as Error).message}</p>
            ) : null}
            {!validation.ok && validation.message ? (
                <p className="text-sm text-[var(--game-warn)]">{validation.message}</p>
            ) : validation.ok ? (
                <p className="text-sm text-[var(--game-accent)]">Ready to start</p>
            ) : null}
        </div>
    );
}
