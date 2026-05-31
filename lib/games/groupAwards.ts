/** Per-player stats accumulated over locked rounds only. */
export type PlayerLockedAgg = {
  playerId: string;
  sumPenalty: number;
  sumScore: number;
  sumTotal: number;
  negativeRounds: number;
  bonusWins: number;
  wentOutRounds?: number;
};

export type GroupAward = {
  id: string;
  title: string;
  playerIds: string[];
};

const AWARD_TITLES: Record<string, string> = {
  most_penalty: "Chief Drawpile Liability",
  most_negative_rounds: "Certified Round L",
  most_bonus_wins: "Professional Closer",
  lowest_avg_net: "Statistically the Couch",
  highest_avg_score: "Card Volume Enjoyer",
  most_went_out: "First to the Door",
};

function winnersByMax(values: Map<string, number>): string[] {
  let max = -Infinity;
  for (const v of values.values()) if (v > max) max = v;
  if (!Number.isFinite(max)) return [];
  const ids: string[] = [];
  for (const [id, v] of values) if (v === max) ids.push(id);
  return ids;
}

function winnersByMin(values: Map<string, number>): string[] {
  let min = Infinity;
  for (const v of values.values()) if (v < min) min = v;
  if (!Number.isFinite(min)) return [];
  const ids: string[] = [];
  for (const [id, v] of values) if (v === min) ids.push(id);
  return ids;
}

function allSame(nums: number[]): boolean {
  if (nums.length === 0) return true;
  const f = nums[0]!;
  return nums.every((n) => n === f);
}

/**
 * Builds whimsical group awards from locked-round aggregates.
 * Omits an award when every player ties on that metric (no distinction).
 */
export function computeGroupAwards(
  aggs: PlayerLockedAgg[],
  numLocked: number,
  roundWinBonus: number,
  include2500Awards = false,
): GroupAward[] {
  if (numLocked <= 0 || aggs.length === 0) return [];

  const awards: GroupAward[] = [];

  const penalties = aggs.map((a) => a.sumPenalty);
  if (!allSame(penalties)) {
    const penaltyMap = new Map(aggs.map((a) => [a.playerId, a.sumPenalty]));
    const ids = winnersByMax(penaltyMap);
    if (ids.length > 0) awards.push({ id: "most_penalty", title: AWARD_TITLES.most_penalty!, playerIds: ids });
  }

  const negs = aggs.map((a) => a.negativeRounds);
  if (!allSame(negs) && negs.some((n) => n > 0)) {
    const negMap = new Map(aggs.map((a) => [a.playerId, a.negativeRounds]));
    const ids = winnersByMax(negMap);
    if (ids.length > 0) {
      awards.push({ id: "most_negative_rounds", title: AWARD_TITLES.most_negative_rounds!, playerIds: ids });
    }
  }

  if (roundWinBonus > 0) {
    const wins = aggs.map((a) => a.bonusWins);
    if (!allSame(wins) && wins.some((w) => w > 0)) {
      const bonusMap = new Map(aggs.map((a) => [a.playerId, a.bonusWins]));
      const ids = winnersByMax(bonusMap);
      if (ids.length > 0) awards.push({ id: "most_bonus_wins", title: AWARD_TITLES.most_bonus_wins!, playerIds: ids });
    }
  }

  const avgNets = aggs.map((a) => a.sumTotal / numLocked);
  if (!allSame(avgNets)) {
    const avgNetMap = new Map(aggs.map((a) => [a.playerId, a.sumTotal / numLocked]));
    const ids = winnersByMin(avgNetMap);
    if (ids.length > 0) awards.push({ id: "lowest_avg_net", title: AWARD_TITLES.lowest_avg_net!, playerIds: ids });
  }

  const avgScores = aggs.map((a) => a.sumScore / numLocked);
  if (!allSame(avgScores)) {
    const avgScoreMap = new Map(aggs.map((a) => [a.playerId, a.sumScore / numLocked]));
    const ids = winnersByMax(avgScoreMap);
    if (ids.length > 0) awards.push({ id: "highest_avg_score", title: AWARD_TITLES.highest_avg_score!, playerIds: ids });
  }

  if (include2500Awards) {
    const wentOuts = aggs.map((a) => a.wentOutRounds ?? 0);
    if (!allSame(wentOuts) && wentOuts.some((n) => n > 0)) {
      const wentOutMap = new Map(aggs.map((a) => [a.playerId, a.wentOutRounds ?? 0]));
      const ids = winnersByMax(wentOutMap);
      if (ids.length > 0) awards.push({ id: "most_went_out", title: AWARD_TITLES.most_went_out!, playerIds: ids });
    }
  }

  return awards;
}
