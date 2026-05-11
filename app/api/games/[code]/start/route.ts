import { count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players, rounds } from "@/lib/db/schema";
import { randomId } from "@/lib/ids";
import { badRequest, json, notFound, unauthorized } from "@/lib/server/httpJson";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const { code } = await ctx.params;
  const hostToken = req.headers.get("x-host-token");
  if (!hostToken) return unauthorized("Missing host token");

  const db = getDb();
  const normalized = code.trim().toUpperCase();
  const [game] = await db.select().from(games).where(eq(games.code, normalized)).limit(1);
  if (!game) return notFound("Game not found");
  if (game.hostToken !== hostToken) return unauthorized("Invalid host token");
  if (game.status !== "lobby") return badRequest("Game already started");

  const [{ c }] = await db.select({ c: count() }).from(players).where(eq(players.gameId, game.id));
  if (c < 1) return badRequest("Need at least one player");

  const roundId = randomId();
  const now = Date.now();

  await db.transaction(async (tx) => {
    await tx
      .update(games)
      .set({ status: "active", currentRound: 1 })
      .where(eq(games.id, game.id));
    await tx.insert(rounds).values({
      id: roundId,
      gameId: game.id,
      number: 1,
      lockedAt: null,
      ...(game.type === "2500"
        ? { playPhase: "playing", wildRank: null, rankClaimsJson: "{}" }
        : { playPhase: null, wildRank: null, rankClaimsJson: null }),
    });
  });

  return json({ ok: true, currentRound: 1, roundId, startedAt: now });
}
