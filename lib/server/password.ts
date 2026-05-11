import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PREFIX = "scrypt1";
const SALT_LEN = 16;
const KEYLEN = 32;

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(plain, salt, KEYLEN, { N: 16384, r: 8, p: 1 });
  return `${PREFIX}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const salt = Buffer.from(parts[1]!, "base64");
  const expected = Buffer.from(parts[2]!, "base64");
  if (salt.length !== SALT_LEN || expected.length !== KEYLEN) return false;
  const hash = scryptSync(plain, salt, KEYLEN, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(hash, expected);
}
