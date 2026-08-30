import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import {
  PASTE_RUNTIME_PREFIX,
  UNLOCK_COOKIE,
  isRuntimePath,
  pasteSubdomain,
  readCookie,
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
    // Defence in depth. Clerk's cookies are host-only, so a paste origin should
    // never carry one; if a misconfigured Domain attribute ever made one
    // subdomain-visible, the runtime still must not receive it.
    return NextResponse.rewrite(url, {
      request: { headers: withoutCredentials(request.headers) },
    });
  }

  // The runtime route is reachable only through the rewrite above. A rewrite
  // does not re-enter Proxy, so this only ever sees an outside request.
  if (request.nextUrl.pathname.startsWith(PASTE_RUNTIME_PREFIX))
    return new NextResponse(null, { status: 404 });

  return clerk(request, event);
}

/**
 * Everything the browser might attach that could authenticate the app is
 * dropped. The `Cookie` header is rebuilt from scratch rather than filtered, so
 * the runtime can only ever see the paste's own unlock session — never a Clerk
 * cookie, however it was scoped.
 */
function withoutCredentials(headers: Headers): Headers {
  const stripped = new Headers(headers);
  stripped.delete("authorization");

  const unlock = readCookie(headers.get("cookie"), UNLOCK_COOKIE);
  if (unlock) stripped.set("cookie", `${UNLOCK_COOKIE}=${unlock}`);
  else stripped.delete("cookie");
  return stripped;
}

export const config = {
  // Host routing must see every request, including ones ending in a file
  // extension — a paste path such as `/index.html` would otherwise skip Proxy.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
