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
  if (paste.locked) return challenge();
  if (!paste.url) return plain(404, "Paste content is unavailable.");

  // Analytics never blocks delivery: `after` runs once the response is sent.
  after(() =>
    convex.mutation(api.pastes.recordView, {
      token: paste.token,
      referrer: request.headers.get("referer") ?? undefined,
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
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/internal/paste/[subdomain]">,
) {
  const { subdomain } = await ctx.params;
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

const challenge = (error?: string, status = 401) =>
  new Response(challengePage(error), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      // The challenge is ours, not the paste's: nothing it renders is
      // user-controlled, and nothing may be loaded from anywhere.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
    },
  });

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
