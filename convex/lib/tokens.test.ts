import { describe, expect, it } from "vitest";
import {
  PASTE_TOKEN_LENGTH,
  generatePasteToken,
  generateUpdateToken,
  randomString,
  sha256Hex,
  timingSafeEqual,
} from "./tokens";

describe("randomString", () => {
  it("produces the requested length from the URL-safe alphabet", () => {
    for (const length of [1, 12, 32, 64]) {
      const value = randomString(length);
      expect(value).toHaveLength(length);
      expect(value).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("does not repeat itself", () => {
    const seen = new Set(Array.from({ length: 200 }, generatePasteToken));
    expect(seen.size).toBe(200);
    expect(generatePasteToken()).toHaveLength(PASTE_TOKEN_LENGTH);
    expect(generateUpdateToken()).toHaveLength(32);
  });
});

describe("sha256Hex", () => {
  it("matches the known digest of 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("timingSafeEqual", () => {
  it("compares equal and unequal values", () => {
    expect(timingSafeEqual("abcd", "abcd")).toBe(true);
    expect(timingSafeEqual("abcd", "abce")).toBe(false);
    expect(timingSafeEqual("abcd", "abc")).toBe(false);
  });
});
