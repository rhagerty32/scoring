import { describe, expect, it } from "vitest";
import { computeGroupAwards, type PlayerLockedAgg } from "./groupAwards";

function awardIds(awards: ReturnType<typeof computeGroupAwards>) {
  return awards.map((a) => a.id);
}

describe("computeGroupAwards", () => {
  it("returns empty when no locked rounds", () => {
    const aggs: PlayerLockedAgg[] = [
      { playerId: "a", sumPenalty: 0, sumScore: 10, sumTotal: 10, negativeRounds: 0, bonusWins: 0 },
    ];
    expect(computeGroupAwards(aggs, 0, 10)).toEqual([]);
  });

  it("returns empty when no players", () => {
    expect(computeGroupAwards([], 3, 10)).toEqual([]);
  });

  it("picks most_penalty and includes ties", () => {
    const aggs: PlayerLockedAgg[] = [
      { playerId: "a", sumPenalty: 20, sumScore: 30, sumTotal: 25, negativeRounds: 0, bonusWins: 0 },
      { playerId: "b", sumPenalty: 20, sumScore: 30, sumTotal: 25, negativeRounds: 0, bonusWins: 0 },
      { playerId: "c", sumPenalty: 5, sumScore: 30, sumTotal: 30, negativeRounds: 0, bonusWins: 0 },
    ];
    const awards = computeGroupAwards(aggs, 2, 10);
    const p = awards.find((x) => x.id === "most_penalty");
    expect(p?.playerIds.sort()).toEqual(["a", "b"]);
  });

  it("omits most_penalty when all tied", () => {
    const aggs: PlayerLockedAgg[] = [
      { playerId: "a", sumPenalty: 5, sumScore: 10, sumTotal: 10, negativeRounds: 0, bonusWins: 0 },
      { playerId: "b", sumPenalty: 5, sumScore: 10, sumTotal: 10, negativeRounds: 0, bonusWins: 0 },
    ];
    expect(awardIds(computeGroupAwards(aggs, 1, 10))).not.toContain("most_penalty");
  });

  it("awards most_negative_rounds only when someone has a negative round and not all tied", () => {
    const aggs: PlayerLockedAgg[] = [
      { playerId: "a", sumPenalty: 0, sumScore: 10, sumTotal: 5, negativeRounds: 2, bonusWins: 0 },
      { playerId: "b", sumPenalty: 0, sumScore: 10, sumTotal: 8, negativeRounds: 0, bonusWins: 0 },
    ];
    const awards = computeGroupAwards(aggs, 2, 10);
    const n = awards.find((x) => x.id === "most_negative_rounds");
    expect(n?.playerIds).toEqual(["a"]);
  });

  it("omits most_negative_rounds when everyone has zero negative rounds", () => {
    const aggs: PlayerLockedAgg[] = [
      { playerId: "a", sumPenalty: 0, sumScore: 10, sumTotal: 10, negativeRounds: 0, bonusWins: 0 },
      { playerId: "b", sumPenalty: 0, sumScore: 10, sumTotal: 8, negativeRounds: 0, bonusWins: 0 },
    ];
    expect(awardIds(computeGroupAwards(aggs, 1, 10))).not.toContain("most_negative_rounds");
  });

  it("omits most_bonus_wins when roundWinBonus is zero", () => {
    const aggs: PlayerLockedAgg[] = [
      { playerId: "a", sumPenalty: 0, sumScore: 10, sumTotal: 10, negativeRounds: 0, bonusWins: 3 },
      { playerId: "b", sumPenalty: 0, sumScore: 10, sumTotal: 10, negativeRounds: 0, bonusWins: 0 },
    ];
    expect(awardIds(computeGroupAwards(aggs, 2, 0))).not.toContain("most_bonus_wins");
  });

  it("awards most_bonus_wins when bonus applies and not all tied", () => {
    const aggs: PlayerLockedAgg[] = [
      { playerId: "a", sumPenalty: 0, sumScore: 10, sumTotal: 20, negativeRounds: 0, bonusWins: 2 },
      { playerId: "b", sumPenalty: 0, sumScore: 10, sumTotal: 10, negativeRounds: 0, bonusWins: 0 },
    ];
    const awards = computeGroupAwards(aggs, 2, 10);
    const w = awards.find((x) => x.id === "most_bonus_wins");
    expect(w?.playerIds).toEqual(["a"]);
  });

  it("awards lowest_avg_net", () => {
    const aggs: PlayerLockedAgg[] = [
      { playerId: "a", sumPenalty: 0, sumScore: 10, sumTotal: 20, negativeRounds: 0, bonusWins: 0 },
      { playerId: "b", sumPenalty: 0, sumScore: 10, sumTotal: 10, negativeRounds: 0, bonusWins: 0 },
    ];
    const awards = computeGroupAwards(aggs, 2, 0);
    const l = awards.find((x) => x.id === "lowest_avg_net");
    expect(l?.playerIds).toEqual(["b"]);
  });

  it("awards highest_avg_score", () => {
    const aggs: PlayerLockedAgg[] = [
      { playerId: "a", sumPenalty: 0, sumScore: 40, sumTotal: 20, negativeRounds: 0, bonusWins: 0 },
      { playerId: "b", sumPenalty: 0, sumScore: 10, sumTotal: 10, negativeRounds: 0, bonusWins: 0 },
    ];
    const awards = computeGroupAwards(aggs, 2, 0);
    const h = awards.find((x) => x.id === "highest_avg_score");
    expect(h?.playerIds).toEqual(["a"]);
  });
});
