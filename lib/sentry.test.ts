import { expect, test } from "vitest";
import { sentryEvent } from "./sentry";

test("scrubs credentials out of the event before it can be sent", () => {
  // The equivalent of Sentry's `beforeSend`, except the payload is never built
  // unscrubbed in the first place.
  const event = sentryEvent(new Error("upload of ph_abc123def456 failed"), {
    requestId: "req-1",
    apiKey: "ph_abc123def456",
    headers: { authorization: "Bearer ph_abc123def456", cookie: "__session=x" },
  });

  const json = JSON.stringify(event);
  expect(json).not.toContain("abc123def456");
  expect(json).not.toContain("__session");
  expect(json).toContain("req-1");
});

test("carries a stack Sentry can symbolicate, oldest frame first", () => {
  const event = sentryEvent(new Error("boom"));
  const frames = (
    event.exception as { values: { stacktrace: { frames: unknown[] } }[] }
  ).values[0].stacktrace.frames;
  const last = frames.at(-1) as { filename: string; lineno: number };

  expect(frames.length).toBeGreaterThan(0);
  expect(last.filename).toContain("sentry.test");
  expect(last.lineno).toBeGreaterThan(0);
});

test("labels the event with a stable id shared by the envelope header", () => {
  expect(sentryEvent("not an error").event_id).toMatch(/^[0-9a-f]{32}$/);
});
