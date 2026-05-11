import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players } from "@/lib/db/schema";
import { loadGameBundleByCode } from "@/lib/server/loadGame";
import { buildPublicGameState } from "@/lib/server/gameState";
import { json, notFound, unauthorized } from "@/lib/server/httpJson";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  const session = await getSessionUser(req);
  if (!session) return unauthorized();

  const { code } = await ctx.params;
  const normalized = code.trim().toUpperCase();
  const db = getDb();

  const [game] = await db.select().from(games).where(eq(games.code, normalized)).limit(1);
  if (!game) return notFound("Game not found");

  const [seat] = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.gameId, game.id), eq(players.userId, session.userId)))
    .orderBy(desc(players.joinedAt))
    .limit(1);
  if (!seat) return notFound("You did not play in this game");

  const bundle = await loadGameBundleByCode(normalized);
  if (!bundle) return notFound("Game not found");

  const state = buildPublicGameState({
    game: bundle.game,
    players: bundle.players,
    rounds: bundle.rounds,
    scores: bundle.scores,
    hostTokenHeader: null,
  });

  return json({ state, yourPlayerId: seat.id });
}
