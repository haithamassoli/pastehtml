import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";

// `route` charges the rate limit through Convex before it reaches the handler,
// so the client is stubbed and nothing here talks to a deployment.
const { mutation } = vi.hoisted(() => ({
  mutation: vi.fn(async () => ({
    ok: true,
    limit: 60,
    remaining: 59,
    resetAt: Date.now() + 60_000,
  })),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = vi.fn();
    mutation = mutation;
  },
}));

const { credentialsFrom, errorResponse, ok, route, toAppError } =
  await import("./api");
import { AppError } from "./errors";
import { REQUEST_ID_HEADER } from "./request-id";

const request = (headers: Record<string, string>) =>
  new Request("https://example.test/api/v1/pastes/abc", { headers });

describe("credentialsFrom", () => {
  it("recognises an API key by its prefix", () => {
    expect(
      credentialsFrom(request({ authorization: "Bearer ph_secret" })),
    ).toEqual({ apiKey: "ph_secret", updateToken: undefined });
  });

  it("leaves a Clerk session token for Clerk to verify", () => {
    // A JWT in the same header is not an API key, and must not be treated as
    // one — Clerk's middleware is what validates it.
    expect(credentialsFrom(request({ authorization: "Bearer a.b.c" }))).toEqual(
      {
        apiKey: undefined,
        updateToken: undefined,
      },
    );
  });

  it("reads the anonymous update token from its own header", () => {
    expect(
      credentialsFrom(request({ "x-update-token": "  abc123  " })),
    ).toEqual({ apiKey: undefined, updateToken: "abc123" });
  });

  it("ignores an absent or malformed Authorization header", () => {
    const malformed: Record<string, string>[] = [
      {},
      { authorization: "ph_secret" },
      { authorization: "Bearer" },
    ];
    for (const headers of malformed)
      expect(credentialsFrom(request(headers)).apiKey).toBeUndefined();
  });
});

describe("toAppError", () => {
  it("passes our own errors through", () => {
    const error = new AppError("NOT_FOUND", "Paste not found.");
    expect(toAppError(error)).toBe(error);
  });

  it("keeps the code and message from a Convex rejection", () => {
    const error = toAppError(
      new ConvexError({ code: "FORBIDDEN", message: "Not your resource." }),
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(error.status).toBe(403);
    expect(error.message).toBe("Not your resource.");
  });

  it("hides anything unexpected behind an opaque 500", () => {
    for (const cause of [new Error("connection reset to db-7"), "boom", null]) {
      const error = toAppError(cause);
      expect(error.status).toBe(500);
      expect(error.message).not.toContain("db-7");
    }
  });

  it("does not trust an unknown code from the backend", () => {
    expect(
      toAppError(new ConvexError({ code: "TEAPOT", message: "hi" })).code,
    ).toBe("INTERNAL");
  });
});

describe("response envelopes", () => {
  it("wraps success in `data` and echoes the request id", async () => {
    const response = ok({ token: "abc" }, "req-1", 201);
    expect(response.status).toBe(201);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("req-1");
    expect(await response.json()).toEqual({ data: { token: "abc" } });
  });

  it("wraps failure in `error` with its stable code and status", async () => {
    const response = errorResponse(
      new AppError("RATE_LIMITED", "Too many requests."),
      "req-2",
      { "RateLimit-Limit": "60" },
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("RateLimit-Limit")).toBe("60");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("req-2");
    expect(await response.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "Too many requests." },
    });
  });
});

describe("cross-origin writes", () => {
  const write = route("api:write", async ({ id }) => ok({ written: true }, id));
  const post = (headers: Record<string, string>) =>
    write(
      new Request("http://localhost:3000/api/v1/pastes", {
        method: "POST",
        headers,
      }),
      undefined,
    );

  it("refuses a cookie-only write from a paste origin", async () => {
    // The product parks hostile HTML one label away from the app, so the origin
    // check has to compare hosts exactly. A suffix match would hand every paste
    // a forged write carrying its visitor's session.
    const response = await post({ origin: "http://abc123.localhost:3000" });

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("lets a header credential through from anywhere", async () => {
    // An API key or update token cannot be attached by a page the user merely
    // visited, so the origin is not what protects those — and our own origin
    // and a script that sends no Origin at all are ordinary callers.
    const cases: Record<string, string>[] = [
      { origin: "https://evil.example", authorization: "Bearer ph_secret" },
      { origin: "https://evil.example", "x-update-token": "secret" },
      { origin: "http://localhost:3000" },
      {},
    ];
    for (const headers of cases)
      expect((await post(headers)).status, JSON.stringify(headers)).toBe(200);
  });
});
