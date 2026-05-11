import { json } from "@/lib/server/httpJson";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSessionUser(req);
  if (!session) return json({ user: null });
  return json({ user: { id: session.userId, username: session.username } });
}
