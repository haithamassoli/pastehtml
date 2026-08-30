import { expect, test } from "vitest";
import { PLATFORM_ID_HEADER, REQUEST_ID_HEADER, requestId } from "./request-id";

const request = (headers: Record<string, string> = {}) =>
  new Request("https://example.test/api/v1/pastes", { headers });

test("reuses an id the caller already has", () => {
  // The point of the header: a client that traces its own calls keeps one id
  // across its logs and ours.
  expect(requestId(request({ [REQUEST_ID_HEADER]: "trace-1" }))).toBe(
    "trace-1",
  );
});

test("falls back to Vercel's invocation id", () => {
  // Correlates our log lines with the platform's for the same request.
  expect(requestId(request({ [PLATFORM_ID_HEADER]: "iad1::abc-123" }))).toBe(
    "iad1::abc-123",
  );
});

test("prefers the caller's id over the platform's", () => {
  expect(
    requestId(
      request({ [REQUEST_ID_HEADER]: "trace-1", [PLATFORM_ID_HEADER]: "iad1" }),
    ),
  ).toBe("trace-1");
});

test("mints a fresh id when the request carries neither", () => {
  const id = requestId(request());
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(requestId(request())).not.toBe(id);
});
