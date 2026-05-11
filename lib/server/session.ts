import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sessions, users } from "@/lib/db/schema";
import { randomHostToken, randomId } from "@/lib/ids";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/server/authConstants";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readCookieHeader(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const s = part.trim();
    if (!s.startsWith(`${name}=`)) continue;
    return decodeURIComponent(s.slice(name.length + 1).trimStart());
  }
  return undefined;
}

export function sessionCookieHeader(token: string, maxAgeSec: number): string {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAgeSec}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production";
  const parts = [`${SESSION_COOKIE_NAME}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export type SessionUser = { userId: string; username: string };

/**
 * Validates session token from the request cookie, slides `expires_at` forward on success.
 */
export async function getSessionUser(req: Request, db: LibSQLDatabase<typeof schema> = getDb()): Promise<SessionUser | null> {
  const token = readCookieHeader(req, SESSION_COOKIE_NAME);
  if (!token) return null;
  const tokenHash = sha256Hex(token);
  const now = Date.now();

  const [row] = await db
    .select({ sessionId: sessions.id, expiresAt: sessions.expiresAt, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  if (!row || row.expiresAt <= now) return null;

  const newExpires = now + SESSION_DURATION_MS;
  if (newExpires !== row.expiresAt) {
    await db.update(sessions).set({ expiresAt: newExpires }).where(eq(sessions.id, row.sessionId));
  }

  const [u] = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, row.userId)).limit(1);
  if (!u) return null;
  return { userId: u.id, username: u.username };
}

export async function createSessionForUser(
  userId: string,
  db: LibSQLDatabase<typeof schema> = getDb()
): Promise<{ token: string; setCookie: string }> {
  const token = randomHostToken();
  const tokenHash = sha256Hex(token);
  const now = Date.now();
  const sessionId = randomId();
  await db.insert(sessions).values({
    id: sessionId,
    tokenHash,
    userId,
    expiresAt: now + SESSION_DURATION_MS,
    createdAt: now,
  });
  const maxAgeSec = Math.floor(SESSION_DURATION_MS / 1000);
  return { token, setCookie: sessionCookieHeader(token, maxAgeSec) };
}

export async function deleteSessionByRequest(req: Request, db: LibSQLDatabase<typeof schema> = getDb()): Promise<void> {
  const token = readCookieHeader(req, SESSION_COOKIE_NAME);
  if (!token) return;
  const tokenHash = sha256Hex(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
