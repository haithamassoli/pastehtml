import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import {
  PASTE_RUNTIME_PREFIX,
  isRuntimePath,
  pasteSubdomain,
} from "@/lib/host";

const clerk = clerkMiddleware();

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const subdomain = pasteSubdomain(host);

  if (subdomain) {
    // Paste origins never reach Clerk: no handshake, no session cookie, no
    // main-app credentials obtainable by the HTML we are about to serve.
    if (!isRuntimePath(request.nextUrl.pathname))
      return new NextResponse(null, { status: 404 });

    const url = request.nextUrl.clone();
    url.pathname = `${PASTE_RUNTIME_PREFIX}/${subdomain}`;
    return NextResponse.rewrite(url);
  }

  // The runtime route is reachable only through the rewrite above. A rewrite
  // does not re-enter Proxy, so this only ever sees an outside request.
  if (request.nextUrl.pathname.startsWith(PASTE_RUNTIME_PREFIX))
    return new NextResponse(null, { status: 404 });

  return clerk(request, event);
}

export const config = {
  // Host routing must see every request, including ones ending in a file
  // extension — a paste path such as `/index.html` would otherwise skip Proxy.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
