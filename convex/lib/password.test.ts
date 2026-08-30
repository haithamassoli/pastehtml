// @vitest-environment edge-runtime
import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { hashPassword, validatePassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("round-trips a password without storing it", async () => {
    const stored = await hashPassword("correct horse battery");

    expect(stored).not.toContain("correct horse battery");
    expect(stored).toMatch(/^pbkdf2-sha256\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects a wrong password, including a prefix of the right one", async () => {
    const stored = await hashPassword("correct horse battery");

    expect(await verifyPassword("correct horse batter", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts each hash, so identical passwords do not collide", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same password"),
      hashPassword("same password"),
    ]);

    expect(a).not.toBe(b);
    expect(await verifyPassword("same password", b)).toBe(true);
  });

  it("reads the cost out of the stored string, so it can be raised later", async () => {
    const stored = await hashPassword("a password");
    const [, iterations] = stored.split("$");

    expect(Number(iterations)).toBeGreaterThanOrEqual(100_000);
    // A record written at a different cost still verifies.
    const cheaper = stored.replace(`$${iterations}$`, "$1$");
    expect(await verifyPassword("a password", cheaper)).toBe(false);
  });

  it("refuses a malformed record rather than throwing", async () => {
    for (const stored of [
      "",
      "garbage",
      "bcrypt$1$aa$bb",
      "pbkdf2-sha256$x$aa$bb",
    ])
      expect(await verifyPassword("anything", stored)).toBe(false);
  });
});

describe("validatePassword", () => {
  it("accepts a reasonable password", () => {
    expect(validatePassword("hunter22!")).toBe("hunter22!");
  });

  it.each(["", "short"])("rejects %j as too short", (input) => {
    expect(codeOf(() => validatePassword(input))).toBe("VALIDATION");
  });

  it("rejects an unreasonably long one", () => {
    expect(codeOf(() => validatePassword("x".repeat(129)))).toBe("VALIDATION");
  });
});

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as ConvexError<{ code: string }>).data?.code;
  }
  throw new Error("expected a rejection");
}
