import { describe, expect, it } from "vitest";
import {
  ROOT_HOST,
  isRuntimePath,
  normalizeHost,
  pasteSubdomain,
  subdomainOf,
  readCookie,
} from "./host";

// Tests run with NEXT_PUBLIC_APP_URL=http://localhost:3000 (vitest.config.ts).
describe("ROOT_HOST", () => {
  it("drops the development port", () => {
    expect(ROOT_HOST).toBe("localhost");
  });
});

describe("normalizeHost", () => {
  it.each([
    ["Example.COM", "example.com"],
    ["example.com:3000", "example.com"],
    ["example.com.", "example.com"],
    ["  example.com  ", "example.com"],
    ["[::1]:3000", "[::1]"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });

  it.each([null, undefined, "", "   ", ":3000"])("rejects %s", (input) => {
    expect(normalizeHost(input)).toBeNull();
  });
});

describe("pasteSubdomain", () => {
  it("extracts a paste token", () => {
    expect(pasteSubdomain("abc123def456.localhost")).toBe("abc123def456");
  });

  it("normalizes casing and strips the port", () => {
    expect(pasteSubdomain("AbC123.localhost:3000")).toBe("abc123");
  });

  it.each([
    { host: "localhost", why: "the root domain itself" },
    { host: "localhost:3000", why: "the root domain with a port" },
    { host: "www.localhost", why: "a reserved subdomain" },
    { host: "api.localhost", why: "another reserved subdomain" },
    { host: "deep.nested.localhost", why: "more than one label" },
    { host: "-bad.localhost", why: "a label starting with a hyphen" },
    { host: "bad-.localhost", why: "a label ending with a hyphen" },
    { host: "ab_cd.localhost", why: "an illegal DNS character" },
    { host: "evil.com", why: "an unrelated domain" },
    { host: "notlocalhost", why: "a domain that merely shares a suffix" },
    { host: "abc.localhost.evil.com", why: "the root domain in the middle" },
    { host: "", why: "an empty host" },
    { host: null, why: "a missing host" },
  ])("returns null for $host ($why)", ({ host }) => {
    expect(pasteSubdomain(host)).toBeNull();
  });

  it("rejects a label longer than a DNS label allows", () => {
    expect(pasteSubdomain(`${"a".repeat(64)}.localhost`)).toBeNull();
    expect(pasteSubdomain(`${"a".repeat(63)}.localhost`)).toHaveLength(63);
  });
});

// The production root is itself a subdomain, so the suffix match has to hold
// across three labels — not just the two `localhost` exercises above.
describe("pasteSubdomain under a deployment root that is a subdomain", () => {
  const ROOT = "pastehtml.assoli.site";
  const sub = (host: string | null) => subdomainOf(host, ROOT);

  it("extracts the paste label", () => {
    expect(sub("abc123def456.pastehtml.assoli.site")).toBe("abc123def456");
    expect(sub("my-demo.pastehtml.assoli.site:443")).toBe("my-demo");
  });

  it.each([
    { host: "pastehtml.assoli.site", why: "the app root itself" },
    { host: "www.pastehtml.assoli.site", why: "a reserved label" },
    { host: "a.b.pastehtml.assoli.site", why: "outside the wildcard cert" },
    { host: "assoli.site", why: "the parent domain" },
    { host: "abc.assoli.site", why: "a sibling app on the parent domain" },
    {
      host: "evilpastehtml.assoli.site",
      why: "a suffix match without the dot",
    },
  ])("returns null for $host ($why)", ({ host }) => {
    expect(sub(host)).toBeNull();
  });
});

describe("isRuntimePath", () => {
  it("serves the paste only at the root", () => {
    expect(isRuntimePath("/")).toBe(true);
    expect(isRuntimePath("/index.html")).toBe(true);
    expect(isRuntimePath("/other.html")).toBe(false);
    expect(isRuntimePath("/favicon.ico")).toBe(false);
  });
});

describe("readCookie", () => {
  it("finds a cookie among others", () => {
    const header = "__session=abc; ph_unlock=secret; other=1";
    expect(readCookie(header, "ph_unlock")).toBe("secret");
    expect(readCookie(header, "other")).toBe("1");
  });

  it("matches the whole name, never a suffix or a prefix", () => {
    const header = "xph_unlock=wrong; ph_unlock_extra=wrong";
    expect(readCookie(header, "ph_unlock")).toBeUndefined();
  });

  it("returns undefined for a missing, empty or absent header", () => {
    expect(readCookie("a=1", "ph_unlock")).toBeUndefined();
    expect(readCookie("ph_unlock=", "ph_unlock")).toBeUndefined();
    expect(readCookie(null, "ph_unlock")).toBeUndefined();
  });
});
