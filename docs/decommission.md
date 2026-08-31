# Legacy decommission

Milestone 22 asks for the Ruby/Rails infrastructure to be retired. **Nothing was
retired, because nothing was ever running.** This repository is a rebuild that
started from an empty tree, not a strangler around a live Rails app: there is no
Rails source here, no legacy database, no VPS, and no service the app calls that
someone would have to turn off. The one Ruby file in the tree is a template
export script that has never been run.

So the milestone reduces to two provable things — production depends on no Ruby
or Rails, and the architecture that replaced it is written down — plus an honest
disposition for the fourteen tasks that have no object to act on. All three are
below.

Verified 2026-08-31 against `main` and the live site.

## 1. No Ruby or Rails at runtime

| Check                            | Command                                                                                                              | Result                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Ruby files, Gemfile, Rakefile    | `git ls-files \| grep -Ei '\.(rb\|erb\|rake\|gemspec)$\|^(Gemfile\|Rakefile\|Procfile\|Dockerfile\|\.ruby-version)'` | `scripts/export-legacy.rb` and nothing else. No `Gemfile`, no lockfile, no `Rakefile`, no `Dockerfile` |
| Ruby in shipped code or CI       | `git grep -Iln -iE 'ruby\|rails' -- app lib convex proxy.ts package.json .github`                                    | Two hits, both prose: a comment header in `convex/migrate.ts` and one in `convex/compat.test.ts`       |
| Build toolchain                  | `vercel project inspect pastehtml`                                                                                   | Framework preset Next.js, Node.js 24.x, build `npm run build`. No buildpack, no custom image           |
| Production secrets               | `vercel env ls production`                                                                                           | Ten variables: one app URL, three Convex, six Clerk. No database URL, no legacy host, no API token     |
| Convex deployment env            | `npx convex env list`                                                                                                | One variable: `CLERK_JWT_ISSUER_DOMAIN`                                                                |
| What answers on the domain       | `curl -sSI https://pastehtml.assoli.site/`                                                                           | `HTTP/2 200`, `server: Vercel`, `x-powered-by: Next.js`                                                |
| Where the domain points          | `dig +short assoli.site NS`                                                                                          | `ns1.vercel-dns.com.` / `ns2.vercel-dns.com.` — the zone is Vercel's, no legacy A record to strand     |
| Outbound calls from runtime code | `git grep -Iho 'https://[a-z.-]*' -- app lib convex proxy.ts`                                                        | Convex and Clerk hosts, plus test fixtures. Nothing else is dialled                                    |

`scripts/export-legacy.rb` is the only `.rb` file and it is not a dependency of
anything: nothing imports it, no npm script invokes it, CI never sees it. It is
meant to be copied into a legacy Rails app and run there with `bin/rails runner`,
against a schema whose every field name the file itself marks as a guess. Its
presence in the tree costs a `.rb` extension and nothing else.

**Verdict: production runs on Vercel + Convex + Clerk. No Ruby interpreter, no
Rails process, no self-managed database or VM is involved in serving a request.**

## 2. What is retained, and why

The migration tooling stays. It is small, it is tested, and it is the only path
that exists if a legacy source ever materialises — deleting it would save nothing
and would have to be rewritten from `docs/migration.md` anyway.

| Artifact                                                                 | Status                                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `scripts/export-legacy.rb`                                               | Template, never run. Every `# ASSUMPTION:` marker is an unresolved schema guess         |
| `scripts/migrate-import.mjs`, `migrate-lib.mjs`, `migrate-validate.mjs`  | Driver, shared format helpers, validator. `npm run migrate:import` / `migrate:validate` |
| `convex/migrate.ts`                                                      | Import + rollback, all `internal*` — reachable only with a deploy key                   |
| `convex/migrate.test.ts`, `convex/compat.test.ts`, `test/compat.test.ts` | 38 tests, green. They exercise the format, the failure modes and token compatibility    |
| `test/fixtures/legacy-export.ts`, `test/fixtures/legacy/`                | The worked example of the export format                                                 |
| `docs/migration.md`                                                      | The contract and the runbook. Its own header states nothing has been run                |

Recommended, not done (this document does not own the file): the status banner
at the top of `docs/migration.md` should also say that Milestone 22 closed with
the tooling unused and retained, so a future reader does not take an untouched
inventory table for an unfinished task.

### Backups

There is no legacy database or file store, so there is no final backup to
archive. What would be archived, if there ever were one:

| Artifact                    | Where it would live                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final legacy DB dump        | Encrypted object storage, off the platform being retired, 12-month retention                                                                             |
| Final file-storage snapshot | Same bucket, same retention                                                                                                                              |
| Export directory            | Deleted after validation — it holds raw update tokens and possibly raw passwords (`scripts/export-legacy.rb` says so at the top)                         |
| Deployment configuration    | Committed here, not archived — the whole configuration is `next.config.ts`, `vercel.json`-free project settings, and the env var names in `.env.example` |

The live system's own backups are a different subject and belong to Convex:
see `docs/operations.md`.

## 3. Milestone 22, item by item

No item is ticked on the grounds that it was "not needed". Each says what it
would have meant and what actually happened.

| Task                                     | Disposition                                                                                                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Define stability validation period       | N/A — a validation period brackets a cutover from something. There was no cutover from a legacy system; the site launched on the new stack                                                                                   |
| Keep legacy environment read-only        | N/A — no legacy environment exists                                                                                                                                                                                           |
| Archive final legacy database backup     | N/A — no legacy database. Target location recorded above                                                                                                                                                                     |
| Archive final file-storage backup        | N/A — no legacy file storage                                                                                                                                                                                                 |
| Archive deployment configuration         | N/A — no legacy deployment. The current one is in git                                                                                                                                                                        |
| Archive migration scripts                | Done, by keeping them in the tree and stating their status here rather than moving them to an attic                                                                                                                          |
| Document old infrastructure dependencies | Done — the honest answer is that there were none in this repository; §1 is the evidence                                                                                                                                      |
| Remove production traffic from Rails     | N/A — no Rails ever served traffic for this deployment                                                                                                                                                                       |
| Disable legacy background jobs           | N/A — no legacy jobs. The only scheduled work is Convex crons, which are current                                                                                                                                             |
| Disable legacy API write paths           | N/A — the only write API is `/api/v1/*` and `POST /mcp`, both current                                                                                                                                                        |
| Remove unused secrets                    | Done, in the sense that there are none to remove: `vercel env ls production` is ten current variables, `npx convex env list` is one                                                                                          |
| Remove unused infrastructure             | N/A — nothing beyond the three managed services exists to remove                                                                                                                                                             |
| Remove unused database resources         | N/A — the only database is Convex                                                                                                                                                                                            |
| Remove unused VPS resources              | N/A — there is no VPS. The Vercel project has no attached compute beyond the functions it builds                                                                                                                             |
| Update project documentation             | Done — `README.md` gained a Deployment section stating the topology and that no runtime beside Node is involved, and this file                                                                                               |
| Update architecture diagrams             | N/A — there is no architecture diagram to update. `README.md` "Architecture" is a directory map and is current; `docs/migration.md` has the only diagram in the repo and it describes the migration path, which is unchanged |
| Confirm no runtime dependency on Ruby    | Done — §1                                                                                                                                                                                                                    |

Acceptance criteria:

| Criterion                                     | Verdict                                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Production no longer depends on Ruby or Rails | Met, and evidenced in §1 rather than asserted                                                                                           |
| Legacy data backups are safely retained       | Vacuously met — there is no legacy data. §2 records where a backup would go                                                             |
| Old infrastructure has been decommissioned    | Vacuously met — there is no old infrastructure attached to this deployment                                                              |
| New architecture is fully documented          | Met — `README.md` (stack, deployment, domains, architecture), `docs/operations.md`, `docs/api.md`, `docs/mcp.md`, `docs/conventions.md` |

## 4. If a real legacy environment ever needs retiring

Run this against it, in order. Nothing here has been executed.

1. Freeze writes at the source and confirm it: the legacy app answers reads and
   rejects every mutation. Read-only is the rollback, so it comes before anything
   destructive.
2. Take the final database dump and the final file-storage snapshot. Verify each
   restores into a throwaway instance — an unverified backup is not a backup.
3. Copy both into the archive named in §2, encrypted, with the retention clock
   started.
4. Run the migration: `docs/migration.md` §1 (inventory — the table is blank and
   cannot be filled from inside this repo), §7 (rehearse on staging until zero
   failures and zero discrepancies), then §5 for the production run.
5. Move DNS. That is the cutover, and it is also the rollback for the next 30
   days — which is why the legacy environment stays powered on and read-only for
   the whole window.
6. During the window: watch error rates and the compatibility of old paste URLs.
   `docs/operations.md` has the alerting.
7. After the window, and only then, in this order: disable background jobs, take
   the legacy app offline, revoke its credentials (database, object storage, mail,
   any third-party API key it held), destroy the database, destroy the VM or
   dyno, release the object storage bucket once the archive copy is verified
   again.
8. Delete the export directory. It holds raw update tokens.
9. Update `README.md` and this file with what was actually removed and when.
