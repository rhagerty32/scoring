import { describe, expect, it } from "vitest";
import {
  applyRankToggle,
  applyWentOutToggle,
  compareRanks2500,
  normalizeScoreTapMeta,
  parse2500ScorePayload,
  parseRankClaimsJson,
  RANKS_2500,
  rankOrderIndex2500,
  serializeRankClaimsJson,
  winnerPlayerIds2500,
} from "./game2500";

describe("applyWentOutToggle", () => {
  it("allows one player to claim went out", () => {
    const r = applyWentOutToggle(null, "p1", true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wentOutPlayerId).toBe("p1");
  });

  it("blocks a second player", () => {
    const r = applyWentOutToggle("p1", "p2", true);
    expect(r.ok).toBe(false);
  });

  it("only claimant can clear", () => {
    expect(applyWentOutToggle("p1", "p2", false).ok).toBe(false);
    const r = applyWentOutToggle("p1", "p1", false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wentOutPlayerId).toBeNull();
  });
});

describe("applyRankToggle", () => {
  it("lets any player turn a rank on", () => {
    const r = applyRankToggle({}, "7", "p1", true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.claims["7"]).toBe("p1");
  });

  it("only owner can turn off", () => {
    const r = applyRankToggle({ "7": "p1" }, "7", "p2", false);
    expect(r.ok).toBe(false);
    const r2 = applyRankToggle({ "7": "p1" }, "7", "p1", false);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.claims["7"]).toBeUndefined();
  });
});

describe("parseRankClaimsJson", () => {
  it("returns empty for invalid", () => {
    expect(parseRankClaimsJson(null)).toEqual({});
    expect(parseRankClaimsJson("")).toEqual({});
    expect(parseRankClaimsJson("not json")).toEqual({});
  });

  it("filters to valid ranks", () => {
    expect(parseRankClaimsJson(JSON.stringify({ "7": "a", "2": "b", "K": "c" }))).toEqual({ "7": "a", K: "c" });
  });
});

describe("aces low rank order", () => {
  it("lists A first then 3 through K", () => {
    expect(RANKS_2500[0]).toBe("A");
    expect(RANKS_2500[RANKS_2500.length - 1]).toBe("K");
  });

  it("ranks A below 3 and K above Q", () => {
    expect(compareRanks2500("A", "3")).toBeLessThan(0);
    expect(compareRanks2500("K", "Q")).toBeGreaterThan(0);
    expect(rankOrderIndex2500("A")).toBe(0);
    expect(rankOrderIndex2500("K")).toBe(RANKS_2500.length - 1);
  });

  it("serializes rank claims in low-to-high order", () => {
    const json = serializeRankClaimsJson({ K: "p1", A: "p2", "5": "p3" });
    expect(json.indexOf('"A"')).toBeLessThan(json.indexOf('"5"'));
    expect(json.indexOf('"5"')).toBeLessThan(json.indexOf('"K"'));
  });
});

describe("parse2500ScorePayload", () => {
  it("forces net from score and zeroes penalty/bonus", () => {
    const t = parse2500ScorePayload({ score: -15, penalty: 99, bonus: 5 });
    expect(t).toEqual({ score: -15, penalty: 0, bonus: 0, total: -15 });
  });

  it("clamps extreme values", () => {
    const t = parse2500ScorePayload({ score: 999_999, penalty: 0, bonus: 0 });
    expect(t.total).toBe(50_000);
  });
});

describe("normalizeScoreTapMeta", () => {
  it("fills defaults", () => {
    expect(normalizeScoreTapMeta({ p100: 2 })).toEqual({
      p5: 0,
      m5: 0,
      p10: 0,
      m10: 0,
      p100: 2,
      m100: 0,
      wentOut: 0,
    });
  });
});

describe("winnerPlayerIds2500", () => {
  it("returns co-winners on tie at top among those over target", () => {
    const m = new Map<string, number>([
      ["a", 2400],
      ["b", 2600],
      ["c", 2600],
      ["d", 2000],
    ]);
    expect(winnerPlayerIds2500(["a", "b", "c", "d"], m, 2500).sort()).toEqual(["b", "c"]);
  });

  it("returns empty when nobody reached target", () => {
    const m = new Map<string, number>([
      ["a", 100],
      ["b", 200],
    ]);
    expect(winnerPlayerIds2500(["a", "b"], m, 2500)).toEqual([]);
  });
});
