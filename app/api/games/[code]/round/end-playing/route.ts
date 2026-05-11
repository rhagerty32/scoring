import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, rounds } from "@/lib/db/schema";
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
  if (game.status !== "active") return badRequest("Game is not active");
  if (game.type !== "2500") return badRequest("Not a 2500 game");

  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.gameId, game.id), eq(rounds.number, game.currentRound)))
    .limit(1);
  if (!round || round.lockedAt != null) return badRequest("No open round");
  if (round.playPhase !== "playing") return badRequest("Round is not in the playing phase");

  await db
    .update(rounds)
    .set({ playPhase: "scoring", wildRank: null })
    .where(eq(rounds.id, round.id));

  return json({ ok: true });
}
