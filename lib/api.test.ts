import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { credentialsFrom, errorResponse, ok, toAppError } from "./api";
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
