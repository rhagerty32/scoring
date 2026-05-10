import { describe, expect, it } from "vitest";
import {
  computeRoundTotal,
  estimatedRoundsToTarget,
  parseScorePayload,
  perRoundNetsFromCumulative,
  projectFavorites,
} from "./nertz";

describe("computeRoundTotal", () => {
  it("subtracts penalty and adds bonus", () => {
    expect(computeRoundTotal(20, 5, 10)).toBe(25);
  });
});

describe("parseScorePayload", () => {
  it("clamps values", () => {
    const r = parseScorePayload({ score: 999999, penalty: -3, bonus: "12" });
    expect(r.score).toBe(9999);
    expect(r.penalty).toBe(0);
    expect(r.bonus).toBe(12);
  });
});

describe("projection", () => {
  it("estimates remaining rounds from pace", () => {
    const cum = [15, 30, 45];
    const nets = perRoundNetsFromCumulative(cum);
    expect(nets).toEqual([15, 15, 15]);
    expect(estimatedRoundsToTarget(45, nets, 100)).toBe(4);
  });

  it("picks favorite by fewer estimated rounds", () => {
    const rows = projectFavorites(
      ["a", "b"],
      new Map<string, number[]>([
        ["a", [10, 20]],
        ["b", [5, 8]],
      ]),
      100
    );
    const sorted = rows
      .filter((r) => r.estimatedRoundsRemaining != null)
      .sort((x, y) => (x.estimatedRoundsRemaining ?? 0) - (y.estimatedRoundsRemaining ?? 0));
    expect(sorted[0]?.playerId).toBe("a");
  });
});
