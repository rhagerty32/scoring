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

  it("allows a negative total when penalties exceed points and bonuses", () => {
    expect(computeRoundTotal(4, 12, 3)).toBe(-5);
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

  it("projects remaining rounds separately for each player", () => {
    const rows = projectFavorites(
      ["a", "b"],
      new Map<string, number[]>([
        ["a", [10, 20]],
        ["b", [5, 8]],
      ]),
      100
    );
    expect(rows).toEqual([
      { playerId: "a", estimatedRoundsRemaining: 8 },
      { playerId: "b", estimatedRoundsRemaining: 23 },
    ]);
  });

  it("accounts for negative rounds and leaves nonpositive pace unprojected", () => {
    const rows = projectFavorites(
      ["recovering", "losing", "flat"],
      new Map([
        ["recovering", [15, 10, 30]],
        ["losing", [-5, -10]],
        ["flat", [-5, 0]],
      ]),
      100
    );
    expect(rows).toEqual([
      { playerId: "recovering", estimatedRoundsRemaining: 7 },
      { playerId: "losing", estimatedRoundsRemaining: null },
      { playerId: "flat", estimatedRoundsRemaining: null },
    ]);
  });

  it("preserves both players when their projections tie", () => {
    const rows = projectFavorites(
      ["a", "b"],
      new Map([
        ["a", [18, 36]],
        ["b", [19, 38]],
      ]),
      100
    );
    expect(rows).toEqual([
      { playerId: "a", estimatedRoundsRemaining: 4 },
      { playerId: "b", estimatedRoundsRemaining: 4 },
    ]);
  });

  it("returns zero remaining rounds at or above the target", () => {
    const rows = projectFavorites(
      ["at-target", "above-target", "below-target"],
      new Map([
        ["at-target", [50, 100]],
        ["above-target", [50, 230]],
        ["below-target", [50, 99]],
      ]),
      100
    );
    expect(rows).toEqual([
      { playerId: "at-target", estimatedRoundsRemaining: 0 },
      { playerId: "above-target", estimatedRoundsRemaining: 0 },
      { playerId: "below-target", estimatedRoundsRemaining: 1 },
    ]);
  });
});
