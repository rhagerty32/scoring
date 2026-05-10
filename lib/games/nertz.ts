export const SCORE_MIN = 0;
export const SCORE_MAX = 9999;

export function computeRoundTotal(score: number, penalty: number, bonus: number): number {
  return score - penalty + bonus;
}

/** Fewer is better. Null means no reliable pace yet. */
export function estimatedRoundsToTarget(
  cumulativeNow: number,
  perRoundNet: number[],
  target: number
): number | null {
  if (cumulativeNow >= target) return 0;
  if (perRoundNet.length === 0) return null;
  const n = perRoundNet.length;
  const sum = perRoundNet.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  if (avg <= 0) return null;
  const remaining = target - cumulativeNow;
  return Math.ceil(remaining / avg);
}

export function perRoundNetsFromCumulative(cumulativeSeries: number[]): number[] {
  if (cumulativeSeries.length === 0) return [];
  const nets: number[] = [cumulativeSeries[0]!];
  for (let i = 1; i < cumulativeSeries.length; i++) {
    nets.push(cumulativeSeries[i]! - cumulativeSeries[i - 1]!);
  }
  return nets;
}

export type ProjectionRow = {
  playerId: string;
  estimatedRoundsRemaining: number | null;
};

export function projectFavorites(
  playerIds: string[],
  cumulativeByPlayer: Map<string, number[]>,
  target: number
): ProjectionRow[] {
  return playerIds.map((playerId) => {
    const cum = cumulativeByPlayer.get(playerId) ?? [];
    const cumulativeNow = cum.length ? cum[cum.length - 1]! : 0;
    const nets = perRoundNetsFromCumulative(cum);
    const est = estimatedRoundsToTarget(cumulativeNow, nets, target);
    return { playerId, estimatedRoundsRemaining: est };
  });
}

export function parseScorePayload(input: {
  score: unknown;
  penalty: unknown;
  bonus: unknown;
}): { score: number; penalty: number; bonus: number; total: number } {
  const score = clampInt(input.score, SCORE_MIN, SCORE_MAX);
  const penalty = clampInt(input.penalty, SCORE_MIN, SCORE_MAX);
  const bonus = clampInt(input.bonus, SCORE_MIN, SCORE_MAX);
  return { score, penalty, bonus, total: computeRoundTotal(score, penalty, bonus) };
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
