# Operations

Everything needed to see what production is doing and to put it back when it
stops doing it. Read `README.md` first for how the pieces are deployed.

Three systems, three consoles:

| Layer                            | Console                          | CLI          |
| -------------------------------- | -------------------------------- | ------------ |
| Next.js app, paste runtime, edge | Vercel → the `pastehtml` project | `vercel`     |
| Database, storage, crons         | `npx convex dashboard`           | `npx convex` |
| Sessions and sign-in             | Clerk dashboard                  | `clerk`      |

---

## What production is

| Layer  | Production                                                       | Preview / dev                                                    |
| ------ | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Vercel | `pastehtml`, functions in `dub1`, Node 24.x                      | one deployment per branch                                        |
| Convex | `ceaseless-reindeer-646` (`eu-west-1`)                           | a fresh deployment per branch; personal dev per developer        |
| Clerk  | `ins_3IfmGPBvkwOsxpoaMKSulCuj41F`, `clerk.pastehtml.assoli.site` | the development instance, `cosmic-guppy-4959.clerk.accounts.dev` |

Vercel's build command is `npx convex deploy --cmd 'npm run build'`, so one
`git push` to `main` ships the app and the backend together: Convex deploys
first, injects `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` into
the `next build` that follows, then pushes functions, schema and crons. Those
two variables are therefore **not** set in Vercel — setting them would paper
over a broken deploy key instead of failing the build.

Which backend a build talks to is decided entirely by `CONVEX_DEPLOY_KEY`:

- **Production** holds a `prod:ceaseless-reindeer-646|…` key scoped to
  `deployment:deploy`.
- **Preview** holds a `preview:haitham-assoli:pastehtml|…` key. Convex mints a
  new deployment named after the branch, so a preview branch has no credential
  for the production deployment and cannot read production data. New preview
  deployments inherit `CLERK_JWT_ISSUER_DOMAIN` from the project's default
  environment variables (Convex dashboard → Project Settings), pointed at the
  Clerk _development_ instance.

Clerk is split the same way: Production carries the `pk_live_`/`sk_live_` pair,
Preview keeps the `pk_test_`/`sk_test_` pair so PR previews and the Playwright
specs keep working. Convex verifies Clerk JWTs through
`CLERK_JWT_ISSUER_DOMAIN`, set per deployment — production is
`https://clerk.pastehtml.assoli.site`. Each instance needs its own JWT template
named `convex` with `aud: convex`; without it every authenticated call fails.

Rotate the production Clerk secret and you must update `CLERK_SECRET_KEY` in
Vercel Production and redeploy — it is not read at runtime from Clerk.

**Manual step:** the production Clerk instance has Google sign-in **off**.
Clerk's shared OAuth credentials are development-only, so enabling it means
creating a Google Cloud OAuth client and entering it in the Clerk dashboard.
Until then production offers email + password only, while development offers
Google as well.

---

## What is instrumented

`lib/logger.ts` writes one JSON line per event to stdout, which is what Vercel's
log view and any drain attached to it collect. Every line carries `level`, `msg`,
`time`; request-scoped lines also carry `requestId`.

| Surface                                         | Where it logs                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `/api/v1/*` (all verbs)                         | `lib/api.ts` — `api request`, `api rejected`, `api failed`, `api rate limited` |
| `POST /mcp`                                     | `app/mcp/route.ts` — `mcp tool`, `mcp tool rejected`, `mcp tool failed`        |
| Everything else (paste runtime, dashboard, raw) | `instrumentation.ts` — `server error`, on any uncaught throw                   |
| Browser                                         | `instrumentation-client.ts` — reported to Sentry, not logged                   |
| Convex functions                                | Convex's own logs; `npx convex logs`                                           |

### Correlation ids

`lib/request-id.ts` reuses an incoming `X-Request-Id`, falls back to Vercel's
`X-Vercel-Id`, and mints a UUID only if neither is present. The id is bound to
every log line for that request and echoed back on the response, so a user who
reports "request `iad1::abc-123` failed" hands you the exact search term for
both our logs and Vercel's platform logs.

**The chain stops at Convex.** A Convex function has its own request id in the
Convex dashboard and no way to receive ours — passing one would mean an
unvalidated argument on every function signature. Correlate by function name and
timestamp instead: a `api failed` line at 14:32:07 pairs with the `pastes:create`
failure Convex logged in the same second.

<!-- ponytail: cross-system correlation is timestamp + function name, not a
     shared id. The upgrade is a `_meta: { requestId }` argument threaded through
     every Convex validator; worth it only when a single failure regularly costs
     more than a minute of log-scrolling to pin down. -->

### What is never logged

Paste HTML. A create or a replace carries the document as the request body, and
no log line touches the body — the operation is recorded as method plus path
(`POST /api/v1/pastes`) or as the MCP tool name.

Credentials. `lib/logger.ts` redacts any field whose _name_ matches
`password | token | secret | apikey | api_key | authorization | cookie | hash`,
walking nested objects **and arrays**, and separately scrubs anything matching
`ph_…` out of string values — the case where a key ends up inside an error
message or a URL rather than under a name that gives it away. `lib/logger.test.ts`
asserts one case per credential this codebase actually holds: `apiKey`,
`keyHash`, `updateToken`, `unlockToken`, `passwordHash`, `Authorization`,
`Cookie`.

---

## Error tracking

`lib/sentry.ts` posts exceptions straight to Sentry's ingest endpoint. There is
no `@sentry/nextjs` dependency and no build plugin: the whole integration is one
`fetch`, and it **does nothing at all** until a DSN is set, so an unconfigured
deployment neither sends nor collects anything.

### Turning it on

1. Create a Sentry project (platform: **Browser JavaScript** — the payloads this
   sends are plain envelopes and are accepted either way).
2. Copy the DSN from Settings → Projects → _project_ → Client Keys (DSN).
3. In Vercel → Project → Settings → Environment Variables, add
   `NEXT_PUBLIC_SENTRY_DSN` for Production and Preview. It is `NEXT_PUBLIC_` on
   purpose: the browser half reports through the same value. A DSN is a public
   ingest key, not a secret — but do not commit one, because a committed DSN is
   a DSN nobody can rotate without a code change.
4. Redeploy. `NEXT_PUBLIC_*` is inlined at build time, so an existing deployment
   will not pick it up.
5. Confirm it took: the `server started` log line on the next cold start reports
   `"errorTracking": true`.

Nothing else is required. `VERCEL_GIT_COMMIT_SHA` and `VERCEL_ENV` are set by
Vercel, so events arrive already labelled with the release and the environment
(`production` / `preview`), and a regression can be pinned to a commit.

### Source maps

Setting the DSN also flips `productionBrowserSourceMaps` in `next.config.ts`.
Next then emits `.js.map` files next to the bundles and serves them, and Sentry
fetches them from the deployment when it symbolicates — which is why nothing has
to be uploaded. The maps are publicly readable once served; that is the trade
for not running a build plugin, and it is why they are not emitted when the DSN
is unset.

**Server stacks are not symbolicated.** The Node bundle's maps stay inside the
Vercel function and no upload step exists to give them to Sentry, so a server
event shows the compiled frame. The compiled output is close enough to the
source to read in practice.

### Scrubbing

The event is built _through_ the same `redact()` pass the logger uses, so it is
never assembled in an unscrubbed form that a misconfigured `beforeSend` could
let through. `lib/sentry.test.ts` asserts that an API key handed in as context,
in an `Authorization` header, and inside the exception message are all absent
from the serialized payload.

### Ceiling

No breadcrumbs, no tracing, no release health, no sampling, no retry on a failed
report. Install `@sentry/nextjs` and delete `lib/sentry.ts` the day one of those
is worth the weight — `instrumentation.ts`, `instrumentation-client.ts`,
`lib/api.ts` and `app/mcp/route.ts` are its only callers.

---

## Monitoring

### The health check

`GET /api/health` runs one indexed Convex lookup for a token that cannot exist
and answers `{"ok":true,"ms":N}`, or 503 with `{"ok":false}`. It deliberately
does _not_ go through `route()`: no rate limit, so a checker polling every minute
cannot throttle itself into a false alarm.

It is not `/`. The marketing page renders without touching the backend and stays
green while every paste on the site is unreachable — which is the outage that
matters.

```bash
curl -sS https://pastehtml.assoli.site/api/health
```

**Manual step:** point an external uptime checker at it — one minute interval,
alert after two consecutive failures. Any free tier does (Better Stack,
UptimeRobot, Checkly). Vercel has no built-in uptime probe.

### The signals worth watching

Each row is a search you run, not a system that has been built.

| Signal                 | Where                | What to look for                                          | Act when                      |
| ---------------------- | -------------------- | --------------------------------------------------------- | ----------------------------- |
| Failed paste creates   | Vercel logs          | `"msg":"api failed"` with `"path":"/api/v1/pastes"`       | any sustained run             |
| Failed paste creates   | Convex Logs          | failures on `pastes:create` / `storage:generateUploadUrl` | any                           |
| Runtime 5xx            | Vercel Observability | status ≥ 500, grouped by route                            | >1% of requests over 5 min    |
| Runtime 5xx            | Vercel logs          | `"msg":"server error"` (from `instrumentation.ts`)        | any new `route` value         |
| API error rate         | Vercel logs          | `"msg":"api failed"` vs `"msg":"api request"`             | >1%                           |
| MCP error rate         | Vercel logs          | `"msg":"mcp tool failed"` vs `"msg":"mcp tool"`           | >1%                           |
| Convex function errors | Convex → Health      | failure rate per function                                 | any non-zero on a write       |
| Storage errors         | Vercel Observability | 502 on `/internal/paste/*` and `/p/*/raw`                 | any — storage is unreachable  |
| Auth failures          | Vercel logs          | `"msg":"api rejected"` with `UNAUTHORIZED` / `FORBIDDEN`  | a spike from one client       |
| Auth failures          | Clerk → Sessions     | sign-in failure rate                                      | a spike                       |
| Rate-limit spikes      | Vercel logs          | `"msg":"api rate limited"`                                | a spike, or one `bucket` only |
| Cron health            | Convex → Schedules   | last run of the four sweeps in `convex/crons.ts`          | any missed run                |

**Known gap:** the 502 a paste serves when its stored object cannot be fetched is
a returned `Response`, not a throw, so it never reaches `onRequestError` and has
no log line of its own. Vercel's status-code view is the only place it shows up.

<!-- ponytail: `lib/paste-http.ts` is Milestone 16's file, not this one's. Adding
     a `logger.error` beside the `502` there is a two-line change and the right
     fix the next time anyone touches it. -->

**Manual step:** alerts. Sentry alert rules (Alerts → Create Alert) on issue
volume and on new issues in `production` are the cheapest ones worth having.
Vercel cannot alert on log content without a paid log drain, so the table above
is read, not pushed — except for the uptime check, which pushes.

---

## Incident response

1. **Confirm scope.** `curl -sS https://pastehtml.assoli.site/api/health`, then
   load a known paste URL. App down, backend down and one paste broken are three
   different incidents.
2. **Find the id.** Take the `X-Request-Id` off the failing response and search
   Vercel's logs for it. Every line for that request is tagged with it.
3. **Place the failure.** `"msg":"api failed"` or `"mcp tool failed"` means our
   code caught it. `"msg":"server error"` means it escaped a route entirely.
   Neither means the failure is inside Convex — check `npx convex logs`.
4. **Check what changed.** `vercel ls` for the last app deploy, Convex dashboard
   → Deployments for the last backend push. An incident that starts within
   minutes of either has its cause named for it.
5. **Stop the bleeding before diagnosing.** Roll back (below). A deploy that is
   already reverted can be debugged calmly.
6. **Single abusive paste?** Do not roll back — disable it:
   `npx convex run admin:disable '{"token":"<token>"}'`, and
   `npx convex run admin:purge '{"token":"<token>"}'` if the content itself has
   to go. `npx convex run admin:pending` lists what has been reported.
7. **Write it down.** Add the trigger, the signal that caught it and the fix to
   this file — the table above should grow from real incidents, not guesses.

### Severity

- **SEV1** — nothing serves: `/api/health` failing, or every paste 5xx. Roll back
  the app first, ask questions second.
- **SEV2** — one surface is down (publishing fails, the dashboard errors, MCP
  errors) while published pastes still serve. Published pastes are the product;
  as long as they serve, there is time to fix forward.
- **SEV3** — one paste, one account, elevated error rate without user impact.
  Normal PR flow.

---

## Rollback runbooks

### Vercel: rolling back the app

The app and the backend deploy separately, so this is safe on its own **unless**
the bad deploy also pushed a Convex schema change — see the migration section.

```bash
vercel ls pastehtml                 # deployment URLs, newest first
vercel rollback <deployment-url>    # instant: repoints the production alias
```

The Vercel dashboard does the same thing: Deployments → the last known-good one
→ ⋯ → **Instant Rollback**. It is an alias change, so it takes seconds and needs
no build.

Caveat: `NEXT_PUBLIC_*` values are baked into the build being restored. Rolling
back to a deployment built before `NEXT_PUBLIC_APP_URL` or
`NEXT_PUBLIC_SENTRY_DSN` was set restores the old value with it. Change an env
var and you need a _new_ deployment, not a rollback.

### Convex: recovering the backend

Convex has no instant rollback. Recovery is redeploying the previous code:

```bash
git checkout <last-good-sha>
npx convex deploy            # pushes convex/ to the production deployment
git checkout main
```

`npx convex deploy` typechecks and bundles before it swaps functions, so a
broken push usually fails rather than lands. Watch it land with
`npx convex logs`.

Environment variables live on the deployment, not in the repo, so they survive a
code rollback and are rolled back separately:

```bash
npx convex env list
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<app>.clerk.accounts.dev
```

A wrong `CLERK_JWT_ISSUER_DOMAIN` is the one to check first when every
authenticated call starts failing at once: Convex cannot verify Clerk's JWTs, so
`ctx.auth.getUserIdentity()` returns null and every ownership check refuses.

Data recovery is a snapshot restore, from the Convex dashboard → Settings →
Backups (enable scheduled backups there — **manual step**, and worth doing before
the first real traffic). Point-in-time recovery is a Convex feature, not
something this app implements.

```bash
npx convex export --path ./snapshot.zip    # take one now, before touching data
npx convex import --replace ./snapshot.zip # destructive: replaces every table
```

### Migration rollback

> Milestone 19 is writing the migration tooling. **Cross-check this section
> against what it ships** — the shape below is the invariant, the commands may
> gain a wrapper.

Convex schema changes are pushed by `npx convex deploy` along with the functions,
so the app and the schema can be out of step in both directions. Two rules keep
a rollback possible:

1. **Deploy the schema first, the code that requires it second.** A new field is
   optional when it lands and only becomes required after every writer sets it.
   The old app then keeps running against the new schema, which is exactly what
   makes a Vercel rollback safe on its own.
2. **A backfill is separate from the schema change, and reversible or
   idempotent.** Re-running it must be harmless, because the recovery for a
   half-finished backfill is running it again.

To roll one back:

```bash
npx convex export --path ./pre-rollback.zip   # always, first
git checkout <sha-before-the-migration>
npx convex deploy
```

Reverting a schema that _removed_ a field cannot bring the data back — only a
snapshot restore can. That is why the export above is not optional.

### Domain and DNS recovery

The full setup is in `README.md` → Domains. What breaks and what to do:

**Pastes stop resolving, the app is fine.** The wildcard record or its
certificate is gone. Vercel → Project → Domains: both
`pastehtml.assoli.site` and `*.pastehtml.assoli.site` must read **Valid
Configuration**. A wildcard certificate is issued over DNS-01 only, so Vercel
must be able to write under the domain — either the zone is on Vercel's
nameservers, or `_acme-challenge.pastehtml` is delegated with two `NS` records
to `ns1.vercel-dns.com.` / `ns2.vercel-dns.com.`. A missing or edited delegation
is the usual cause.

**A record added under `pastehtml` took every paste down.** The zone has a
wildcard at its apex (`*.assoli.site`), and for a while that was what
synthesized `<token>.pastehtml.assoli.site`. Under RFC 4592 a wildcard never
synthesizes a name _below an existing node_, so the first explicit record under
`pastehtml` — the Clerk `clerk` / `accounts` / `clkmail` / `clk._domainkey`
CNAMEs — created that node and the entire paste namespace went NXDOMAIN until an
explicit `*.pastehtml` ALIAS was added. So:

> The `*.pastehtml` ALIAS → `cname.vercel-dns-017.com` record is load-bearing.
> Never delete it, and never assume the apex wildcard covers for it.

The failure signature is the nasty part: the apex keeps serving, `/api/health`
stays 200, and only paste URLs disappear — no monitor in this repo catches it.
After **any** DNS edit on `assoli.site`, ask a public resolver, because the
local one caches the negative answer:

```bash
dig +short "$(openssl rand -hex 4).pastehtml.assoli.site" @1.1.1.1
```

Two Vercel anycast addresses back is healthy; empty means every published paste
is unreachable.

**Everything stops resolving.** Check the nameservers at the registrar
(Namecheap → Domain List → `assoli.site` → Manage → Domain → NAMESERVERS). If
the zone was moved to Vercel and something else on `assoli.site` broke at the
same time, the MX and other records did not survive the move — recreate them in
Vercel's DNS.

```bash
dig +short pastehtml.assoli.site
dig +short anything.pastehtml.assoli.site
dig +short NS _acme-challenge.pastehtml.assoli.site
```

Do not hardcode the project's `CNAME` target from memory — Vercel issues each
project a unique one (e.g. `d1d4fc829fe7bc7c.vercel-dns-017.com`). Copy whatever
the Domains page shows.

DNS is the one layer with no instant rollback: TTLs mean a bad record can take an
hour to stop being served. Lower the TTL _before_ a planned DNS change, never
during an incident.
