// The wildcard paste runtime. Reachable only through the rewrite in `proxy.ts`,
// which means the request arrived on `<subdomain>.pastehtml.assoli.site` — a distinct
// origin from the app, so nothing here is authenticated and no app cookie is
// readable by the HTML we serve.
import { after, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import { convex, lookupPaste, plain, serveStored } from "@/lib/paste-http";
import { UNLOCK_COOKIE, readCookie } from "@/lib/host";
import { challengePage } from "./challenge";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/internal/paste/[subdomain]">,
) {
  const { subdomain } = await ctx.params;
  const paste = await lookupPaste(subdomain, unlockToken(request));

  if (!paste) return plain(404, "Paste not found.");
  // Disabled beats locked: a paste taken down for abuse must not be openable
  // with the password its author set. `resolveForRuntime` withholds the URL
  // either way, so this only chooses which answer the visitor gets.
  if (paste.disabled) return plain(410, "This paste has been disabled.");
  if (paste.locked) return challenge();
  if (!paste.url) return plain(404, "Paste content is unavailable.");

  // Analytics never blocks delivery: `after` runs once the response is sent.
  // A bot is traffic, not a reader, so it is not recorded at all — neither the
  // total nor the breakdown. Only this route counts views, which is also what
  // keeps the app's own `/p/[token]/render` preview out of the numbers.
  const family = userAgentFamily(request.headers.get("user-agent"));
  if (family)
    after(() =>
      convex.mutation(api.pastes.recordView, {
        token: paste.token,
        referrer: request.headers.get("referer") ?? undefined,
        // Vercel's edge sets this; `@vercel/functions`' geolocation() reads the
        // same header, and a dependency for one header would be silly. Absent
        // locally, which is why the field is optional.
        country: request.headers.get("x-vercel-ip-country") ?? undefined,
        userAgentFamily: family,
      }),
    );

  // Isolation comes from the separate origin, not from a sandbox — deliberately
  // no frame or CSP rules, since a published page is meant to be embeddable and
  // to run its own scripts. The stored content type is used verbatim.
  return serveStored(
    request,
    { ...paste, url: paste.url },
    {
      "Content-Type": paste.contentType,
    },
  );
}

/**
 * The unlock challenge. Verification happens in Convex, which throttles by
 * (paste, client) and answers every rejection identically, so nothing here can
 * confirm whether a subdomain exists or a guess was close.
 *
 * A form POST is CORS-simple, so any page on the internet can submit one from a
 * visitor's browser — which would spread the per-address throttle across every
 * visitor that page has, and turn the unlock form into a distributed
 * password-guessing rig. Requiring our own `Origin` closes that; the answer is
 * the ordinary rejection, so nothing new is disclosed either.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/internal/paste/[subdomain]">,
) {
  const { subdomain } = await ctx.params;
  if (!sameOrigin(request)) return challenge("Incorrect password.");

  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  const result = await convex.mutation(api.pastes.unlock, {
    subdomain,
    password,
    client: clientId(request),
  });

  if (!result.ok)
    return result.reason === "throttled"
      ? challenge("Too many attempts. Try again later.", 429)
      : challenge("Incorrect password.");

  // Host-only (no Domain attribute), so the browser sends it to this paste's
  // subdomain and nowhere else. HttpOnly keeps it out of reach of the paste's
  // own scripts, which run on this very origin once it is unlocked.
  const cookie = [
    `${UNLOCK_COOKIE}=${result.unlockToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor((result.expiresAt - Date.now()) / 1000)}`,
    isSecure(request) ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/",
      "Set-Cookie": cookie,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * True unless the browser told us the submission came from somewhere else. A
 * same-origin form post sends this paste's own origin; a non-browser client
 * sends no `Origin` at all and is not what this guards against.
 */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    // A literal `null` origin throws here and is refused, which is the point:
    // it is what a sandboxed or `no-referrer` attacker page sends, and it names
    // nobody. This page's own form sends its real origin.
    // Same fallback as `proxy.ts`: the Host header is what routing ran on, and
    // the URL's host is what is left if a client omitted it.
    const host = request.headers.get("host") ?? new URL(request.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const challenge = (error?: string, status = 401) =>
  new Response(challengePage(error), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      // Not `no-referrer`: Chrome then sends `Origin: null` on this page's own
      // form post, which the same-origin check below cannot tell apart from a
      // hostile opaque origin. `same-origin` keeps the paste URL from leaving
      // this origin — and the page loads nothing anyway, under `default-src
      // 'none'` — while letting the browser name itself when it submits.
      "Referrer-Policy": "same-origin",
      // The challenge is ours, not the paste's: nothing it renders is
      // user-controlled, and nothing may be loaded from anywhere.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
    },
  });

/**
 * A coarse browser bucket, or `null` for a bot. The two things the user-agent
 * is read for, and the only place it is read: the string itself is close enough
 * to a fingerprint that storing it would be storing a person, so it never
 * leaves this function.
 *
 * ponytail: substring checks, not a user-agent database. It mislabels a spoofed
 * client and misses a novel crawler; ua-parser-js the day either costs anything.
 */
function userAgentFamily(header: string | null) {
  const ua = header?.toLowerCase() ?? "";
  if (
    /bot|crawl|spider|slurp|headless|monitor|preview|curl|wget|python|axios|node-fetch|okhttp|scrapy|libwww/.test(
      ua,
    )
  )
    return null;
  if (ua.includes("edg/")) return "edge" as const;
  if (ua.includes("firefox")) return "firefox" as const;
  if (ua.includes("chrome") || ua.includes("crios")) return "chrome" as const;
  if (ua.includes("safari")) return "safari" as const;
  return "other" as const;
}

const unlockToken = (request: Request) =>
  readCookie(request.headers.get("cookie"), UNLOCK_COOKIE);

const isSecure = (request: Request) =>
  request.headers.get("x-forwarded-proto") === "https" ||
  request.url.startsWith("https:");

/**
 * The caller's address, used only to throttle password attempts. Vercel sets
 * `x-forwarded-for` at the edge; locally there may be nothing, in which case
 * every dev request shares one bucket.
 */
const clientId = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
  request.headers.get("x-real-ip") ||
  "unknown";
