import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Clerk is stubbed so the assertions can prove *whether* it ran: a paste origin
// must never reach it, or user HTML would sit on an authenticated origin.
const clerk = vi.fn(() => new Response(null, { status: 200 }));
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: () => clerk }));

const { default: proxy } = await import("./proxy");

const event = {} as never;
const run = async (url: string, host: string, headers: HeadersInit = {}) =>
  (await proxy(
    new NextRequest(url, { headers: { host, ...headers } }),
    event,
  ))!;

beforeEach(() => clerk.mockClear());

describe("wildcard paste hosts", () => {
  it("rewrites to the internal runtime without invoking Clerk", async () => {
    const response = await run(
      "http://abc123.localhost:3000/",
      "abc123.localhost:3000",
    );

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/internal/paste/abc123",
    );
    expect(clerk).not.toHaveBeenCalled();
  });

  it("normalizes the host before routing", async () => {
    const response = await run(
      "http://abc123.localhost:3000/",
      "ABC123.LocalHost:3000",
    );

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/internal/paste/abc123",
    );
  });

  it("routes a custom subdomain like any other paste host", async () => {
    // Vanity names are hyphenated where generated tokens never are, so the
    // label rules and the rewrite are worth proving on one.
    const response = await run(
      "http://my-demo.localhost:3000/",
      "my-demo.localhost:3000",
    );

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/internal/paste/my-demo",
    );
    expect(clerk).not.toHaveBeenCalled();
  });

  it("serves nothing but the paste itself", async () => {
    const response = await run(
      "http://abc.localhost:3000/other.html",
      "abc.localhost:3000",
    );

    expect(response.status).toBe(404);
    expect(clerk).not.toHaveBeenCalled();
  });

  it("strips app credentials before the runtime sees the request", async () => {
    const response = await run(
      "http://abc123.localhost:3000/",
      "abc123.localhost:3000",
      { cookie: "__session=stolen", authorization: "Bearer stolen" },
    );

    // Next.js rebuilds the upstream request from this list, deleting every
    // header missing from it — so an absent name is a header the runtime and
    // the paste's own origin never see.
    const overridden = response.headers
      .get("x-middleware-override-headers")!
      .split(",");
    expect(overridden).toContain("host");
    expect(overridden).not.toContain("cookie");
    expect(overridden).not.toContain("authorization");
    expect(JSON.stringify([...response.headers])).not.toContain("stolen");
  });

  it("forwards nothing but the paste's own unlock cookie", async () => {
    const response = await run(
      "http://abc123.localhost:3000/",
      "abc123.localhost:3000",
      {
        cookie: "__session=stolen; ph_unlock=mine; __clerk_db_jwt=stolen",
        authorization: "Bearer stolen",
      },
    );

    const overridden = response.headers
      .get("x-middleware-override-headers")!
      .split(",");
    // The Cookie header is rebuilt from scratch, not filtered in place, so a
    // Clerk cookie cannot survive however it was scoped.
    expect(overridden).toContain("cookie");
    expect(overridden).not.toContain("authorization");
    expect(response.headers.get("x-middleware-request-cookie")).toBe(
      "ph_unlock=mine",
    );
    expect(JSON.stringify([...response.headers])).not.toContain("stolen");
  });

  it("cannot rewrite into a privileged internal route", async () => {
    // A paste host is pinned to its own subdomain regardless of the path asked
    // for, so one paste origin can never address another paste or an app route.
    const response = await run(
      "http://abc.localhost:3000/internal/paste/other",
      "abc.localhost:3000",
    );

    expect(response.status).toBe(404);
  });
});

// A Host header is attacker-controlled: it is whatever the client typed, and on
// a paste origin it is the only thing that decides which paste is served.
// `lib/host.test.ts` owns the label rules; what matters here is that nothing
// malformed is ever coerced into a rewrite.
describe("malformed Host headers", () => {
  it.each([
    { host: "[::1]:3000", why: "an IPv6 literal" },
    { host: `${"a".repeat(64)}.localhost:3000`, why: "an over-long label" },
    { host: "abc 123.localhost:3000", why: "embedded whitespace" },
    { host: "abc\t123.localhost:3000", why: "an embedded tab" },
    { host: "../internal/paste/other.localhost:3000", why: "a traversal" },
    { host: "abc%2f..%2finternal.localhost:3000", why: "an encoded traversal" },
    { host: ".localhost:3000", why: "an empty label" },
    // `normalizeHost` strips the root dot before the port, so this spelling
    // fails closed rather than resolving. Fine: closed is the safe direction.
    { host: "abc123.localhost.:3000", why: "a root dot behind a port" },
    // A CRLF never gets this far: the runtime refuses to build the header at
    // all, so header injection through Host is not ours to defend against.
  ])("refuses to route $why", async ({ host }) => {
    const response = await run("http://localhost:3000/", host);

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    // Not a paste origin, so it is an app request like any other.
    expect(clerk).toHaveBeenCalledOnce();
  });

  it("routes a fully-qualified trailing dot to the same paste", async () => {
    const response = await run(
      "http://abc123.localhost:3000/",
      "ABC123.LocalHost.",
    );

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/internal/paste/abc123",
    );
  });

  it("falls back to the URL host when the Host header is absent", async () => {
    const response = (await proxy(
      new NextRequest("http://localhost:3000/dashboard"),
      event,
    ))!;

    // No Host is not an empty subdomain: the request stays with the app.
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(clerk).toHaveBeenCalledOnce();
  });
});

describe("application hosts", () => {
  it.each(["localhost:3000", "www.localhost:3000", "api.localhost:3000"])(
    "hands %s to Clerk",
    async (host) => {
      await run(`http://${host}/dashboard`, host);
      expect(clerk).toHaveBeenCalledOnce();
    },
  );

  it("404s a direct request to the runtime route", async () => {
    const response = await run(
      "http://localhost:3000/internal/paste/abc",
      "localhost:3000",
    );

    expect(response.status).toBe(404);
    expect(clerk).not.toHaveBeenCalled();
  });
});
