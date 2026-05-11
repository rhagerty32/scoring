import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { badRequest, json, unauthorized } from "@/lib/server/httpJson";
import { verifyPassword } from "@/lib/server/password";
import { createSessionForUser } from "@/lib/server/session";
import { normalizeUsername } from "@/lib/username";

export const runtime = "nodejs";

const bodySchema = z.object({
  username: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const username = normalizeUsername(parsed.data.username);
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return unauthorized("Invalid username or password");
  }

  const { setCookie } = await createSessionForUser(user.id, db);
  return json({ ok: true, username: user.username }, { headers: { "set-cookie": setCookie } });
}
