import { z } from "zod";
import { getDb } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { getGameDefinition } from "@/lib/games/registry";
import { randomHostToken, randomId, randomRoomCode } from "@/lib/ids";
import { badRequest, json } from "@/lib/server/httpJson";

export const runtime = "nodejs";

const createBody = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("nertz"),
    targetScore: z.coerce.number().int().min(1).max(100_000),
    roundWinBonus: z.coerce.number().int().min(0).max(1000),
  }),
  z.object({
    type: z.literal("2500"),
    targetScore: z.coerce.number().int().min(1).max(100_000),
    showPlayedCards: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("hand-and-foot"),
  }),
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = createBody.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const def = getGameDefinition(parsed.data.type);
  if (!def?.enabled) return badRequest("Game type unavailable");

  const db = getDb();
  const hostToken = randomHostToken();
  const now = Date.now();

  for (let attempt = 0; attempt < 24; attempt++) {
    const id = randomId();
    const code = randomRoomCode(6);
    try {
      const targetScore =
        parsed.data.type === "hand-and-foot" ? 0 : parsed.data.targetScore;
      const roundWinBonus =
        parsed.data.type === "nertz" ? parsed.data.roundWinBonus : 0;

      const showPlayedCards =
        parsed.data.type === "2500" && parsed.data.showPlayedCards === false ? 0 : 1;

      await db.insert(games).values({
        id,
        code,
        type: parsed.data.type,
        targetScore,
        roundWinBonus,
        showPlayedCards: parsed.data.type === "2500" ? showPlayedCards : 1,
        status: "lobby",
        currentRound: 0,
        hostToken,
        createdAt: now,
      });
      return json({ code, hostToken });
    } catch {
      // likely room code collision — retry
    }
  }

  return badRequest("Could not allocate room code");
}
