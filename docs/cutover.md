# Production cutover

Milestone 21 asks for production traffic to be moved off the Rails application.
**There is nothing to move it off.** This repository is a rebuild from an empty
tree, not a strangler around a running app: `pastehtml.assoli.site` has served
this Next.js project and only this project since the domain was attached, and
`docs/decommission.md` §1 proves no Ruby, no legacy database and no legacy host
are involved in serving a request.

So the milestone is a launch, not a switch, and half its checklist has no object
to act on (§1). What remains is worth having and is the rest of this file: prove
every public surface answers on the production hostname (§3), know which number
means roll back (§4), and be able to roll back (§5).

Verified 2026-08-31 against the live site. Re-run §3 after any deploy that
touches routing, `proxy.ts`, DNS or auth — it takes under a minute.

---

## 1. The items with no object

Every one of these is blocked on a legacy source that does not exist. None is
done, none is skipped, and none can be faked; the third column is the trigger
that puts it back on the board.

| Checklist item                            | Why it does not apply                                                       | Becomes live when                      |
| ----------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| Complete final migration rehearsal        | Nothing to rehearse against; no staging Rails, no snapshot                  | `docs/migration.md` §7                 |
| Legacy writes into maintenance/read-only  | No legacy writer to freeze                                                  | `docs/migration.md` §2                 |
| Export final legacy data                  | `scripts/export-legacy.rb` has never run; every field name in it is a guess | `docs/migration.md` §1, then §5 step 1 |
| Import final data to Convex               | No export directory exists to import                                        | `docs/migration.md` §5 step 3          |
| Upload final HTML files                   | Same — the bytes ride inside the import, not separately                     | `docs/migration.md` §5 step 3          |
| Validate counts                           | Nothing to compare against                                                  | `docs/migration.md` §5 step 4          |
| Validate hashes                           | Nothing to compare against                                                  | `docs/migration.md` §5 step 4          |
| Validate sample URLs                      | Nothing to compare against                                                  | `docs/migration.md` §5 step 4          |
| Validate users                            | No legacy user table, so no `owners.json` to check                          | `docs/migration.md` §4                 |
| Validate folders                          | Nothing to compare against                                                  | `docs/migration.md` §5 step 4          |
| Validate protected pastes                 | Nothing to compare against                                                  | `docs/migration.md` §4                 |
| Resolve migration failures before cutover | No `import-report.json` to read                                             | `docs/migration.md` §6                 |
| Point production domain to Vercel         | Already the only configuration the domain has ever had                      | never, unless the domain moves         |

**Verdict: not done, and correctly so.** Claiming otherwise would be the only
dishonest line in this file.

---

## 2. Pre-cutover

Access, not ceremony: every row is one command whose failure is the thing you
did not want to discover mid-incident.

| Check                    | Command                                                          | 2026-08-31                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schema work frozen       | `git log --oneline -3 -- convex/schema.ts`                       | Judgement call. A schema push during the window is the one change with no instant rollback                                                                                           |
| Convex backup taken      | `npx convex export --prod --path ./pre-cutover.zip`              | Take one. Scheduled backups are a dashboard toggle and a **manual step** — `docs/operations.md` → Rollback                                                                           |
| Rollback plan            | §5 below, and `docs/operations.md` → Rollback runbooks           | Read, not assumed                                                                                                                                                                    |
| DNS access               | `vercel dns ls assoli.site`                                      | ✅ records listed; zone is on `ns1/ns2.vercel-dns.com`                                                                                                                               |
| Vercel rollback access   | `vercel ls pastehtml`                                            | ✅ production deployments listed, newest first                                                                                                                                       |
| Convex deployment access | `npx convex env list --prod`                                     | ✅ prod deployment `ceaseless-reindeer-646` reachable                                                                                                                                |
| Monitoring reachable     | Vercel → Observability; `npx convex dashboard`; Clerk → Sessions | ✅ all three; the signal table lives in `docs/operations.md` → Monitoring                                                                                                            |
| Error alerts             | `vercel env ls production \| grep SENTRY`                        | ❌ **`NEXT_PUBLIC_SENTRY_DSN` is not set.** `lib/sentry.ts` is inert, so nothing is captured and no alert rule can fire. Also no external uptime checker is pointed at `/api/health` |
| Maintainers notified     | —                                                                | One maintainer, who is running this                                                                                                                                                  |

The error-alerts row is the only real gap. It is a five-minute fix
(`docs/operations.md` → Error tracking → Turning it on) and it needs a redeploy,
because `NEXT_PUBLIC_*` is inlined at build time.

---

## 3. Traffic switch — verification

Two halves. The matrix below is the static surface — one request each, no state.
`npm run smoke` (`scripts/smoke.mjs`) is the moving half: it publishes, serves,
protects, unlocks, and deletes against real production, cleaning up after itself.

```bash
npm run smoke                       # 8 steps, ~12s, safe against production
```

```bash
b=https://pastehtml.assoli.site
for u in "$b/" https://www.pastehtml.assoli.site/ "$b/api/health" \
         "$b/sign-in" "$b/sign-up" "$b/dashboard" "$b/api/v1/pastes" "$b/mcp" \
         "$b/p/doesnotexist" "$b/p/doesnotexist/raw" "$b/internal/paste/foo" \
         https://nope-nope-nope.pastehtml.assoli.site/; do
  printf '%-62s %s\n' "$u" "$(curl -sS -o /dev/null -w '%{http_code}' "$u")"
done
```

| Surface                  | Request                                                                                                              | Expect                                                     | 2026-08-31                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------- |
| Root domain              | `GET /`                                                                                                              | 200                                                        | 200                              |
| `www`                    | `GET https://www.pastehtml.assoli.site/`                                                                             | 200                                                        | 200                              |
| Health                   | `GET /api/health`                                                                                                    | 200 `{"ok":true,"ms":N}`                                   | 200, `ms:102`                    |
| Wildcard, live paste     | `GET https://<token>.pastehtml.assoli.site/`                                                                         | 200, the exact published bytes                             | 200, byte-identical              |
| Wildcard, unknown        | `GET https://nope-nope-nope.pastehtml.assoli.site/`                                                                  | 404                                                        | 404                              |
| Runtime path leak        | `GET /internal/paste/foo` on the app host                                                                            | 404 (`proxy.ts` refuses it)                                | 404                              |
| API — publish            | `POST /api/v1/pastes` with an HTML body                                                                              | 201 + `token`, `updateToken`                               | 201                              |
| API — read               | `GET /api/v1/pastes/<token>`                                                                                         | 200 JSON                                                   | 200                              |
| API — wrong verb         | `GET /api/v1/pastes`                                                                                                 | 405                                                        | 405                              |
| API — bad key            | any `/api/v1/*` with `Authorization: Bearer ph_bogus`                                                                | 401                                                        | 401 (smoke step 7)               |
| MCP                      | `POST /mcp` `initialize`                                                                                             | 200, `serverInfo.name = "pastehtml"`                       | 200                              |
| MCP — no SSE stream      | `GET /mcp`                                                                                                           | 405 (stateless, by design)                                 | 405                              |
| Raw                      | `GET /p/<token>/raw`                                                                                                 | 200, `text/plain`, `nosniff`                               | 200, `text/plain; charset=utf-8` |
| Render                   | `GET /p/<token>/render`                                                                                              | 200 under the sandbox CSP                                  | 200                              |
| Paste page               | `GET /p/<token>`                                                                                                     | 200                                                        | 200                              |
| Unknown paste            | `GET /p/doesnotexist` and `/raw`                                                                                     | 404                                                        | 404, 404                         |
| Protected — origin       | `GET https://<token>.…/` on a protected paste                                                                        | 401 + password form                                        | 401                              |
| Protected — raw/render   | `GET /p/<token>/raw`, `/render`                                                                                      | 401                                                        | 401, 401                         |
| Protected — unlock       | `POST` the password to the paste origin                                                                              | 303 + `ph_unlock` cookie, `HttpOnly; SameSite=Lax; Secure` | 303, cookie set                  |
| Protected — after unlock | same `GET` carrying `ph_unlock`                                                                                      | 200                                                        | 200                              |
| Clerk callbacks          | `GET /sign-in`, `/sign-in/sso-callback`, `/sign-in/factor-one`, `/sign-up/continue`, `/sign-up/verify-email-address` | 200                                                        | all 200                          |
| Clerk gate               | `GET /dashboard` signed out                                                                                          | 307 → `/sign-in`                                           | 307                              |

### Clerk instance — read this before signing anything off

At the last check the deployed build still shipped the **development** instance
(`cosmic-guppy-4959.clerk.accounts.dev`; `x-clerk-auth-reason: dev-browser-missing`
on `/dashboard`), while the Convex production deployment already has
`CLERK_JWT_ISSUER_DOMAIN=https://clerk.pastehtml.assoli.site` — the **production**
instance, whose DNS (`clerk`, `accounts`, `clkmail`, `clk._domainkey`,
`clk2._domainkey` under `pastehtml`) is in the zone and resolving.

Those two halves disagree, and while they do, a signed-in request fails every
ownership check in Convex: the browser presents a dev-instance JWT that the
backend's issuer will not verify, so `ctx.auth.getUserIdentity()` is null. Nothing
anonymous is affected — publishing, serving, raw, unlock and MCP-with-API-key all
work, which is why §3 is green.

Confirm both halves agree before calling the cutover done:

```bash
curl -sS https://pastehtml.assoli.site/sign-in | grep -o 'https://[a-z0-9.-]*clerk[a-z0-9.-]*'
npx convex env get CLERK_JWT_ISSUER_DOMAIN --prod
```

The first must print `https://clerk.pastehtml.assoli.site` too. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
is inlined at build time, so changing it needs a **new deployment**, not a
rollback and not an env-var edit alone.

### DNS gotcha

`*.pastehtml.assoli.site` is served by Vercel's own managed record, not by
anything `vercel dns ls` prints. Adding records under `pastehtml` republishes the
zone: during the Clerk record additions, freshly-minted wildcard names answered
`NXDOMAIN` for a few minutes (`npm run smoke` failed at step 3 with
`ENOTFOUND`) while already-cached names kept serving. It resolved itself. Re-run
the wildcard row after **any** DNS edit, and do not diagnose it as an app fault:

```bash
curl -sS -H 'accept: application/dns-json' \
  'https://cloudflare-dns.com/dns-query?name=abc123.pastehtml.assoli.site&type=A'
```

`Status: 0` with an answer is healthy; `Status: 3` is NXDOMAIN. Ask a public
resolver rather than the local one, which caches negatives.

---

## 4. Post-cutover monitoring

`docs/operations.md` → Monitoring says _where_ every signal lives and holds the
steady-state thresholds. This section is only the window right after a cutover,
when the bar is lower and the response is "roll back", not "open a ticket".

Watch for one hour actively, then at the top of the next four hours.

| Signal                | Where                                                                              | Roll back when                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Health check          | `curl -sS …/api/health`, every minute                                              | Two consecutive non-200, or `ok:false`                                                                                                         |
| 5xx rate              | Vercel → Observability, by route                                                   | >1% over 5 min, or any 5xx on a paste-serving route                                                                                            |
| 4xx rate              | Vercel → Observability, by route                                                   | A 404 rate above baseline on `/p/*` or a wildcard host — that is pastes disappearing, the one failure this migration exists to prevent         |
| Missing-paste reports | Any channel a user reaches you on                                                  | One credible report of a URL that worked before                                                                                                |
| Convex errors         | Convex → Health, failure rate per function                                         | Any non-zero on a write (`pastes:create`, `pastes:update`)                                                                                     |
| Vercel errors         | Vercel logs, `"msg":"server error"`                                                | Any `route` value that was not erroring before                                                                                                 |
| Auth errors           | Vercel logs, `"msg":"api rejected"` + `UNAUTHORIZED`/`FORBIDDEN`; Clerk → Sessions | A step change, not a trickle. Until §3's Clerk paragraph is closed, expect this and fix forward rather than rolling back                       |
| API errors            | Vercel logs, `"msg":"api failed"` vs `"api request"`                               | >1%                                                                                                                                            |
| MCP errors            | Vercel logs, `"msg":"mcp tool failed"` vs `"mcp tool"`                             | >1%                                                                                                                                            |
| Storage failures      | Vercel → Observability, 502 on `/internal/paste/*` and `/p/*/raw`                  | Any. A 502 there is a returned `Response`, not a throw, so it has no log line — the status view is the only place it appears                   |
| Latency               | Vercel → Observability, p95 by route                                               | p95 on a paste route above ~1s sustained                                                                                                       |
| Traffic vs baseline   | Vercel → Observability, requests                                                   | Traffic that _drops_ is the alarming direction: it means the domain stopped resolving somewhere, and the app looks perfectly healthy from here |

`npm run smoke` is the cheapest of these and covers every one of them at once.
Run it as the first response to any of the rows above before deciding whether
the problem is real.

**With Sentry unconfigured (§2), nothing here pushes.** Every row is a screen
somebody has to look at. That is the whole reason for the one-hour window.

---

## 5. Rollback

`docs/operations.md` → Rollback runbooks holds the commands and the caveats; do
not copy them here, they drift. What this section adds is the order, because
during a cutover more than one thing may have changed at once.

1. **App only** (a bad build, a routing regression): `vercel rollback <url>`.
   Instant — an alias change, no rebuild. This is the default first move; a
   reverted deploy can be debugged calmly.
2. **App built with different `NEXT_PUBLIC_*`** (the Clerk key change in §3):
   a rollback restores the _old_ inlined value with the old build. That is
   usually what you want here, and it is also why fixing forward needs a new
   deployment rather than an env edit.
3. **Backend** (a bad Convex push): `npx convex deploy` from the last good SHA.
   No instant rollback exists. Take `npx convex export --prod` first.
4. **Schema + data**: snapshot restore, Convex dashboard → Settings → Backups.
   Reverting a schema that removed a field cannot bring the data back.
5. **DNS**: last resort and slowest — TTLs mean a bad record keeps being served
   for up to an hour. Lower the TTL _before_ a planned change, never during an
   incident.

There is no sixth step pointing the domain back at Rails, because there is no
Rails. The rollback target is always a previous deployment of this app.

**Validation window: 24 hours.** Rollback stays possible for as long as the
previous production deployment exists in `vercel ls` and no schema change has
landed since. A schema push is what ends the window early — which is the whole
reason §2 asks for the freeze.
