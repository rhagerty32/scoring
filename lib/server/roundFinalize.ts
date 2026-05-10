import { asc, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { GameRow, RoundRow } from "@/lib/db/schema";
import { games, players, roundScores, rounds } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";
import { randomId } from "@/lib/ids";

type DB = LibSQLDatabase<typeof schema>;
export type GameDbTransaction = Parameters<Parameters<DB["transaction"]>[0]>[0];

export function maxCumulativeAfterLock(input: {
  playerIds: string[];
  lockedRounds: { id: string; number: number }[];
  scoresByRoundId: Map<string, Map<string, number>>;
}): number {
  const sorted = input.lockedRounds.slice().sort((a, b) => a.number - b.number);
  const totals = new Map<string, number>();
  for (const pid of input.playerIds) totals.set(pid, 0);
  for (const r of sorted) {
    const map = input.scoresByRoundId.get(r.id);
    if (!map) continue;
    for (const pid of input.playerIds) {
      totals.set(pid, (totals.get(pid) ?? 0) + (map.get(pid) ?? 0));
    }
  }
  let max = 0;
  for (const v of totals.values()) max = Math.max(max, v);
  return max;
}

export type FinalizeOpenRoundResult =
  | { ok: false; error: "already_locked"; message: string }
  | { ok: false; error: "incomplete"; message: string }
  | { ok: true; status: "done"; maxScore: number }
  | { ok: true; status: "active"; currentRound: number; maxScore: number };

/**
 * Locks the current open round, ends the game or creates the next round.
 * Call only when every player has a score row for this round; otherwise returns `incomplete`.
 */
export async function finalizeOpenRoundInTransaction(
  tx: GameDbTransaction,
  input: { game: GameRow; openRound: RoundRow }
): Promise<FinalizeOpenRoundResult> {
  const { game, openRound } = input;

  if (openRound.lockedAt != null) {
    return { ok: false, error: "already_locked", message: "Round already locked" };
  }

  const playerRows = await tx.select().from(players).where(eq(players.gameId, game.id));
  const submitted = await tx.select().from(roundScores).where(eq(roundScores.roundId, openRound.id));
  if (submitted.length < playerRows.length) {
    return { ok: false, error: "incomplete", message: "All players must submit scores first" };
  }

  const now = Date.now();
  await tx.update(rounds).set({ lockedAt: now }).where(eq(rounds.id, openRound.id));

  const lockedRoundRows = await tx
    .select()
    .from(rounds)
    .where(eq(rounds.gameId, game.id))
    .orderBy(asc(rounds.number));

  const locked = lockedRoundRows.filter((r) => r.lockedAt != null);
  const roundIds = locked.map((r) => r.id);
  const scoreRows =
    roundIds.length === 0 ? [] : await tx.select().from(roundScores).where(inArray(roundScores.roundId, roundIds));

  const scoresByRoundId = new Map<string, Map<string, number>>();
  for (const s of scoreRows) {
    const m = scoresByRoundId.get(s.roundId) ?? new Map();
    m.set(s.playerId, s.total);
    scoresByRoundId.set(s.roundId, m);
  }

  const playerIds = playerRows.map((p) => p.id);
  const maxScore = maxCumulativeAfterLock({ playerIds, lockedRounds: locked, scoresByRoundId });

  if (maxScore >= game.targetScore) {
    await tx.update(games).set({ status: "done" }).where(eq(games.id, game.id));
    return { ok: true, status: "done", maxScore };
  }

  const nextNum = game.currentRound + 1;
  const nextId = randomId();
  await tx.insert(rounds).values({
    id: nextId,
    gameId: game.id,
    number: nextNum,
    lockedAt: null,
  });
  await tx.update(games).set({ currentRound: nextNum }).where(eq(games.id, game.id));
  return { ok: true, status: "active", currentRound: nextNum, maxScore };
}

/** Re-load game row inside a transaction (e.g. after finalize updates status / round). */
export async function selectGameById(tx: GameDbTransaction, gameId: string) {
  const [row] = await tx.select().from(games).where(eq(games.id, gameId)).limit(1);
  return row ?? null;
}
