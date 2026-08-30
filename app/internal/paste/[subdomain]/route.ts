// The wildcard paste runtime. Reachable only through the rewrite in `proxy.ts`,
// which means the request arrived on `<subdomain>.pastehtml.assoli.site` — a distinct
// origin from the app, so nothing here is authenticated and no app cookie is
// readable by the HTML we serve.
import { after, type NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { env } from "@/lib/env";

const convex = new ConvexHttpClient(env.CONVEX_URL);

// The only headers the runtime adds to user HTML. Isolation itself comes from
// the separate origin, not from a sandbox — deliberately no frame or CSP rules,
// since a published page is meant to be embeddable and to run its own scripts.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

// ponytail: revalidate on every request so an update or delete is visible
// immediately; conditional requests keep it to a 304. Milestone 16 tunes this.
const CACHE_CONTROL = "public, max-age=0, must-revalidate";

/** RFC 9110 If-None-Match: a list of entity tags, or `*`. */
function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header
    .split(",")
    .map((value) => value.trim().replace(/^W\//, ""))
    .some((value) => value === "*" || value === etag);
}

function plain(status: number, message: string) {
  return new Response(message, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/internal/paste/[subdomain]">,
) {
  const { subdomain } = await ctx.params;
  const paste = await convex.query(api.pastes.resolveForRuntime, { subdomain });

  if (!paste) return plain(404, "Paste not found.");
  if (paste.visibility === "protected")
    // Milestone 9 replaces this with the unlock challenge page.
    return plain(401, "This paste is password protected.");
  if (!paste.url) return plain(404, "Paste content is unavailable.");

  // Analytics never blocks delivery: `after` runs once the response is sent.
  after(() =>
    convex.mutation(api.pastes.recordView, {
      token: paste.token,
      referrer: request.headers.get("referer") ?? undefined,
    }),
  );

  const etag = `"${paste.sha256}"`;
  const headers = {
    ...SECURITY_HEADERS,
    "Content-Type": paste.contentType,
    "Cache-Control": CACHE_CONTROL,
    ETag: etag,
  };

  if (matchesEtag(request.headers.get("if-none-match"), etag))
    return new Response(null, { status: 304, headers });

  const stored = await fetch(paste.url);
  if (!stored.ok || !stored.body) return plain(502, "Could not load content.");

  // Streamed through verbatim — the stored bytes are never rewritten.
  return new Response(stored.body, {
    headers: { ...headers, "Content-Length": String(paste.contentLength) },
  });
}
