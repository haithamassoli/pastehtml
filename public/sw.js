// Service worker for the app origin only.
//
// A paste is served from `<token>.pastehtml.assoli.site`, a different origin, so
// nothing here can ever see, cache or intercept a published page — and this file
// is only reachable on the app host anyway, since `proxy.ts` answers everything
// but `/` on a paste origin with a 404.
//
// ponytail: hand-written, ~40 lines, no build step. Serwist/Workbox would mean
// a dependency, a webpack config and dropping Turbopack (`@serwist/next` hooks
// into webpack, which `next dev` never invokes). What is actually needed is
// "installable, and says something useful when the network is gone" — which is
// a precached shell page and one navigation fallback. Reach for Workbox the day
// real runtime caching strategies are wanted.
const CACHE = "pastehtml-shell-v1";
const OFFLINE_URL = "/offline";

// Never cached, never served from cache. Publishing, the REST API, MCP and
// every paste-content endpoint are request/response, not app shell: a stale
// answer for any of them would be wrong rather than merely old.
const BYPASS = /^\/(api|mcp|p|internal|sign-in|sign-up|monitoring)(\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Network-first, and only for page navigations. Anything the network can still
// answer is answered by the network, unchanged; the cache exists solely so a
// dropped connection produces a page instead of the browser's error screen.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || BYPASS.test(url.pathname)) return;

  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
