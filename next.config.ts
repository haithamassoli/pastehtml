import type { NextConfig } from "next";

// The app's own hostname. `lib/config.ts` derives the same value, but
// next.config runs before the module graph and path aliases exist, so this one
// is read straight from the environment.
const rootHost = new URL(
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
).hostname;

/**
 * Every header below is scoped to the application's own host.
 *
 * That scoping is the whole point, and `has: [{ type: "host" }]` is the only
 * thing that can do it: a paste is served from `<token>.${rootHost}`, and Proxy
 * rewrites it to the runtime *after* these rules match, so a path-only rule
 * would match `/` on a paste origin too. A published page is meant to be
 * embeddable and to run its own scripts, so a frame or CSP rule reaching it
 * would break the product. Next anchors the value as a full regex and strips
 * the port, so `abc.pastehtml.assoli.site` does not match `pastehtml\.assoli\.site`.
 *
 * `www` is the one reserved subdomain a person actually browses; the rest
 * (`api`, `docs`, …) resolve to the app but nobody visits them in a browser.
 */
const appHost = [
  {
    type: "host" as const,
    value: `(?:www\\.)?${rootHost.replaceAll(".", "\\.")}`,
  },
];

/**
 * The pages that are the application talking to a signed-in user. Listed rather
 * than matched with a wildcard so the CSP can never reach `/p/[token]/render`,
 * which serves uploaded HTML under a `sandbox` CSP of its own — a second CSP
 * header there would be a fence to reason about instead of one.
 *
 * `/p/:token` matches a single segment, so the raw and render endpoints under
 * it are excluded by the pattern itself.
 */
const APP_PAGES = [
  "/",
  "/p/:token",
  "/dashboard/:path*",
  "/sign-in/:path*",
  "/sign-up/:path*",
  "/422",
  "/offline",
];

/**
 * ponytail: no `script-src`. Locking scripts down needs a per-request nonce
 * threaded through Proxy into Next's and Clerk's inline bootstrap, which also
 * makes every page dynamic — a real cost for a policy whose job here is depth,
 * not the primary defence. Uploaded HTML never enters this DOM (it is served
 * from its own origin, and the preview is an iframe), so what is left to close
 * is injection *around* React's escaping: a stolen `<base>`, a plugin object, a
 * form posting credentials elsewhere, and being framed by someone else.
 */
const CSP = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Emitted only when error tracking is on, because Sentry symbolicates browser
  // stacks by fetching these from the deployment itself — nothing is uploaded,
  // which is the entire reason `lib/sentry.ts` needs no build plugin. They are
  // publicly readable once served, so an unconfigured deploy does not ship them.
  productionBrowserSourceMaps: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  async headers() {
    return [
      {
        source: "/:path*",
        has: appHost,
        headers: [
          // The raw endpoint depends on this to keep user HTML as source text;
          // stating it once here covers everything else the app serves.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Paste URLs are shared, and a path can name what someone published.
          // The origin is all another site needs to see.
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // The dashboard previews a paste in a same-origin iframe, so
          // `SAMEORIGIN` rather than `DENY`. Mirrored by `frame-ancestors`
          // below for browsers that prefer the CSP.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Nothing in the app asks for a device. A paste origin is untouched
          // by this, so a published page keeps every capability it wants.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      ...APP_PAGES.map((source) => ({
        source,
        has: appHost,
        headers: [{ key: "Content-Security-Policy", value: CSP }],
      })),
      {
        // Every paste links this stylesheet from its own origin (see
        // `lib/paste-http.ts`), and a font file is always fetched in CORS mode
        // — without this header the browser downloads it and refuses to use it.
        // Nothing here is private: these bytes are the same for every visitor.
        source: "/fonts/:path*",
        has: appHost,
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      {
        // The service worker outlives a deploy unless the browser is told not
        // to keep it: a cached `sw.js` would go on serving the previous
        // shell. It is also the one script that can intercept navigations, so
        // it gets a policy that lets it load nothing at all.
        source: "/sw.js",
        has: appHost,
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
