// Shared plumbing for the three surfaces that hand over stored paste bytes: the
// wildcard runtime, the raw endpoint and the sandboxed preview. They resolve
// the same way and stream the same body — only the headers they wrap it in
// differ, which is exactly what keeps user HTML executable on its own origin
// and inert on the app's.
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { config } from "@/lib/config";
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

// The cache policy for every surface that hands over stored bytes, and it is
// deliberately not a TTL. A paste can be replaced, taken down for abuse or
// deleted at any moment, and all three have to be visible on the next request
// rather than whenever a stored copy expires — so nothing is stored, everything
// revalidates, and the ETag is what makes that cheap: a conditional request is
// answered by one indexed Convex read and never touches File Storage. Measured,
// locally: ~230ms for a full read against ~106ms for the 304 (docs/load-testing.md).
export const CACHE_CONTROL = "public, max-age=0, must-revalidate";

// The same policy for a paste behind a password. Correct revalidation would
// gate a shared cache's copy anyway — the unlocked and locked answers differ —
// but bytes only an unlocked visitor may see should not sit in a cache nobody
// here controls, and `private` is the one word that says so.
export const PRIVATE_CACHE_CONTROL = "private, max-age=0, must-revalidate";

/**
 * Appended to every paste served as HTML, so Thmanyah Sans applies to all of
 * them (see the stylesheet for what it overrides). It goes after the document
 * rather than before it — prepending anything ahead of a `<!DOCTYPE>` would
 * drop the page into quirks mode — and it is a link to the app origin rather
 * than an inline block, so one cached stylesheet covers every paste and the
 * bytes added per response stay this one line.
 */
const FONT_LINK = `<link rel="stylesheet" href="${config.appUrl.replace(/\/$/, "")}/fonts/thmanyah.css">`;

/**
 * A content type that names UTF-8. Browsers only guess an encoding when they
 * are not told one, and their guess is not UTF-8 — which is what turns Arabic
 * (and every other non-Latin script) in a paste with no `<meta charset>` into
 * mojibake. The stored type comes from the uploaded file, which carries no
 * charset, so this is where it gets one; a paste that declared its own is left
 * alone.
 */
export const utf8 = (contentType: string) =>
  /;\s*charset=/i.test(contentType)
    ? contentType
    : `${contentType}; charset=utf-8`;

/**
 * Every answer that is not the paste itself: not found, withheld, disabled,
 * unreachable. `no-store` on all of them, so a takedown or a delete can never
 * be contradicted by something a cache kept.
 */
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
 * Looks a paste up by custom subdomain or public token. `unlockToken` is the
 * visitor's unlock session, if they hold one; without a valid session a
 * password-protected paste comes back `locked` and carries no content URL.
 */
export const lookupPaste = (subdomain: string, unlockToken?: string) =>
  convex.query(api.pastes.resolveForRuntime, { subdomain, unlockToken });

/**
 * `lookupPaste`, plus the `Response` to send instead when the paste is missing
 * or withheld — so every surface answers an unavailable paste identically. The
 * wildcard runtime uses `lookupPaste` directly, because it answers a locked
 * paste with the unlock challenge rather than a bare 401.
 */
export async function resolvePaste(
  subdomain: string,
  unlockToken?: string,
): Promise<AvailablePaste | Response> {
  const paste = await lookupPaste(subdomain, unlockToken);

  if (!paste) return plain(404, "Paste not found.");
  // ponytail: the unlock session is a host-only cookie on the paste origin, so
  // it is never sent to the app origin — raw and preview stay closed for a
  // protected paste. Give them their own challenge if that becomes a real ask.
  if (paste.locked) return plain(401, "This paste is password protected.");
  if (!paste.url) return plain(404, "Paste content is unavailable.");
  return { ...paste, url: paste.url };
}

/**
 * Streams the stored bytes through under the caller's headers — unchanged,
 * apart from the stylesheet link an HTML document picks up at the end. The
 * ETag is Convex's stored SHA-256 digest — computed by File Storage when the
 * bytes landed and re-read on every resolve, so replacing a paste's content
 * changes the digest, and with it the ETag, with nothing to keep in sync.
 * A conditional request is therefore answered without ever reading storage.
 */
export async function serveStored(
  request: Request,
  paste: AvailablePaste,
  headers: Record<string, string>,
): Promise<Response> {
  const etag = `"${paste.sha256}"`;
  const responseHeaders = {
    ...SECURITY_HEADERS,
    "Cache-Control":
      paste.visibility === "protected" ? PRIVATE_CACHE_CONTROL : CACHE_CONTROL,
    ETag: etag,
    ...headers,
    "Content-Type": utf8(headers["Content-Type"] ?? "text/plain"),
  };

  // Only the surfaces that render the paste as a document get the font; the raw
  // endpoint hands over source text and must stay byte-for-byte the upload.
  const suffix = responseHeaders["Content-Type"].startsWith("text/html")
    ? new TextEncoder().encode(FONT_LINK)
    : null;

  if (matchesEtag(request.headers.get("if-none-match"), etag))
    return new Response(null, { status: 304, headers: responseHeaders });

  const stored = await fetch(paste.url);
  if (!stored.ok || !stored.body) return plain(502, "Could not load content.");

  // Never re-encoded and never rewritten in the middle: the bytes that were
  // uploaded, and then the stylesheet link.
  return new Response(suffix ? withSuffix(stored.body, suffix) : stored.body, {
    headers: {
      ...responseHeaders,
      "Content-Length": String(paste.contentLength + (suffix?.length ?? 0)),
    },
  });
}

/** The stream, then `suffix` — still streamed, nothing buffered. */
function withSuffix(body: ReadableStream<Uint8Array>, suffix: Uint8Array) {
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      flush: (controller) => controller.enqueue(suffix),
    }),
  );
}
