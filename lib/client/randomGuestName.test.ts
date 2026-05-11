import { describe, expect, it } from "vitest";
import { randomGuestDisplayName } from "./randomGuestName";

describe("randomGuestDisplayName", () => {
  it("returns a short guest-style name within API limits", () => {
    const a = randomGuestDisplayName();
    const b = randomGuestDisplayName();
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(40);
    expect(b.length).toBeLessThanOrEqual(40);
    expect(/^\S+ \S+ \d{3}$/.test(a)).toBe(true);
  });
});
