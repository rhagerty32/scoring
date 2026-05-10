import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, rounds } from "@/lib/db/schema";
import { badRequest, json, notFound, unauthorized } from "@/lib/server/httpJson";
import { finalizeOpenRoundInTransaction } from "@/lib/server/roundFinalize";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ code: string }> };

type TxResult =
  | { error: "not_found" }
  | { error: "unauthorized" }
  | { error: "bad_state"; message: string }
  | { ok: true; status: "done"; maxScore: number }
  | { ok: true; status: "active"; currentRound: number; maxScore: number };

export async function POST(req: Request, ctx: RouteCtx) {
  const { code } = await ctx.params;
  const hostToken = req.headers.get("x-host-token");
  if (!hostToken) return unauthorized("Missing host token");

  const db = getDb();
  const normalized = code.trim().toUpperCase();

  const result: TxResult = await db.transaction(async (tx) => {
    const [game] = await tx.select().from(games).where(eq(games.code, normalized)).limit(1);
    if (!game) return { error: "not_found" };
    if (game.hostToken !== hostToken) return { error: "unauthorized" };
    if (game.status !== "active") return { error: "bad_state", message: "Game is not active" };

    const [openRound] = await tx
      .select()
      .from(rounds)
      .where(and(eq(rounds.gameId, game.id), eq(rounds.number, game.currentRound)))
      .limit(1);
    if (!openRound) return { error: "bad_state", message: "No current round" };

    const fin = await finalizeOpenRoundInTransaction(tx, { game, openRound });
    if (!fin.ok) {
      if (fin.error === "already_locked") return { error: "bad_state", message: fin.message };
      return { error: "bad_state", message: fin.message };
    }
    return fin;
  });

  if ("error" in result) {
    if (result.error === "not_found") return notFound("Game not found");
    if (result.error === "unauthorized") return unauthorized("Invalid host token");
    return badRequest(result.message);
  }

  return json(result);
}
