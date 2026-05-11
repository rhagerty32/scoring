import { like } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { badRequest, json } from "@/lib/server/httpJson";
import { normalizeUsername } from "@/lib/username";

export const runtime = "nodejs";

const LIMIT = 20;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qRaw = url.searchParams.get("q") ?? "";
  const q = normalizeUsername(qRaw);
  if (q.length < 1) return json({ usernames: [] as string[] });
  if (q.length > 32) return badRequest("Query too long");
  if (!/^[a-z0-9_]*$/.test(q)) return json({ usernames: [] as string[] });

  const db = getDb();
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(like(users.username, `${q}%`))
    .orderBy(users.username)
    .limit(LIMIT);

  return json({ usernames: rows.map((r) => r.username) });
}
