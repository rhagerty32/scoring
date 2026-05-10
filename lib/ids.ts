import { randomBytes } from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomId(): string {
  return randomBytes(16).toString("hex");
}

export function randomHostToken(): string {
  return randomBytes(32).toString("hex");
}

export function randomRoomCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]!;
  }
  return out;
}
