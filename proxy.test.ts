import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Clerk is stubbed so the assertions can prove *whether* it ran: a paste origin
// must never reach it, or user HTML would sit on an authenticated origin.
const clerk = vi.fn(() => new Response(null, { status: 200 }));
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: () => clerk }));

const { default: proxy } = await import("./proxy");

const event = {} as never;
const run = async (url: string, host: string) =>
  (await proxy(new NextRequest(url, { headers: { host } }), event))!;

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

  it("serves nothing but the paste itself", async () => {
    const response = await run(
      "http://abc.localhost:3000/other.html",
      "abc.localhost:3000",
    );

    expect(response.status).toBe(404);
    expect(clerk).not.toHaveBeenCalled();
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
