# Post-launch review

Milestone 23. Thirteen product ideas, a measured look at what production costs
and how fast it is, and a security pass over what is actually deployed. The
output is decisions, not features: **0 Now, 3 Later, 10 No** on the product
list, and two optimizations worth doing on the performance list.

The one fact that shapes every verdict below: **the product has no users.** In
the sixteen hours between two test bursts the backend served six calls. Every
"Later" is therefore a bet, and the first real user's first complaint outranks
all thirteen guesses. That is the argument for shipping nothing from section 1
today.

## When this was measured, and one caveat

All numbers were taken 2026-08-31, 08:10 to 08:20 UTC, from a client in Europe,
against `https://pastehtml.assoli.site`. Read-only throughout: nothing was
deployed, no setting was changed.

The Milestone 22 cutover was running while I measured. At the time, production
still served a Clerk **development** key (`pk_test_…cosmic-guppy-4959`) while a
`pk_live_` value sat unused in Vercel's production environment, and the Convex
deployment behind the site was the **dev** one, `agreeable-ibex-471`. The
production deployment `ceaseless-reindeer-646` had no environment variables and
no rows. So the usage figures in section 2 are test traffic on a dev deployment.
They are real, they are just not organic. Both deployments live in `eu-west-1`,
which is what makes the latency finding survive the cutover.

---

## 1. Product improvements

Two of these are already built and must not be built again. **Custom
subdomains** shipped in Milestone 14: `pastes.customSubdomain`, the
`by_custom_subdomain` index, `claimSubdomain`, an availability query and the
dashboard UI. **Sandboxed previews** shipped in Milestone 6: `/p/[token]/render`
serves the stored bytes under a CSP `sandbox` with no `allow-same-origin`.

| Idea                   | Verdict | Reasoning, and the trigger for a Later                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous expiration   | **No**  | A URL that keeps working is the product. Expiring anonymous pastes by default breaks every link anyone ever shared, to save storage that costs nothing: 287 objects, 20.1 MiB, against a 1 GB free tier. An opt-in `expiresAt` is a different, smaller feature; build that the day a takedown is too slow to be the answer.                                                           |
| Revision history       | Later   | Cheaper than it looks. File Storage objects are already immutable and content-addressed, so `replaceContent` only has to stop deleting the old one and write a `pasteRevisions` row (PRD §47). Doubles storage per edit. **Trigger:** the first support request that opens with "I overwrote my paste".                                                                               |
| Custom domains         | **No**  | Not a column. Per-customer TLS provisioning, domain verification, a paid Vercel plan (the project is on Hobby), and a host lookup that has to stay safe under `lib/host.ts`. Custom subdomains already cover the want. **Trigger:** a paying customer, which needs billing first.                                                                                                     |
| Multi-file sites       | **No**  | The schema is one `storageId` per paste and every serving surface assumes it. This needs a path map, a path router on the paste origin, relative-link rewriting, and a directory-traversal surface that does not exist today. It is PRD §4's "become a static-site host" non-goal. Different product.                                                                                 |
| CSS/JS asset uploads   | **No**  | Already solved without us. Inline `<style>` and `<script>` work today, and the load-test fixtures are literally `inline-css.html` and `inline-js.html`. CDN links work too. The narrow version of multi-file sites, with the same answer.                                                                                                                                             |
| GitHub integration     | **No**  | The REST API already is the integration. `curl -X POST … --data-binary @index.html` in a workflow step is the whole thing, and it belongs in `docs/api.md` as six lines. An OAuth app is a second thing to hold credentials for.                                                                                                                                                      |
| CLI                    | **No**  | `npx pastehtml index.html` replaces a one-line curl that needs no install, no npm namespace, no release process and no credential store. **Trigger:** publishing stops being one request, which only happens if multi-file ships. It will not.                                                                                                                                        |
| npm package            | **No**  | A typed client for one endpoint. **Trigger:** a second first-party client that is not a browser.                                                                                                                                                                                                                                                                                      |
| Webhook notifications  | **No**  | The delivery half is nearly free (Convex scheduler plus an action), but there is no event worth delivering. "Your paste was viewed" is noise, and "your paste was taken down" is an email, which this product cannot send. Build the event before the transport.                                                                                                                      |
| Templates              | Later   | The cheapest item here: one static array of three snippets in the publish form, no schema, no backend. Also the one with no evidence behind it, since nothing measures whether people open the editor and stall. **Trigger:** the first "what do I put in here".                                                                                                                      |
| Screenshots / previews | **No**  | Rendering a user's HTML server-side means running a headless browser over untrusted input, which is exactly the thing the whole architecture avoids (PRD §4). A third-party screenshot API means handing paste URLs to a vendor. `/p/[token]/render` is a live sandboxed preview and beats a stale PNG.                                                                               |
| Team workspaces        | Later   | `ownerId` is one Clerk `tokenIdentifier` string, compared directly in every ownership check. Sharing turns that string comparison into a membership lookup across roughly fifteen call sites plus a role model. Clerk Organizations gives the membership half free and none of the fifteen. **Trigger:** the first request for a second seat, which should arrive with a credit card. |
| Organization accounts  | **No**  | This is team workspaces with billing attached. It is not a separate item and must not be scheduled as one.                                                                                                                                                                                                                                                                            |

---

## 2. Performance and cost

### Measured

| Measurement                                     | Value                                | Source                                                                      |
| ----------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Vercel function region                          | `dub1` (Dublin) — was `iad1`         | `GET /v9/projects/…` → `serverlessFunctionRegion`                           |
| Convex region, dev and prod deployments         | `eu-west-1` (Ireland)                | `.env.local`; `ceaseless-reindeer-646.eu-west-1.convex.cloud/version` → 200 |
| Convex round trip, measured inside the function | **p50 17ms** — was 101ms, p95 117ms  | `/api/health` `ms` field                                                    |
| Edge-cached asset, never reaches a function     | p50 234ms, n=12                      | `curl /favicon.ico`, `x-vercel-cache: HIT`, `x-vercel-id: fra1::`           |
| `/api/health` end to end                        | p50 444ms, p95 487ms, n=20           | curl                                                                        |
| Paste read, 200                                 | **p50 339ms**, p95 375ms — was 599ms | curl, n=10, after the region move                                           |
| Paste read, 304 with `If-None-Match`            | **p50 349ms**, p95 364ms — was 575ms | curl, same paste, same run                                                  |
| Marketing page `/`                              | p50 357ms, n=10                      | curl                                                                        |
| Builds, whole project history                   | 18 deployments, 527s total, avg 29s  | `GET /v6/deployments`                                                       |
| Vercel plan                                     | Hobby                                | `GET /v2/teams`                                                             |

### Finding A: the function was 5,500 km from the database — fixed

> **Resolved during Milestone 20.** `serverlessFunctionRegion` is now `dub1`,
> beside Convex's `eu-west-1`. Re-measured after the move: the Convex round trip
> inside the function went 101ms → **17ms**, and a paste read went 599ms →
> **339ms**. The rest of this section is kept because it is the arithmetic that
> found it, and because the same mistake is one project setting away.

`x-vercel-id: fra1::iad1::…` on every response. The request entered at
Frankfurt, the function ran in Washington, and the database answered from
Ireland. Every request crossed the Atlantic twice.

The arithmetic fell out of the table. A request that stops at the edge costs
234ms. `/api/health` cost 444ms, and reported that 101ms of that was spent
inside Convex. The remaining ~109ms was the Frankfurt-to-Washington leg. So
**~210ms of a 599ms paste read was the region mismatch** — one project setting,
no code, and the largest win available anywhere in this document.

Both Convex deployments are in `eu-west-1`, so the cutover did not fix this on
its own; the region had to be changed by hand.

### Finding B: the ETag stopped buying latency

`docs/load-testing.md` and the `CACHE_CONTROL` comment in `lib/paste-http.ts`
both claim a conditional request costs half a full read, measured locally at
106ms against 230ms. In production it costs 96% of one: 575ms against 599ms.

The reason looked like Finding A: the storage fetch a 304 skips is only ~24ms,
because Convex File Storage sits behind a CDN, while the Convex _query_ a 304
still makes was the transatlantic hop.

**Re-measured after the region move, and the conclusion survives it**: 349ms
conditional against 339ms full, n=10 each — the 304 is now, if anything,
marginally slower, and the difference is inside the noise. The storage fetch was
never the expensive part. The ETag saves the bytes; it does not save the wait,
at any region. Correct the claim in `docs/load-testing.md` rather than acting on
it. A conditional request is still worth serving — it is bandwidth, and it is
what a browser does unprompted — but nobody should expect latency from it.

### Convex usage, 16.7 hours of function logs

The log window the CLI returns is 1,001 entries covering 2026-08-30T15:35Z to
2026-08-31T08:16Z. Totals: 999 calls, 2.71 MB read, 6,229 documents read,
209,865 bytes written, 539 documents written, 17.4s CPU. Errors were 22, all
expected rejections (invalid API key, missing scope, sign-in required, reserved
subdomain). Nothing crashed.

| Table            | Rows  |     | Storage        | Value                        |
| ---------------- | ----- | --- | -------------- | ---------------------------- |
| `pastes`         | 282   |     | Objects        | 287                          |
| `pasteViews`     | 1,278 |     | Total bytes    | 21,098,403 (20.1 MiB)        |
| `rateLimits`     | 16    |     | Largest object | 5,241,801 (the 5 MB ceiling) |
| `apiKeys`        | 6     |     | Unreferenced   | 5 objects                    |
| `pasteUnlocks`   | 5     |     |                |                              |
| `unlockAttempts` | 4     |     |                |                              |
| `folders`        | 1     |     |                |                              |
| `abuseReports`   | 1     |     |                |                              |

`npx convex insights` reports 3 warnings in 72 hours, all OCC retries, all on
`rateLimits`, from `pastes.create`, `pastes.update` and `pastes.setPassword`.
Five retries total, zero permanent failures, zero read-limit events. The serving
path is healthy: `pastes.resolveForRuntime` runs 397 read bytes on a cache miss,
hits Convex's query cache half the time, and peaks at 22ms.

### Cost

Vercel is on Hobby, so builds and bandwidth are free and will stay free at this
volume. Two things Hobby costs that are not money: no log drain, which is why
`docs/operations.md` describes alerting as a manual step, and a terms-of-service
ban on commercial use, which is a decision to make before charging anyone.

Convex is on the free tier and nowhere near it. Dollar amounts are **not
measurable from here**: the CLI exposes no billing surface, and I am not going
to extrapolate a monthly bill from sixteen hours of load-test traffic.

### The optimizations worth doing

Two, and then it stops.

**1. ~~Move the Vercel function region to `dub1` or `arn1`.~~ Done in Milestone
20** — `dub1`, verified at 339ms against 599ms. Saved ~210ms of a
599ms paste read, on every request, for every visitor. Cost one setting change
and a redeploy. Do it now.

**2. Give `storage.sweepOrphans` a watermark.** `convex/storage.ts:83-106`
paginates the entire `_storage` system table from cursor `null` every hour and
does a `by_storage` lookup on `pastes` for every file, then discards anything
inside the one-hour grace. The work is O(total files ever stored) per hour, not
O(orphans). Today that is 52 executions burning 2.09 MB read, 4,602 documents
and 11.01s CPU in 16.7 hours, which is **67% of all bytes read, 74% of all
documents read and 63% of all CPU on the deployment**, to find five orphans on a
site with no users.

Per stored file it is about 10.5 KB of database bandwidth per day. Free-tier
bandwidth is 1 GB a month, so **the sweep alone consumes the entire free
allowance at roughly 3,000 stored pastes**. That is the trigger. The fix is to
persist the last `continueCursor` in a singleton row and resume from it, or to
have `generateUploadUrl` write a marker row that `create` deletes, which makes
the sweep O(unattached uploads).

**There is no third.** The two remaining candidates both already carry their own
named trigger in the code that owns them, and neither has fired: the shared
`anon` row in `convex/rateLimit.ts` (five OCC retries in 72 hours, none fatal)
and the `pastes.viewsCount` patch (`convex/schema.ts` already names
`@convex-dev/aggregate` as the answer). Swapping in a component before a single
real view has been recorded would be building for a load nobody has produced.

### Not measurable from here

- **File-storage egress.** `storageReadBytes` and `networkEgressBytes` are 0 on
  all 1,001 log rows, because the bytes are fetched from a signed URL and never
  run a Convex function. 20.1 MiB is what sits at rest. How much of it gets
  served is only visible on the dashboard usage tab.
- **Function-level detail older than 16.7 hours.** A `--history 5000` request
  returns 1,001 rows. The 72-hour OCC evidence comes from `insights`, which
  prints counts and no byte payloads.
- **Real production latency under load.** Every number above is a single client
  probing an idle deployment. Concurrency, cold starts and regional spread are
  unobserved, exactly as `docs/load-testing.md` already warns.
- **Anything about organic traffic.** There is none.

---

## 3. Security and developer experience

Milestone 15 did the hardening pass and `convex/security.test.ts` pins it. I
looked for what changed since, not for what it already covers. **Nothing has
drifted.** Every function added after the hardening commit that touches Convex
lives in `convex/migrate.ts`, and all seven are `internal*`, unreachable from a
browser, an API key or `/mcp`. The deterministic scan for identity-from-argument,
missing ownership comparison, cross-account reads and unchecked parent
references returned zero hits in public functions. `folders:read` and
`folders:write` are genuinely enforced in all five public functions of
`convex/folders.ts`, and `lib/api.ts` still makes no authorization decision of
its own, which is correct, since a scope check at the edge is skippable through
the public Convex URL.

### One finding worth acting on

**`pastes.unlock` never charges the success path, and nothing sweeps
`pasteUnlocks`.** `convex/pastes.ts:770-799` calls `enforce` only on a failed
password. A success is free and unmetered, and each one inserts a 12-hour
session row. The comment above the cleanup loop says the table "never needs a
sweep of its own", and `convex/crons.ts` takes it at its word, but that loop only
deletes rows that have already _expired_. Live sessions accumulate without
bound.

Anyone holding a protected paste's password can loop against the public Convex
URL. Past roughly 16k live sessions on one paste, the `.collect()` inside
`unlock` and the identical one in `revokeUnlocks` (`convex/pastes.ts:668-675`)
exceed Convex's per-transaction read limit, at which point `unlock`,
`setPassword` and `removePassword` all throw for that paste. **The owner can no
longer change or remove the password, and no visitor can unlock it.** Fix is one
line: `await enforce(ctx, "paste:write", writeClient(paste))` before the insert.

Two lesser items, neither urgent. `admin.report` caps at five per minute per
_reported_ paste rather than per reporter, and `admin.pending` reads the newest
200 rows and filters after, so a flood buries genuine reports. Worth an index on
the unresolved flag the first time a real report arrives. And `folders.list` /
`folders.get` return raw documents with no `returns` validator, so a future
column would ship to the client automatically. Cosmetic today, the same hazard
`apiKeys.list` already writes a validator to prevent.

### Rate limits: change nothing

Every value in `convex/rateLimit.ts` is untested against real traffic, because
there is no real traffic. Tuning them now would be guessing twice. The only
signal that exists is those five OCC retries, all on `rateLimits`, all under
load-test load, none fatal. The number that will eventually need changing is the
literal `"anon"` client key at `convex/pastes.ts:175`, which puts every anonymous
publisher on one document. The trigger is an OCC _failure_ in `npx convex
insights`, not a retry.

### API keys and MCP

Six API keys exist. All six were created by the e2e suite against the Clerk
development instance, three have a `lastUsedAt`, and every one belongs to the
same fixture user. **No human has used an API key in production.** There is
nothing to review yet, which is itself the finding: the MCP and REST
authorization model is proven by tests and by Milestone 13's live SDK check, and
by nothing else. Re-read this section after the first real key.

### The DNS incident I caused nothing of and watched anyway

For about three minutes during this review, `*.pastehtml.assoli.site` returned
NXDOMAIN at `ns1.vercel-dns.com` and **every published paste URL stopped
resolving**, while the app origin stayed up. Cause: paste hosting had been
relying on the zone-level `*` ALIAS to synthesize names two labels deep. The
moment the cutover created the first explicit record under `pastehtml` (the
Clerk `accounts` and `clerk` CNAMEs), that node existed in the zone and wildcard
synthesis stopped covering the subtree beneath it. RFC 4592, closest encloser.
An explicit `*.pastehtml` ALIAS was created a minute later and everything came
back.

Already fixed, so this is not a task. It is an invariant worth writing into
`docs/operations.md`'s DNS section, which currently says both records must read
Valid Configuration but not that adding an unrelated record under the same label
can silently remove the wildcard. `/api/health` would have stayed green through
the whole thing, because the marketing page and the health check both live on
the app origin. This is the outage the operations doc names and the check does
not catch.

### Developer experience

| Item                   | Verdict    | Reason                                                                                                                                                                                                                                                   |
| ---------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contributor docs       | **No**     | `README.md`, `docs/conventions.md` and `AGENTS.md` are the loop already. A CONTRIBUTING.md for one maintainer is a file to keep true for nobody. **Trigger:** a second contributor.                                                                      |
| Local wildcard tooling | **No**     | Browsers and macOS resolve every `*.localhost` to loopback with no hosts file and no DNS. `http://<token>.localhost:3000` works out of the box and the README says so. There is nothing to build.                                                        |
| Test fixtures          | Later      | `scripts/load-test.mjs` needs a token you fetch by hand from `npx convex data pastes`. A seed script would fix that. **Trigger:** the first time a spec fails because the deployment was empty rather than because the code was wrong.                   |
| API docs               | Now, small | `docs/api.md` is complete at 217 lines with one gap: the CI publish snippet that replaces the GitHub integration ruled out above. Six lines. Another milestone owns that file.                                                                           |
| MCP docs               | **No**     | `docs/mcp.md` covers setup for two client shapes, authentication, all five tools, the error table and a by-hand verification. Nothing is missing.                                                                                                        |
| Release notes          | **No**     | Eighteen deployments, one maintainer, no external consumer. `git log` is the changelog. **Trigger:** someone outside this repo depends on knowing when `/api/v1` changed.                                                                                |
| Dependency updates     | **No**     | `npm audit` reports 19 findings. All 19 are transitive under `@clerk/ui` (react-native, metro, the Solana wallet adapters), none reach a server or browser bundle, and none are fixable here. A bot would reopen those PRs every week until Clerk moves. |

One real detail inside that last row: `npm outdated` shows four packages behind,
all major bumps held on purpose (`eslint` 9→10, `typescript` 5→7, `lucide-react`
1.37→1.38), except `@types/node`, pinned at 20 while Vercel runs the functions on
Node 24 and CI runs 22. That mismatch is worth one line in `package.json` and is
not worth a bot.
