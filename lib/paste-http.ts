// Shared plumbing for the three surfaces that hand over stored paste bytes: the
// wildcard runtime, the raw endpoint and the sandboxed preview. They resolve
// the same way and stream the same body — only the headers they wrap it in
// differ, which is exactly what keeps user HTML executable on its own origin
// and inert on the app's.
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { env } from "@/lib/env";

export const convex = new ConvexHttpClient(env.CONVEX_URL);

type ResolvedPaste = NonNullable<
  FunctionReturnType<typeof api.pastes.resolveForRuntime>
>;

/** A paste whose stored object is present, so it can actually be served. */
export type AvailablePaste = ResolvedPaste & { url: string };

// The only headers every paste response carries. `nosniff` matters most on the
// app origin, where the raw endpoint must stay text and never be sniffed into
// executable HTML.
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

// ponytail: revalidate on every request so an update or delete is visible
// immediately; conditional requests keep it to a 304. Milestone 16 tunes this.
export const CACHE_CONTROL = "public, max-age=0, must-revalidate";

export function plain(status: number, message: string) {
  return new Response(message, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** RFC 9110 If-None-Match: a list of entity tags, or `*`. */
function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header
    .split(",")
    .map((value) => value.trim().replace(/^W\//, ""))
    .some((value) => value === "*" || value === etag);
}

/**
 * Looks a paste up by custom subdomain or public token. Returns the `Response`
 * to send instead when it is missing or withheld, so every surface answers an
 * unavailable paste identically.
 */
export async function resolvePaste(
  subdomain: string,
): Promise<AvailablePaste | Response> {
  const paste = await convex.query(api.pastes.resolveForRuntime, { subdomain });

  if (!paste) return plain(404, "Paste not found.");
  if (paste.visibility === "protected")
    // Milestone 9 replaces this with the unlock challenge page.
    return plain(401, "This paste is password protected.");
  if (!paste.url) return plain(404, "Paste content is unavailable.");
  return { ...paste, url: paste.url };
}

/**
 * Streams the stored bytes through verbatim under the caller's headers. The
 * ETag is Convex's stored SHA-256 digest, so a conditional request is answered
 * without ever reading storage.
 */
export async function serveStored(
  request: Request,
  paste: AvailablePaste,
  headers: Record<string, string>,
): Promise<Response> {
  const etag = `"${paste.sha256}"`;
  const responseHeaders = {
    ...SECURITY_HEADERS,
    "Cache-Control": CACHE_CONTROL,
    ETag: etag,
    ...headers,
  };

  if (matchesEtag(request.headers.get("if-none-match"), etag))
    return new Response(null, { status: 304, headers: responseHeaders });

  const stored = await fetch(paste.url);
  if (!stored.ok || !stored.body) return plain(502, "Could not load content.");

  // Never rewritten, never re-encoded: the bytes that were uploaded.
  return new Response(stored.body, {
    headers: {
      ...responseHeaders,
      "Content-Length": String(paste.contentLength),
    },
  });
}
