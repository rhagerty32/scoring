import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { games, players, roundScores, rounds } from "@/lib/db/schema";
import { badRequest, json, notFound, unauthorized } from "@/lib/server/httpJson";
import { maxCumulativeAfterLock } from "@/lib/server/roundFinalize";

export const runtime = "nodejs";

const patchBody = z.object({
  targetScore: z.coerce.number().int().min(1).max(100_000).optional(),
  roundWinBonus: z.coerce.number().int().min(0).max(1000).optional(),
  showPlayedCards: z.boolean().optional(),
});

type RouteCtx = { params: Promise<{ code: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { code } = await ctx.params;
  const hostToken = req.headers.get("x-host-token");
  if (!hostToken) return unauthorized("Missing host token");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = patchBody.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");
  const hasTarget = parsed.data.targetScore !== undefined;
  const hasBonus = parsed.data.roundWinBonus !== undefined;
  const hasShowPlayed = parsed.data.showPlayedCards !== undefined;
  if (!hasTarget && !hasBonus && !hasShowPlayed) return badRequest("Nothing to update");

  const db = getDb();
  const normalized = code.trim().toUpperCase();
  const [game] = await db.select().from(games).where(eq(games.code, normalized)).limit(1);
  if (!game) return notFound("Game not found");
  if (game.hostToken !== hostToken) return unauthorized("Invalid host token");

  const midGame2500Settings =
    game.status === "active" &&
    game.type === "2500" &&
    !hasBonus &&
    (hasTarget || hasShowPlayed);
  if (game.status === "lobby") {
    // Lobby: full settings edits allowed.
  } else if (midGame2500Settings) {
    // Active 2500: host may change target score and meld tracker visibility.
  } else {
    return badRequest("Settings locked after the game starts");
  }

  if (hasShowPlayed && game.type !== "2500") {
    return badRequest("Meld tracker visibility applies only to 2500 games");
  }

  if (game.status === "active" && hasBonus) {
    return badRequest("Round win bonus cannot be changed after the game starts");
  }

  const nextTarget = hasTarget ? parsed.data.targetScore! : game.targetScore;
  const nextBonus = hasBonus ? parsed.data.roundWinBonus! : game.roundWinBonus;
  const nextShowPlayed = hasShowPlayed
    ? parsed.data.showPlayedCards!
      ? 1
      : 0
    : game.showPlayedCards;

  let nextStatus = game.status;
  if (midGame2500Settings && hasTarget && nextTarget !== game.targetScore) {
    const lockedRoundRows = await db
      .select()
      .from(rounds)
      .where(eq(rounds.gameId, game.id))
      .orderBy(asc(rounds.number));
    const locked = lockedRoundRows.filter((r) => r.lockedAt != null);
    const roundIds = locked.map((r) => r.id);
    const scoreRows =
      roundIds.length === 0
        ? []
        : await db.select().from(roundScores).where(inArray(roundScores.roundId, roundIds));
    const scoresByRoundId = new Map<string, Map<string, number>>();
    for (const s of scoreRows) {
      const m = scoresByRoundId.get(s.roundId) ?? new Map();
      m.set(s.playerId, s.total);
      scoresByRoundId.set(s.roundId, m);
    }
    const playerRows = await db.select().from(players).where(eq(players.gameId, game.id));
    const playerIds = playerRows.map((p) => p.id);
    const maxScore = maxCumulativeAfterLock({ playerIds, lockedRounds: locked, scoresByRoundId });
    if (maxScore >= nextTarget) nextStatus = "done";
  }

  await db
    .update(games)
    .set({
      targetScore: nextTarget,
      roundWinBonus: nextBonus,
      showPlayedCards: nextShowPlayed,
      status: nextStatus,
    })
    .where(eq(games.id, game.id));

  return json({
    ok: true,
    targetScore: nextTarget,
    roundWinBonus: nextBonus,
    showPlayedCards: nextShowPlayed !== 0,
    status: nextStatus,
  });
}
