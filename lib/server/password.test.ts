import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("verifies a freshly hashed password", () => {
    const h = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });

  it("rejects garbage stored strings", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "plain")).toBe(false);
  });
});
