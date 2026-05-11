import { desc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { games, players } from "@/lib/db/schema";
import { loadGameBundleByCode } from "@/lib/server/loadGame";
import { buildPublicGameState } from "@/lib/server/gameState";

export type ProfileGameSummary = {
  code: string;
  type: string;
  status: string;
  createdAt: number;
  displayName: string;
  playerId: string;
  /** Null if the game is not finished yet. */
  won: boolean | null;
};

export async function loadProfileSummaries(
  userId: string,
  db: LibSQLDatabase<typeof schema> = getDb()
): Promise<{ games: ProfileGameSummary[]; wins: number; losses: number; active: number }> {
  const rows = await db
    .select({
      game: games,
      playerId: players.id,
      displayName: players.displayName,
      joinedAt: players.joinedAt,
    })
    .from(players)
    .innerJoin(games, eq(players.gameId, games.id))
    .where(eq(players.userId, userId))
    .orderBy(desc(games.createdAt));

  const bestByGame = new Map<
    string,
    { game: (typeof rows)[0]["game"]; playerId: string; displayName: string; joinedAt: number }
  >();
  for (const r of rows) {
    const prev = bestByGame.get(r.game.id);
    if (!prev || r.joinedAt >= prev.joinedAt) {
      bestByGame.set(r.game.id, {
        game: r.game,
        playerId: r.playerId,
        displayName: r.displayName,
        joinedAt: r.joinedAt,
      });
    }
  }

  const ordered = [...bestByGame.values()].sort((a, b) => b.game.createdAt - a.game.createdAt);

  let wins = 0;
  let losses = 0;
  let active = 0;

  const summaries: ProfileGameSummary[] = [];

  for (const { game, playerId, displayName } of ordered) {
    let won: boolean | null = null;
    if (game.status === "done") {
      const bundle = await loadGameBundleByCode(game.code);
      if (bundle) {
        const state = buildPublicGameState({
          game: bundle.game,
          players: bundle.players,
          rounds: bundle.rounds,
          scores: bundle.scores,
          hostTokenHeader: null,
        });
        if (state.winnerPlayerIds.length > 0) {
          const isWinner = state.winnerPlayerIds.includes(playerId);
          won = isWinner;
          if (isWinner) wins += 1;
          else losses += 1;
        } else {
          won = null;
        }
      }
    } else {
      active += 1;
    }

    summaries.push({
      code: game.code,
      type: game.type,
      status: game.status,
      createdAt: game.createdAt,
      displayName,
      playerId,
      won,
    });
  }

  return { games: summaries, wins, losses, active };
}
