// Controlled preview: the paste rendered as HTML, but on the app origin, so it
// is served under a CSP sandbox instead of the free rein it gets on its own
// wildcard host.
import type { NextRequest } from "next/server";
import { resolvePaste, serveStored } from "@/lib/paste-http";

// `allow-same-origin` is deliberately absent — that is the whole sandbox. Without
// it the document lands in an opaque origin: no app cookies, no app storage, no
// same-origin fetch to a privileged app API, no reading anything the signed-in
// user has. What is left is what a preview legitimately needs: its own scripts,
// forms, dialogs, and links that open a new tab.
const SANDBOX =
  "sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/p/[token]/render">,
) {
  const { token } = await ctx.params;
  const paste = await resolvePaste(token);
  if (paste instanceof Response) return paste;

  return serveStored(request, paste, {
    "Content-Type": paste.contentType,
    "Content-Security-Policy": SANDBOX,
  });
}
