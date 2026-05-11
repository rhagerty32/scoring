import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { games, players } from "@/lib/db/schema";
import { randomId, randomHostToken } from "@/lib/ids";
import { badRequest, conflict, json, notFound } from "@/lib/server/httpJson";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

const joinBody = z.object({
  displayName: z.string().trim().min(1).max(40),
  clientKey: z.string().trim().min(1).max(128).optional(),
});

type RouteCtx = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const { code } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = joinBody.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const db = getDb();
  const sessionUser = await getSessionUser(req, db);
  const normalized = code.trim().toUpperCase();
  const [game] = await db.select().from(games).where(eq(games.code, normalized)).limit(1);
  if (!game) return notFound("Game not found");
  if (game.status === "done") return conflict("Game finished");

  if (parsed.data.clientKey) {
    const [existing] = await db
      .select()
      .from(players)
      .where(and(eq(players.gameId, game.id), eq(players.clientKey, parsed.data.clientKey)))
      .limit(1);
    if (existing) {
      if (sessionUser && existing.userId === null) {
        await db.update(players).set({ userId: sessionUser.userId }).where(eq(players.id, existing.id));
      }
      return json({ playerId: existing.id, playerToken: existing.playerToken });
    }
  }

  const now = Date.now();
  const playerId = randomId();
  const playerToken = randomHostToken();

  try {
    await db.insert(players).values({
      id: playerId,
      gameId: game.id,
      displayName: parsed.data.displayName,
      playerToken,
      clientKey: parsed.data.clientKey ?? null,
      joinedAt: now,
      userId: sessionUser?.userId ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE") && parsed.data.clientKey) {
      const [existing] = await db
        .select()
        .from(players)
        .where(and(eq(players.gameId, game.id), eq(players.clientKey, parsed.data.clientKey)))
        .limit(1);
      if (existing) {
        if (sessionUser && existing.userId === null) {
          await db.update(players).set({ userId: sessionUser.userId }).where(eq(players.id, existing.id));
        }
        return json({ playerId: existing.id, playerToken: existing.playerToken });
      }
    }
    throw e;
  }

  return json({ playerId, playerToken });
}
