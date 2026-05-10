const CLIENT_KEY = "scoring:clientKey";

/** UUID v4; `randomUUID` is omitted on http + non-localhost (e.g. LAN dev on a phone). */
function newClientKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (!c || typeof c.getRandomValues !== "function") {
    return `k-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
  const buf = new Uint8Array(16);
  c.getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const h = [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getOrCreateClientKey(): string {
  if (typeof window === "undefined") return "";
  let k = window.localStorage.getItem(CLIENT_KEY);
  if (!k) {
    k = newClientKey();
    window.localStorage.setItem(CLIENT_KEY, k);
  }
  return k;
}

export function hostTokenKey(code: string) {
  return `scoring:host:${code.toUpperCase()}`;
}

export function playerKey(code: string) {
  return `scoring:player:${code.toUpperCase()}`;
}

export type StoredPlayer = { playerId: string; playerToken: string };

export function readStoredPlayer(code: string): StoredPlayer | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(playerKey(code));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as StoredPlayer;
    if (v.playerId && v.playerToken) return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredPlayer(code: string, p: StoredPlayer) {
  window.localStorage.setItem(playerKey(code), JSON.stringify(p));
}

export function readHostToken(code: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(hostTokenKey(code));
}

export function writeHostToken(code: string, token: string) {
  window.sessionStorage.setItem(hostTokenKey(code), token);
}

const SHOW_STANDINGS_KEY = "scoring:showStandings";

/** Whether the standings table and score chart are expanded in the game room. */
export function readShowStandings(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SHOW_STANDINGS_KEY) === "1";
}

export function writeShowStandings(visible: boolean) {
  window.localStorage.setItem(SHOW_STANDINGS_KEY, visible ? "1" : "0");
}
