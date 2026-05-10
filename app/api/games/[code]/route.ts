import { buildPublicGameState } from "@/lib/server/gameState";
import { notFound, json } from "@/lib/server/httpJson";
import { loadGameBundleByCode } from "@/lib/server/loadGame";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  const { code } = await ctx.params;
  const bundle = await loadGameBundleByCode(code);
  if (!bundle) return notFound("Game not found");

  const hostTokenHeader = req.headers.get("x-host-token");
  const payload = buildPublicGameState({ ...bundle, hostTokenHeader });
  return json(payload);
}
