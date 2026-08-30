// Error reporting to Sentry, without the Sentry SDK.
//
// ponytail: `@sentry/nextjs` is a heavyweight dependency plus a build plugin
// plus a wizard, and this project has no DSN yet. What is actually needed is
// "an unhandled exception leaves the process, labelled with its release, with
// no credentials in it" — which is one POST to Sentry's envelope endpoint. The
// DSN is read from the environment and everything here no-ops without it, so an
// unconfigured deployment pays nothing and cannot leak anything.
//
// Ceiling: no breadcrumbs, no tracing, no sessions, no sampling, no retry, and
// no symbolication of *server* stacks (browser stacks do resolve — see
// `productionBrowserSourceMaps` in next.config.ts). Install `@sentry/nextjs`
// and delete this file the day any of that earns its weight; the only callers
// are `instrumentation.ts`, `instrumentation-client.ts`, `lib/api.ts` and
// `app/mcp/route.ts`.
import { redact } from "./logger";

type Fields = Record<string, unknown>;

// `NEXT_PUBLIC_` so the browser half can report too; the server accepts either.
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

/** `https://<key>@<host>/<project>` becomes the ingest URL for that project. */
function endpointOf(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const { protocol, username, host, pathname } = new URL(dsn);
    return `${protocol}//${host}/api${pathname}/envelope/?sentry_key=${username}&sentry_version=7`;
  } catch {
    return null;
  }
}

const ENDPOINT = endpointOf(DSN);

export const errorTrackingEnabled = ENDPOINT !== null;

// Vercel sets both halves of these itself, the `NEXT_PUBLIC_` copies for the
// browser bundle. Without them Sentry groups every deploy together and a
// regression cannot be pinned to the commit that caused it.
const release =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA;
const environment =
  process.env.NEXT_PUBLIC_VERCEL_ENV ??
  process.env.VERCEL_ENV ??
  process.env.NODE_ENV;

/**
 * A JS stack is newest-first and Sentry's `frames` are oldest-first. Frames
 * outside `node_modules` are `in_app`, which is what Sentry shows by default.
 */
function framesOf(stack = ""): unknown[] {
  return stack
    .split("\n")
    .map((line) => /at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line.trim()))
    .filter((match) => match !== null)
    .map((match) => ({
      function: match[1] ?? "?",
      filename: match[2],
      lineno: Number(match[3]),
      colno: Number(match[4]),
      in_app: !match[2].includes("node_modules"),
    }))
    .reverse();
}

/**
 * The event as it will be sent. Built through `redact()` — the same pass the
 * logger uses — so the scrub happens before the bytes exist rather than in a
 * `beforeSend` hook the SDK might be configured out of. Exported so a test can
 * assert that a credential handed in as context never appears in the payload.
 */
export function sentryEvent(error: unknown, context: Fields = {}): Fields {
  const cause = error instanceof Error ? error : new Error(String(error));
  return redact({
    event_id: crypto.randomUUID().replaceAll("-", ""),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    release,
    environment,
    tags: { runtime: process.env.NEXT_RUNTIME ?? "browser" },
    exception: {
      values: [
        {
          type: cause.name,
          value: cause.message,
          stacktrace: { frames: framesOf(cause.stack) },
        },
      ],
    },
    extra: context,
  });
}

/** Fire and forget: a failed report must never become a second error. */
export function captureException(error: unknown, context: Fields = {}): void {
  if (!ENDPOINT) return;
  const event = sentryEvent(error, context);
  const envelope = [
    JSON.stringify({
      event_id: event.event_id,
      sent_at: new Date().toISOString(),
    }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  void fetch(ENDPOINT, {
    method: "POST",
    // `keepalive` so a report survives the page unloading under it.
    keepalive: true,
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body: envelope,
  }).catch(() => {});
}
