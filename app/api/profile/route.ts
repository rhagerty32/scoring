import { json, unauthorized } from "@/lib/server/httpJson";
import { loadProfileSummaries } from "@/lib/server/profileGames";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSessionUser(req);
  if (!session) return unauthorized();

  const { games, wins, losses, active } = await loadProfileSummaries(session.userId);
  const playedFinished = wins + losses;

  return json({
    username: session.username,
    stats: {
      gamesPlayed: games.length,
      finishedGames: playedFinished,
      wins,
      losses,
      activeGames: active,
    },
    games,
  });
}
