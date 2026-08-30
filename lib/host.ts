// Wildcard host routing. Every paste is served from its own origin
// (`<token>.pastehtml.assoli.site`), so hostname parsing decides whether a request
// belongs to the app or to untrusted user HTML. Kept pure and dependency-free
// so it is trivially testable and safe to run in Proxy.
import { RESERVED_SUBDOMAINS } from "@/convex/lib/validation";
import { config } from "./config";

/** Internal path the wildcard runtime is rewritten to. Never publicly routable. */
export const PASTE_RUNTIME_PREFIX = "/internal/paste";

/** Paths on a paste origin that serve the stored HTML. Everything else is 404. */
const RUNTIME_PATHS = new Set(["/", "/index.html"]);

/**
 * Lowercases a Host header and drops the port and any trailing root dot.
 * Returns `null` for anything that isn't a usable hostname — a malformed or
 * missing Host must never be coerced into a lookup.
 */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const value = host.trim().toLowerCase().replace(/\.$/, "");
  // IPv6 literals are bracketed: [::1]:3000.
  const bare = value.startsWith("[")
    ? value.slice(0, value.indexOf("]") + 1)
    : value.split(":")[0];
  return bare.length > 0 && bare.length <= 253 ? bare : null;
}

/** The app's own hostname, without the dev port. */
export const ROOT_HOST = normalizeHost(config.rootDomain)!;

/**
 * The paste subdomain a request is for, or `null` when the request belongs to
 * the main application. Reserved labels (`www`, `api`, …) deliberately resolve
 * to `null` so the app keeps serving them.
 */
export const pasteSubdomain = (host: string | null | undefined) =>
  subdomainOf(host, ROOT_HOST);

/**
 * `pasteSubdomain` against an explicit root, so the rules can be exercised for
 * a deployment root that is itself a subdomain (`pastehtml.assoli.site`) as
 * well as for `localhost`.
 */
export function subdomainOf(
  host: string | null | undefined,
  rootHost: string,
): string | null {
  const value = normalizeHost(host);
  if (!value) return null;

  const suffix = `.${rootHost}`;
  if (!value.endsWith(suffix)) return null;

  const label = value.slice(0, -suffix.length);
  // A wildcard certificate covers exactly one label, so `a.b.root` is not ours.
  // This also rejects any character that can't appear in a DNS label.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) return null;
  if (label.length > 63) return null;
  if (RESERVED_SUBDOMAINS.includes(label)) return null;

  return label;
}

/**
 * ponytail: a paste is a single file, so only the root path serves it. Add path
 * routing here if multi-file sites ever ship (Milestone 23).
 */
export function isRuntimePath(pathname: string): boolean {
  return RUNTIME_PATHS.has(pathname);
}
