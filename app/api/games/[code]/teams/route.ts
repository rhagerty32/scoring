import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { games, players, teams } from "@/lib/db/schema";
import { randomId } from "@/lib/ids";
import { buildPublicGameState } from "@/lib/server/gameState";
import { badRequest, json, notFound, unauthorized } from "@/lib/server/httpJson";
import { loadGameBundleByCode } from "@/lib/server/loadGame";

export const runtime = "nodejs";

const teamSnapshotSchema = z.object({
  teams: z.array(
    z.object({
      id: z.string().min(1).optional(),
      name: z.string().min(1).max(64),
      playerIds: z.array(z.string().min(1)),
    }),
  ),
});

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
  const parsed = teamSnapshotSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const db = getDb();
  const normalized = code.trim().toUpperCase();

  const [game] = await db.select().from(games).where(eq(games.code, normalized)).limit(1);
  if (!game) return notFound("Game not found");
  if (game.status !== "lobby") return badRequest("Teams can only be edited in the lobby");
  if (game.type !== "hand-and-foot") return badRequest("This game does not use teams");

  const playerRows = await db.select().from(players).where(eq(players.gameId, game.id));
  const playerById = new Map(playerRows.map((p) => [p.id, p]));

  const submitter = playerRows.find((p) => p.playerToken === playerToken);
  if (!submitter) return unauthorized("Invalid player token");

  const allPlayerIds = new Set<string>();
  for (const t of parsed.data.teams) {
    for (const pid of t.playerIds) {
      if (!playerById.has(pid)) return badRequest("Unknown player in team");
      if (allPlayerIds.has(pid)) return badRequest("Each player can only be on one team");
      allPlayerIds.add(pid);
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(teams).where(eq(teams.gameId, game.id));

    const teamIds: { id: string; playerIds: string[] }[] = [];
    for (let i = 0; i < parsed.data.teams.length; i++) {
      const t = parsed.data.teams[i]!;
      const teamId = t.id ?? randomId();
      await tx.insert(teams).values({
        id: teamId,
        gameId: game.id,
        name: t.name.trim(),
        sortOrder: i,
      });
      teamIds.push({ id: teamId, playerIds: t.playerIds });
    }

    for (const p of playerRows) {
      await tx.update(players).set({ teamId: null }).where(eq(players.id, p.id));
    }

    for (const { id: teamId, playerIds } of teamIds) {
      for (const pid of playerIds) {
        await tx.update(players).set({ teamId }).where(eq(players.id, pid));
      }
    }
  });

  const bundle = await loadGameBundleByCode(code);
  if (!bundle) return notFound("Game not found");

  const hostTokenHeader = req.headers.get("x-host-token");
  return json(buildPublicGameState({ ...bundle, hostTokenHeader }));
}
