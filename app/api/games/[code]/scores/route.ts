import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { games, players, roundScores, rounds } from "@/lib/db/schema";
import { normalizeScoreTapMeta, parse2500ScorePayload } from "@/lib/games/game2500";
import { parseScorePayload } from "@/lib/games/nertz";
import { randomId } from "@/lib/ids";
import { badRequest, json, notFound, unauthorized } from "@/lib/server/httpJson";
import { finalizeOpenRoundInTransaction, selectGameById } from "@/lib/server/roundFinalize";

export const runtime = "nodejs";

const scoreMetaSchema = z
  .object({
    p5: z.coerce.number().int().min(0).max(10_000).optional(),
    m5: z.coerce.number().int().min(0).max(10_000).optional(),
    p10: z.coerce.number().int().min(0).max(10_000).optional(),
    m10: z.coerce.number().int().min(0).max(10_000).optional(),
    p100: z.coerce.number().int().min(0).max(10_000).optional(),
    m100: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .optional();

const scoreBody = z.object({
  playerId: z.string().min(1),
  score: z.coerce.number().int(),
  penalty: z.coerce.number().int(),
  bonus: z.coerce.number().int(),
  scoreMeta: scoreMetaSchema,
});

type RouteCtx = { params: Promise<{ code: string }> };

type ScoreSaveResult =
  | { error: string; status: number }
  | {
      ok: true;
      id: string;
      total: number;
      roundFinalized: boolean;
      gameStatus?: string;
      currentRound?: number;
      maxScore?: number;
    };

export async function POST(req: Request, ctx: RouteCtx) {
  const { code } = await ctx.params;
  const playerToken = req.headers.get("x-player-token");
  if (!playerToken) return unauthorized("Missing player token");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = scoreBody.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const db = getDb();
  const normalized = code.trim().toUpperCase();

  const result: ScoreSaveResult = await db.transaction(async (tx) => {
    const [game] = await tx.select().from(games).where(eq(games.code, normalized)).limit(1);
    if (!game) return { error: "Game not found", status: 404 };
    if (game.status !== "active") return { error: "Game is not active", status: 400 };

    const [player] = await tx
      .select()
      .from(players)
      .where(and(eq(players.id, parsed.data.playerId), eq(players.gameId, game.id)))
      .limit(1);
    if (!player) return { error: "Player not in this game", status: 404 };
    if (player.playerToken !== playerToken) return { error: "Invalid player token", status: 401 };

    const [round] = await tx
      .select()
      .from(rounds)
      .where(and(eq(rounds.gameId, game.id), eq(rounds.number, game.currentRound)))
      .limit(1);
    if (!round) return { error: "No active round", status: 400 };
    if (round.lockedAt != null) return { error: "Round is locked", status: 400 };

    let totals: { score: number; penalty: number; bonus: number; total: number };
    let scoreMetaJson: string | null = null;

    if (game.type === "2500") {
      if (round.playPhase !== "scoring") {
        return { error: "The host has not ended this round yet", status: 400 };
      }
      totals = parse2500ScorePayload(parsed.data);
      scoreMetaJson =
        parsed.data.scoreMeta != null ? JSON.stringify(normalizeScoreTapMeta(parsed.data.scoreMeta)) : null;
    } else {
      const allowedBonus = new Set([0, game.roundWinBonus]);
      if (!allowedBonus.has(parsed.data.bonus)) {
        return { error: "Bonus must be 0 or the round win bonus", status: 400 };
      }
      totals = parseScorePayload(parsed.data);

      if (totals.bonus === game.roundWinBonus && game.roundWinBonus > 0) {
        const peerRows = await tx.select().from(roundScores).where(eq(roundScores.roundId, round.id));
        const takenByOther = peerRows.some(
          (row) => row.playerId !== player.id && row.bonus === game.roundWinBonus,
        );
        if (takenByOther) {
          return { error: "Another player already claimed the round win", status: 400 };
        }
      }
    }

    const [existing] = await tx
      .select()
      .from(roundScores)
      .where(and(eq(roundScores.roundId, round.id), eq(roundScores.playerId, player.id)))
      .limit(1);

    let scoreRowId: string;
    if (existing) {
      await tx
        .update(roundScores)
        .set({
          score: totals.score,
          penalty: totals.penalty,
          bonus: totals.bonus,
          total: totals.total,
          scoreMetaJson: game.type === "2500" ? scoreMetaJson : null,
        })
        .where(eq(roundScores.id, existing.id));
      scoreRowId = existing.id;
    } else {
      scoreRowId = randomId();
      await tx.insert(roundScores).values({
        id: scoreRowId,
        roundId: round.id,
        playerId: player.id,
        score: totals.score,
        penalty: totals.penalty,
        bonus: totals.bonus,
        total: totals.total,
        scoreMetaJson: game.type === "2500" ? scoreMetaJson : null,
      });
    }

    const fin = await finalizeOpenRoundInTransaction(tx, { game, openRound: round });
    if (!fin.ok) {
      if (fin.error === "already_locked") {
        return { error: "Round is locked", status: 400 };
      }
      return {
        ok: true,
        id: scoreRowId,
        total: totals.total,
        roundFinalized: false,
      };
    }

    const updatedGame = await selectGameById(tx, game.id);
    return {
      ok: true,
      id: scoreRowId,
      total: totals.total,
      roundFinalized: true,
      gameStatus: updatedGame?.status ?? (fin.status === "done" ? "done" : "active"),
      currentRound:
        updatedGame?.currentRound ?? (fin.status === "active" ? fin.currentRound : game.currentRound),
      maxScore: fin.maxScore,
    };
  });

  if ("error" in result) {
    if (result.status === 404) return notFound(result.error);
    if (result.status === 401) return unauthorized(result.error);
    return badRequest(result.error);
  }

  return json({
    ok: true,
    id: result.id,
    total: result.total,
    roundFinalized: result.roundFinalized,
    ...(result.roundFinalized
      ? {
          gameStatus: result.gameStatus,
          currentRound: result.currentRound,
          maxScore: result.maxScore,
        }
      : {}),
  });
}
