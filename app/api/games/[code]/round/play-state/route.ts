import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { games, players, rounds } from "@/lib/db/schema";
import {
  applyRankToggle,
  isValid2500Rank,
  parseRankClaimsJson,
  serializeRankClaimsJson,
} from "@/lib/games/game2500";
import { badRequest, json, notFound, unauthorized } from "@/lib/server/httpJson";

export const runtime = "nodejs";

const patchBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("wild"), wildRank: z.string().nullable() }),
  z.object({ action: z.literal("rank"), rank: z.string(), turnOn: z.boolean() }),
]);

type RouteCtx = { params: Promise<{ code: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { code } = await ctx.params;
  const playerToken = req.headers.get("x-player-token");
  if (!playerToken) return unauthorized("Missing player token");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = patchBody.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const db = getDb();
  const normalized = code.trim().toUpperCase();

  const [game] = await db.select().from(games).where(eq(games.code, normalized)).limit(1);
  if (!game) return notFound("Game not found");
  if (game.status !== "active") return badRequest("Game is not active");
  if (game.type !== "2500") return badRequest("Not a 2500 game");

  const [player] = await db.select().from(players).where(eq(players.playerToken, playerToken)).limit(1);
  if (!player || player.gameId !== game.id) return unauthorized("Invalid player token");

  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.gameId, game.id), eq(rounds.number, game.currentRound)))
    .limit(1);
  if (!round || round.lockedAt != null) return badRequest("No open round");
  if (round.playPhase !== "playing") return badRequest("Rank and wild edits are frozen during scoring");

  if (parsed.data.action === "wild") {
    const wr = parsed.data.wildRank;
    const normalizedWild = wr === "" ? null : wr;
    if (normalizedWild != null && !isValid2500Rank(normalizedWild)) {
      return badRequest("Invalid wild rank");
    }
    await db.update(rounds).set({ wildRank: normalizedWild }).where(eq(rounds.id, round.id));
    return json({ ok: true });
  }

  const claims = parseRankClaimsJson(round.rankClaimsJson);
  const res = applyRankToggle(claims, parsed.data.rank, player.id, parsed.data.turnOn);
  if (!res.ok) return badRequest(res.error);
  await db
    .update(rounds)
    .set({ rankClaimsJson: serializeRankClaimsJson(res.claims) })
    .where(eq(rounds.id, round.id));
  return json({ ok: true });
}
