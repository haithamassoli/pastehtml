import { describe, expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { _redactForTest as redact } from "./logger";

describe("redaction", () => {
  test("redacts sensitive top-level and nested fields", () => {
    const out = redact({
      userId: "u1",
      password: "hunter2",
      apiKey: "sk_live_xxx",
      nested: { authorization: "Bearer abc", ok: 1 },
    });
    expect(out.userId).toBe("u1");
    expect(out.password).toBe("[REDACTED]");
    expect(out.apiKey).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).authorization).toBe(
      "[REDACTED]",
    );
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
  });

  // One case per credential name that actually exists in this codebase, so a
  // rename that slips past the pattern fails here rather than in production.
  test.each([
    "password",
    "passwordHash",
    "apiKey",
    "api_key",
    "keyHash",
    "updateToken",
    "updateTokenHash",
    "unlockToken",
    "unlockTokenHash",
    "token",
    "authorization",
    "Authorization",
    "cookie",
    "Cookie",
    "set-cookie",
    "secret",
    "CLERK_SECRET_KEY",
  ])("redacts %s", (field) => {
    expect(redact({ [field]: "sensitive" })[field]).toBe("[REDACTED]");
  });

  test("keeps the fields an operator actually needs", () => {
    const kept = {
      requestId: "req-1",
      userId: "u1",
      path: "/api/v1/pastes/abc",
      status: 500,
      sha256: "deadbeef",
      viewsCount: 3,
    };
    expect(redact(kept)).toEqual(kept);
  });

  test("walks into arrays", () => {
    // Arrays used to fall through the recursive walk, so a credential inside
    // one — a list of keys, a batch of headers — was logged verbatim.
    const out = redact({ keys: [{ apiKey: "ph_secret", label: "ci" }] });
    expect(out).toEqual({ keys: [{ apiKey: "[REDACTED]", label: "ci" }] });
  });

  test("scrubs an API key that appears inside a string", () => {
    const out = redact({
      message: "rejected key ph_abc123def456 from ci",
      url: "https://example.test/x?key=ph_abc123def456",
    });
    expect(JSON.stringify(out)).not.toContain("abc123def456");
    expect(out.message).toBe("rejected key ph_[REDACTED] from ci");
  });

  test("serializes an Error instead of flattening it to {}", () => {
    // `message` and `stack` are non-enumerable: walked as a plain object an
    // Error logs as `{}`, which is the opposite of diagnosable.
    const error = new Error("connection reset");
    const out = redact({ cause: error }).cause as Record<string, unknown>;
    expect(out.name).toBe("Error");
    expect(out.message).toBe("connection reset");
    expect(String(out.stack)).toContain("logger.test");
  });

  test("keeps a ConvexError's payload and scrubs a key out of its message", () => {
    const out = redact({
      cause: new ConvexError({
        code: "FORBIDDEN",
        message: "key ph_abc123def456 cannot write",
      }),
    }).cause as Record<string, unknown>;
    const data = out.data as Record<string, unknown>;
    expect(data.code).toBe("FORBIDDEN");
    expect(data.message).toBe("key ph_[REDACTED] cannot write");
  });
});
