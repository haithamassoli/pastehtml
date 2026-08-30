// Server-side observability entry point. Next calls `register()` once per
// server instance, and `onRequestError` for every uncaught server error.
//
// That second hook is why this file matters: `lib/api.ts` and `app/mcp/route.ts`
// catch their own failures and log them, but nothing else in the app does — the
// wildcard paste runtime, the raw and preview endpoints, and every dashboard
// server component would otherwise fail silently into Vercel's generic 500.
// Registering here covers all of them without a line in any of them.
import type { Instrumentation } from "next";
import { logger } from "@/lib/logger";
import { REQUEST_ID_HEADER, PLATFORM_ID_HEADER } from "@/lib/request-id";
import { captureException, errorTrackingEnabled } from "@/lib/sentry";

export function register() {
  // Says in the logs whether the DSN actually took effect, so "no errors in
  // Sentry" can be told apart from "Sentry was never configured".
  logger.info("server started", {
    runtime: process.env.NEXT_RUNTIME,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    errorTracking: errorTrackingEnabled,
  });
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const header = (name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  // Same precedence as `requestId()`, so an error and the request log line it
  // belongs to carry the same id. Nothing is minted here: a request that never
  // reached a handler has no id to correlate with anyway.
  const fields = {
    requestId: header(REQUEST_ID_HEADER) ?? header(PLATFORM_ID_HEADER),
    method: request.method,
    // The path names the paste and the operation. The paste *body* is a request
    // body or a storage object and never reaches this file.
    path: request.path,
    route: context.routePath,
    routeType: context.routeType,
  };

  logger.error("server error", { ...fields, error });
  captureException(error, fields);
};
