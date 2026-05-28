import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players, roundScores, rounds, teams } from "@/lib/db/schema";

export async function loadGameBundleByCode(code: string) {
  const db = getDb();
  const normalized = code.trim().toUpperCase();
  const [game] = await db.select().from(games).where(eq(games.code, normalized)).limit(1);
  if (!game) return null;

  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.gameId, game.id))
    .orderBy(asc(teams.sortOrder));

  const playerRows = await db
    .select()
    .from(players)
    .where(eq(players.gameId, game.id))
    .orderBy(asc(players.joinedAt));
  const roundRows = await db
    .select()
    .from(rounds)
    .where(eq(rounds.gameId, game.id))
    .orderBy(asc(rounds.number));

  const roundIds = roundRows.map((r) => r.id);
  const scoreRows =
    roundIds.length === 0
      ? []
      : await db.select().from(roundScores).where(inArray(roundScores.roundId, roundIds));

  return { game, teams: teamRows, players: playerRows, rounds: roundRows, scores: scoreRows };
}
