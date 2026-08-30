import { expect, test } from "vitest";
import { _redactForTest as redact } from "./logger";

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
