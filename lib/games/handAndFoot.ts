export const HAND_AND_FOOT_ROUNDS = 3;

export type HandAndFootScoreMeta = {
  books: number;
  cards: number;
  penalties: number;
};

const FIELD_MIN = 0;
const FIELD_MAX = 50_000;
const TOTAL_MIN = -50_000;
const TOTAL_MAX = 50_000;

function clampField(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(FIELD_MIN, Math.min(FIELD_MAX, Math.trunc(n)));
}

function clampTotal(v: number): number {
  return Math.max(TOTAL_MIN, Math.min(TOTAL_MAX, v));
}

export function normalizeHandAndFootMeta(input: Partial<HandAndFootScoreMeta>): HandAndFootScoreMeta {
  return {
    books: clampField(input.books),
    cards: clampField(input.cards),
    penalties: clampField(input.penalties),
  };
}

export function parseHandAndFootScoreMetaJson(json: string | null | undefined): HandAndFootScoreMeta | null {
  if (json == null || json === "") return null;
  try {
    const raw = JSON.parse(json) as Partial<HandAndFootScoreMeta>;
    return normalizeHandAndFootMeta(raw);
  } catch {
    return null;
  }
}

/** Net round total: books + cards − penalties (penalties entered as positive). */
export function parseHandAndFootScorePayload(input: {
  books: number;
  cards: number;
  penalties: number;
}): { score: number; penalty: number; bonus: number; total: number; meta: HandAndFootScoreMeta } {
  const meta = normalizeHandAndFootMeta(input);
  const total = clampTotal(meta.books + meta.cards - meta.penalties);
  return { score: 0, penalty: 0, bonus: 0, total, meta };
}

export const HAND_AND_FOOT_SCORING_REFERENCE = [
  "Dirty book ×300 · Clean book ×500",
  "4–7 = 5 · 8–K = 10 · A/2 = 20 · Joker = 50",
  "Black 3 = 30 off · Red 3 = 300 off",
] as const;

export function maxCumulativeTeamsAfterLock(input: {
  teamIds: string[];
  lockedRounds: { id: string; number: number }[];
  scoresByRoundId: Map<string, Map<string, number>>;
}): number {
  const sorted = input.lockedRounds.slice().sort((a, b) => a.number - b.number);
  const totals = new Map<string, number>();
  for (const tid of input.teamIds) totals.set(tid, 0);
  for (const r of sorted) {
    const map = input.scoresByRoundId.get(r.id);
    if (!map) continue;
    for (const tid of input.teamIds) {
      totals.set(tid, (totals.get(tid) ?? 0) + (map.get(tid) ?? 0));
    }
  }
  let max = 0;
  for (const v of totals.values()) max = Math.max(max, v);
  return max;
}

export function winnerTeamIdsHandAndFoot(
  teamIds: string[],
  cumulativeByTeam: Map<string, number>,
): string[] {
  if (teamIds.length === 0) return [];
  let best = -Infinity;
  for (const tid of teamIds) {
    const c = cumulativeByTeam.get(tid) ?? 0;
    if (c > best) best = c;
  }
  if (!Number.isFinite(best)) return [];
  return teamIds.filter((tid) => (cumulativeByTeam.get(tid) ?? 0) === best);
}

export function usesPlayPhase(gameType: string): boolean {
  return gameType === "2500" || gameType === "hand-and-foot";
}
