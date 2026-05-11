import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { randomId } from "@/lib/ids";
import { badRequest, conflict, json } from "@/lib/server/httpJson";
import { hashPassword } from "@/lib/server/password";
import { createSessionForUser } from "@/lib/server/session";
import { normalizeUsername } from "@/lib/username";

export const runtime = "nodejs";

const bodySchema = z.object({
  username: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(128),
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
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing) return conflict("Username already taken");

  const now = Date.now();
  const userId = randomId();
  await db.insert(users).values({
    id: userId,
    username,
    passwordHash: hashPassword(parsed.data.password),
    createdAt: now,
  });

  const { setCookie } = await createSessionForUser(userId, db);
  return json({ ok: true, username }, { headers: { "set-cookie": setCookie } });
}
