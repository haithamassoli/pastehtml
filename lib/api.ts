// Shared plumbing for the public REST API under `/api/v1`.
//
// Versioning is path-based: `/api/v1/...`. A breaking change to a response
// shape or an auth rule ships as `/api/v2` alongside v1; additive fields do
// not. Everything below is what every v1 handler has in common — one envelope,
// one error shape, one place credentials are read out of a request.
import { api } from "@/convex/_generated/api";
import { API_KEY_PREFIX } from "@/convex/lib/apiKeys";
import { AppError, ErrorCode } from "./errors";
import { logger } from "./logger";
import { REQUEST_ID_HEADER, requestId } from "./request-id";
import { convex } from "./paste-http";
import { config } from "./config";

/** Credentials a request may carry, other than a Clerk browser session. */
export type ApiCredentials = {
  /** `ph_…` key from `Authorization: Bearer`. */
  apiKey?: string;
  /** Anonymous management secret, from `Authorization` or `X-Update-Token`. */
  updateToken?: string;
};

/**
 * Reads the credentials out of a request. `Authorization: Bearer` carries an
 * API key when it starts with `ph_`; anything else there is a Clerk session
 * token, which `authedConvex()` forwards on its own. The anonymous update token
 * gets its own header rather than a guess at which kind of bearer it is.
 */
export function credentialsFrom(request: Request): ApiCredentials {
  const bearer = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(\S+)/i)?.[1];

  return {
    apiKey: bearer?.startsWith(API_KEY_PREFIX) ? bearer : undefined,
    updateToken: request.headers.get("x-update-token")?.trim() || undefined,
  };
}

/**
 * Who this request is charged to for rate limiting. An API key is charged to
 * the key, a signed-in browser to its session, everyone else to their address.
 * Only a prefix of the key is used, so the secret never reaches a log or a row.
 */
function rateLimitClient(
  request: Request,
  credentials: ApiCredentials,
): string {
  if (credentials.apiKey) return `key:${credentials.apiKey.slice(0, 9)}`;
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `ip:${address}`;
}

/**
 * Milestone 6 left CSRF open pending this API, because nothing until now was
 * reachable cross-site with ambient credentials. This is: the API also accepts
 * a Clerk session, which the browser attaches by itself, and a `text/plain`
 * POST is CORS-simple, so it is sent without a preflight to block it. (`PATCH`
 * and `DELETE` are not simple methods and never leave the preflight.)
 *
 * So a write authorized by nothing but a cookie must come from our own origin.
 * A credential in a header — API key, update token — cannot be forged by a
 * cross-site page, and a script sends no `Origin` at all, so neither is
 * affected; only the ambient-cookie case is refused.
 */
function requireSameOrigin(request: Request, credentials: ApiCredentials) {
  if (credentials.apiKey || credentials.updateToken) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (new URL(origin).host !== new URL(config.appUrl).host)
    throw new AppError(
      "FORBIDDEN",
      "Cross-origin requests must authenticate with an API key.",
    );
}

/** Success envelope. Every response carries the correlation id back. */
export function ok(data: unknown, id: string, status = 200): Response {
  return Response.json(
    { data },
    { status, headers: { [REQUEST_ID_HEADER]: id } },
  );
}

/**
 * Normalizes anything a handler threw into an `AppError`: our own errors pass
 * through, a `ConvexError` carrying `{ code, message }` keeps both, and an
 * unexpected failure becomes an opaque 500 rather than leaking internals.
 */
export function toAppError(cause: unknown): AppError {
  if (cause instanceof AppError) return cause;
  const data = (cause as { data?: { code?: string; message?: string } } | null)
    ?.data;
  if (data?.code && data.code in ErrorCode)
    return new AppError(
      data.code as ErrorCode,
      data.message ?? "Request failed.",
    );
  return new AppError("INTERNAL", "Something went wrong. Please try again.");
}

/** `C` is Next's route context, so a dynamic segment stays typed end to end. */
type Handler<C> = (input: {
  request: Request;
  context: C;
  credentials: ApiCredentials;
  id: string;
}) => Promise<Response>;

/**
 * Wraps a v1 handler: mints the correlation id, charges the rate limit, and
 * turns any failure into the standard error envelope. Logs the operation and
 * its outcome — never the HTML payload, never a credential (`lib/logger.ts`
 * redacts anything token-shaped that slips through).
 */
export function route<C = unknown>(
  bucket: "api:read" | "api:write",
  handler: Handler<C>,
) {
  return async (request: Request, context: C): Promise<Response> => {
    const id = requestId(request);
    const credentials = credentialsFrom(request);
    const log = logger.child({ requestId: id, method: request.method });

    try {
      if (bucket === "api:write") requireSameOrigin(request, credentials);

      const limit = await convex.mutation(api.rateLimit.consume, {
        bucket,
        client: rateLimitClient(request, credentials),
      });
      if (!limit.ok) {
        log.warn("api rate limited", { bucket });
        return errorResponse(
          new AppError("RATE_LIMITED", "Too many requests. Slow down."),
          id,
          rateLimitHeaders(limit),
        );
      }

      const response = await handler({ request, context, credentials, id });
      log.info("api request", { status: response.status });
      for (const [key, value] of Object.entries(rateLimitHeaders(limit)))
        response.headers.set(key, value);
      return response;
    } catch (cause) {
      const error = toAppError(cause);
      // 5xx is ours to fix, so it carries the original; 4xx is the caller's.
      if (error.status >= 500)
        log.error("api failed", { code: error.code, cause });
      else log.info("api rejected", { code: error.code });
      return errorResponse(error, id);
    }
  };
}

function rateLimitHeaders(limit: {
  limit: number;
  remaining: number;
  resetAt: number;
}): Record<string, string> {
  return {
    "RateLimit-Limit": String(limit.limit),
    "RateLimit-Remaining": String(limit.remaining),
    "RateLimit-Reset": String(
      Math.max(0, Math.ceil((limit.resetAt - Date.now()) / 1000)),
    ),
  };
}

export function errorResponse(
  error: AppError,
  id: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error: { code: error.code, message: error.message } },
    { status: error.status, headers: { ...headers, [REQUEST_ID_HEADER]: id } },
  );
}
