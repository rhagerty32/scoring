import { count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players, rounds, teams } from "@/lib/db/schema";
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

  const playerRows = await db.select().from(players).where(eq(players.gameId, game.id));
  if (playerRows.length < 1) return badRequest("Need at least one player");

  if (game.type === "hand-and-foot") {
    const teamRows = await db.select().from(teams).where(eq(teams.gameId, game.id));
    if (teamRows.length < 2) return badRequest("Need at least two teams");
    const unassigned = playerRows.filter((p) => p.teamId == null);
    if (unassigned.length > 0) {
      return badRequest("Every player must be assigned to a team before starting");
    }
    const teamCounts = new Map<string, number>();
    for (const p of playerRows) {
      if (p.teamId) teamCounts.set(p.teamId, (teamCounts.get(p.teamId) ?? 0) + 1);
    }
    for (const t of teamRows) {
      if ((teamCounts.get(t.id) ?? 0) < 1) {
        return badRequest("Each team needs at least one player");
      }
    }
  }

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
      ...(game.type === "2500" || game.type === "hand-and-foot"
        ? { playPhase: "playing", wildRank: null, rankClaimsJson: "{}" }
        : { playPhase: null, wildRank: null, rankClaimsJson: null }),
    });
  });

  return json({ ok: true, currentRound: 1, roundId, startedAt: now });
}
