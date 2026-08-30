// Raw source retrieval, on the *app* origin. The stored bytes are returned
// unchanged, but never as `text/html`: rendering user HTML here would run it
// with the app's origin and cookies. `text/plain` plus `nosniff` makes the
// browser show source and nothing else — the wildcard host is where a paste
// executes.
import type { NextRequest } from "next/server";
import { resolvePaste, serveStored } from "@/lib/paste-http";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/p/[token]/raw">,
) {
  const { token } = await ctx.params;
  const paste = await resolvePaste(token);
  if (paste instanceof Response) return paste;

  return serveStored(request, paste, {
    "Content-Type": "text/plain; charset=utf-8",
    // RFC 5987 form: filenames are validated but may hold non-ASCII, and
    // percent-encoding also neutralises quotes in the header value.
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(paste.filename)}`,
  });
}
