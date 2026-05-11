import { json } from "@/lib/server/httpJson";
import { clearSessionCookieHeader, deleteSessionByRequest } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await deleteSessionByRequest(req);
  return json({ ok: true }, { headers: { "set-cookie": clearSessionCookieHeader() } });
}
