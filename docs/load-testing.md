# Load testing

`scripts/load-test.mjs` is the whole harness: Node, no dependencies, one
promise pool, p50/p95/max and the status mix. It answers the four questions
Milestone 16 asks and nothing else.

```bash
npm run build && npm run start          # the numbers below are from a production build
node scripts/load-test.mjs read        <token> [n] [concurrency]
node scripts/load-test.mjs conditional <token> [n] [concurrency]
node scripts/load-test.mjs create             [n] [concurrency]
API_KEY=ph_… \
node scripts/load-test.mjs publish            [n] [concurrency]
node scripts/load-test.mjs views       <token> [n] [concurrency]
```

`BASE` overrides the target (default `http://localhost:3000`). Paste origins are
reached as `<token>.localhost:3000`, which resolves to the loopback with no DNS
setup; `fetch` refuses to send a `Host` header, so there is no shortcut around
that.

`create` and `publish` delete every paste they made before exiting. A token for
the read scenarios: `npx convex data pastes --limit 3`.

## Scenarios

| Scenario      | What it exercises                                                        |
| ------------- | ------------------------------------------------------------------------ |
| `read`        | Wildcard runtime: Convex resolve → signed URL → storage → bytes          |
| `conditional` | The same request with `If-None-Match`; a 304 that never reads storage    |
| `create`      | `POST /api/v1/pastes` anonymous — upload, `pastes.create`, both limiters |
| `publish`     | The same with an API key: key lookup, scope check, owned paste           |
| `views`       | One paste under sustained reads, and whether `viewsCount` keeps up       |

## Measured baseline

MacBook → Convex **dev** deployment over the public internet, Next 16.3.3
production server on the same laptop, 2026-08-30. Every number is dominated by
the laptop-to-Convex round trip, which on Vercel is a datacenter hop instead.
Treat the _differences_ as the finding, not the absolute times.

```
read         n=100 c=1    p50=230ms  p95=287ms   4.3 req/s   200×100
read         n=200 c=20   p50=220ms  p95=297ms  81.2 req/s   200×200
conditional  n=200 c=20   p50=106ms  p95=122ms 182.3 req/s   304×200
views        n=200 c=25   p50=232ms  p95=275ms  99.9 req/s   200×200
create       n=20  c=5    p50=611ms  p95=1021ms  6.9 req/s   201×20
create       n=60  c=10   p50=1063ms p95=1417ms  9.3 req/s   201×20 429×40
```

Isolating the hops (`ConvexHttpClient`, 30 calls each):

```
pastes.resolveForRuntime, hit    p50=105ms  p95=173ms  min=90ms
pastes.resolveForRuntime, miss   p50= 93ms  p95=101ms  min=88ms
/p/[token] metadata page                    ~100ms (curl, warm)
/p/[token]/render                           ~220ms
```

So a paste read is roughly one Convex round trip (~105ms, of which ~10ms is the
resolve itself — a miss costs 93ms and does no storage work) plus one fetch of
the stored object (~120ms), plus single-digit milliseconds of Next. The whole
point of the ETag is visible in the second line: **a conditional request costs
half a full read** and never touches File Storage.

> **That halving is local only — it does not survive contact with production.**
> Measured against `pastehtml.assoli.site` after the Milestone 20 region move:
> 339ms for a full read against 349ms for the 304, n=10 each, a difference
> inside the noise. The storage fetch a 304 skips is CDN-fronted and cheap; the
> Convex query it still makes is the whole cost. The ETag saves the bytes, not
> the wait. Keep serving it — it is bandwidth, and browsers revalidate
> unprompted — but do not budget latency against it. `docs/post-launch.md`
> Finding B has the numbers.

### What this says about the cache policy

Nothing is cached anywhere, on purpose (`lib/paste-http.ts`). A replacement, a
takedown or a delete has to be visible on the very next request, and the 304 is
what makes revalidating every time affordable. If a CDN is ever put in front of
this, the thing to cache is a paste's bytes keyed by ETag — never the resolve,
which is where deletion and disabling take effect.

### Analytics is not a bottleneck for delivery

`views` and `read` have the same p50 (232ms vs 220ms) and the same throughput:
the view recording runs in `after()`, so it is off the response path entirely.

It _is_ a lag in the counter. After 200 reads at ~100 req/s against one paste,
`viewsCount` was still climbing when the last response had already been sent,
and settled about 30 seconds later. Two reasons, and only one of them is real:

- **Local artifact**: one Node process ran all 200 deferred mutations, each a
  ~100ms round trip. On Vercel each request is its own invocation.
- **Real ceiling**: every view patches the same `pastes` document, so views of
  one paste serialize under Convex's OCC and retry each other. The `pasteViews`
  insert is fine — different documents, no contention. This is the ceiling the
  schema comment already names: `@convex-dev/aggregate` or a sharded counter is
  the fix, when a single paste's view rate justifies it.

Nothing was dropped or errored at any point, and no read ever waited on a write.

### Convex usage under load

- The read path is two indexed lookups (`by_custom_subdomain`, then `by_token`)
  plus one `_storage` system read. No `.collect()`, no filter, no table scan.
- The write path has two known contention points, both documented where they
  live: the global `paste:create` rate-limit row (`convex/rateLimit.ts`) and
  `pastes.viewsCount`. Both serialize rather than scale, and both are one
  component swap away if they ever matter.

## What cannot be measured here

- **A CDN, and Vercel's edge**: no deployment to test against. Cold starts,
  regional routing, concurrency limits and function timeouts are all unobserved.
  What can be said statically: the runtime route is `ƒ` (dynamic) in `next
build`, so every request runs a function; it does one Convex query and one
  storage fetch and streams the body through, holding no buffer.
- **Real production latency**: both hops above are laptop-to-cloud. In a Vercel
  region next to the Convex deployment, expect both to fall by most of their
  network cost.
- **Sustained load**: this is a burst harness against a dev deployment. It says
  nothing about hours of traffic, storage growth, or the retention sweep.
- **Anonymous publishing at rate**: the second `create` run shows the limiter
  doing its job (`paste:create`, 30 per 10s, shared by every anonymous author),
  so a creation load test measures the limiter, not the backend. Raise it in
  `convex/rateLimit.ts` first if the backend is what you meant to measure.
- **`publish`** was not run: it needs an API key, which needs a signed-in user.
  The path differs from `create` only by the indexed `by_key_hash` key lookup
  and the scope check.
