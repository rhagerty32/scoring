import { describe, expect, it } from "vitest";
import {
  parseHandAndFootScorePayload,
  winnerTeamIdsHandAndFoot,
  maxCumulativeTeamsAfterLock,
} from "./handAndFoot";

describe("parseHandAndFootScorePayload", () => {
  it("sums books and cards and subtracts penalties", () => {
    const r = parseHandAndFootScorePayload({ books: 500, cards: 120, penalties: 30 });
    expect(r.total).toBe(590);
    expect(r.meta).toEqual({ books: 500, cards: 120, penalties: 30 });
  });

  it("clamps oversized fields", () => {
    const r = parseHandAndFootScorePayload({ books: 999_999, cards: 0, penalties: 0 });
    expect(r.meta.books).toBe(50_000);
  });
});

describe("winnerTeamIdsHandAndFoot", () => {
  it("returns all teams tied at the top", () => {
    const map = new Map([
      ["a", 100],
      ["b", 100],
      ["c", 50],
    ]);
    expect(winnerTeamIdsHandAndFoot(["a", "b", "c"], map).sort()).toEqual(["a", "b"]);
  });
});

describe("maxCumulativeTeamsAfterLock", () => {
  it("sums team totals across locked rounds", () => {
    const scores = new Map<string, Map<string, number>>();
    scores.set("r1", new Map([["t1", 100], ["t2", 50]]));
    scores.set("r2", new Map([["t1", 200], ["t2", 80]]));
    const max = maxCumulativeTeamsAfterLock({
      teamIds: ["t1", "t2"],
      lockedRounds: [
        { id: "r1", number: 1 },
        { id: "r2", number: 2 },
      ],
      scoresByRoundId: scores,
    });
    expect(max).toBe(300);
  });
});
