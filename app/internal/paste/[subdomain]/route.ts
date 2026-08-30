// The wildcard paste runtime. Reachable only through the rewrite in `proxy.ts`,
// which means the request arrived on `<subdomain>.pastehtml.assoli.site` — a distinct
// origin from the app, so nothing here is authenticated and no app cookie is
// readable by the HTML we serve.
import { after, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import { convex, resolvePaste, serveStored } from "@/lib/paste-http";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/internal/paste/[subdomain]">,
) {
  const { subdomain } = await ctx.params;
  const paste = await resolvePaste(subdomain);
  if (paste instanceof Response) return paste;

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
  return serveStored(request, paste, { "Content-Type": paste.contentType });
}
