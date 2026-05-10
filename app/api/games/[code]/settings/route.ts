import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { badRequest, json, notFound, unauthorized } from "@/lib/server/httpJson";

export const runtime = "nodejs";

const patchBody = z.object({
  targetScore: z.coerce.number().int().min(1).max(100_000).optional(),
  roundWinBonus: z.coerce.number().int().min(0).max(1000).optional(),
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
  if (!hasTarget && !hasBonus) return badRequest("Nothing to update");

  const db = getDb();
  const normalized = code.trim().toUpperCase();
  const [game] = await db.select().from(games).where(eq(games.code, normalized)).limit(1);
  if (!game) return notFound("Game not found");
  if (game.hostToken !== hostToken) return unauthorized("Invalid host token");
  if (game.status !== "lobby") return badRequest("Settings locked after the game starts");

  const nextTarget = hasTarget ? parsed.data.targetScore! : game.targetScore;
  const nextBonus = hasBonus ? parsed.data.roundWinBonus! : game.roundWinBonus;

  await db
    .update(games)
    .set({ targetScore: nextTarget, roundWinBonus: nextBonus })
    .where(eq(games.id, game.id));

  return json({ ok: true, targetScore: nextTarget, roundWinBonus: nextBonus });
}
