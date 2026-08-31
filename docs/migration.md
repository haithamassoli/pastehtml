# Legacy Rails migration

Moving production data out of the Ruby on Rails application and into Convex
without breaking a single existing paste URL.

> **Status: nothing here has been run.** The tooling, the format and the
> policies are finished and tested against a fixture set. The inventory below is
> blank because this repository contains no Rails source and no legacy database
> — every field name in `scripts/export-legacy.rb` is a guess you have to
> replace. The staging rehearsal, the duration measurement and the
> "repeat until clean" loop cannot start until that is done.
>
> Milestone 22 closed with this tooling unused and deliberately retained: the
> site launched on the new stack rather than cutting over from a legacy one, so
> the blank inventory is not unfinished work. See `docs/decommission.md` §2.

## The shape of it

```text
Rails  ──export-legacy.rb──▶  export/*.jsonl  ──migrate-import.mjs──▶  Convex
                                    │                                    │
                                    └──────── migrate-validate.mjs ──────┘
                                                      │
                                            discrepancy-report.json
```

Three programs and one file format. The export script runs inside the legacy
app and knows nothing about Convex; the import driver knows nothing about Rails;
the format in the middle is the contract, and it is derived from what
`convex/schema.ts` actually needs rather than from what Rails happens to have.

## 1. Inventory — fill this in against the real app

Nobody can complete this section from inside this repository. Do it against a
production replica before writing a line of export code, and write the answers
in here so the export script and this document stop disagreeing.

| Question                                                                     | Answer |
| ---------------------------------------------------------------------------- | ------ |
| Rails tables, and which ones matter                                          |        |
| `pastes` columns, types, nullability                                         |        |
| Row count: pastes                                                            |        |
| Row count: pastes with a custom subdomain                                    |        |
| Row count: anonymous pastes                                                  |        |
| Row count: password-protected pastes                                         |        |
| Token alphabet and length — **is it lowercase?** (see §6)                    |        |
| Where the HTML lives: column, disk, S3                                       |        |
| Largest stored HTML in bytes (the new cap is 5 MB)                           |        |
| Content types actually served (the new app allows `text/html`, `text/plain`) |        |
| Folder table: columns, and does it nest?                                     |        |
| Row count: folders                                                           |        |
| User table: columns, and is there an email on every row?                     |        |
| Row count: users                                                             |        |
| Password hashing scheme (bcrypt? cost?)                                      |        |
| Anonymous edit-token storage: raw or hashed?                                 |        |
| API keys: table, hashing scheme, row count                                   |        |
| OAuth / MCP credentials: tables, what they hold, row count                   |        |
| Analytics: table, row count, retention                                       |        |
| Anything else with a URL the public depends on                               |        |

## 2. Source of truth during the migration

- **Rails is authoritative until cutover.** The import is a copy, never a move;
  nothing in this repository writes to the legacy database or deletes from it.
- **After cutover, Convex is authoritative and Rails goes read-only.** Two
  writable copies of the same paste is the one state with no correct resolution,
  so it never exists: the switch is DNS, and it is atomic enough.
- **Between the export and cutover, a paste edited in Rails will not carry that
  edit across.** Either accept the window (the export is a snapshot; take it
  during a quiet hour) or freeze writes in Rails first. The import is idempotent
  and converges, so a second export taken after the freeze can be re-imported —
  but note that it will _not_ overwrite a row that already landed. Re-importing
  is a way to add records and fill in missing owners, not a way to update
  content; a paste whose HTML changed after its export has to be rolled back by
  token and re-imported.
- The rollback for the whole operation is DNS. Rails is untouched and still
  serving, so pointing the domain back at it is the recovery path.
  `internal.migrate.rollback` exists for resetting a _staging_ rehearsal, not
  for production recovery.

## 3. The export format

A directory holding four files. All timestamps are **milliseconds** since the
epoch (the importer rejects anything before the year 2000, which is what catches
an export that left them in seconds). Optional fields must be **absent**, not
`null`. `test/fixtures/legacy.ts` is a worked example of every case below, and
it is the same data the test suite imports.

### `manifest.json`

```json
{
  "format": "pastehtml-migration/1",
  "exportedAt": 1735689600000,
  "source": "rails://production",
  "counts": { "folders": 12, "pastes": 3410, "users": 87 }
}
```

### `owners.json` — legacy user id to Clerk `tokenIdentifier`

```json
{ "42": "https://clerk.pastehtml.assoli.site|user_2abc123" }
```

Written by you, not by the export (see §4). The export produces
`owners.template.json` with the left-hand side and each user's email filled in.

### `folders.jsonl` — one JSON object per line

| Field           | Type   | Notes                                          |
| --------------- | ------ | ---------------------------------------------- |
| `legacyId`      | string | Only used to join pastes to folders.           |
| `legacyOwnerId` | string | Must appear in `owners.json` or it is skipped. |
| `name`          | string | Folder identity in Convex is `(owner, name)`.  |
| `createdAt`     | number | ms                                             |
| `updatedAt`     | number | ms                                             |

### `pastes.jsonl` — one JSON object per line

| Field             | Type   | Required | Notes                                                      |
| ----------------- | ------ | -------- | ---------------------------------------------------------- |
| `legacyId`        | string | yes      | Appears in the reports, nowhere else.                      |
| `token`           | string | yes      | The public token, preserved verbatim. Lowercase DNS label. |
| `legacyOwnerId`   | string | no       | Absent means anonymous.                                    |
| `legacyFolderId`  | string | no       | Joined against `folders.jsonl`.                            |
| `filename`        | string | yes      | Used for `Content-Disposition`.                            |
| `title`           | string | no       | Trimmed on import, max 200 chars.                          |
| `description`     | string | no       | Trimmed on import, max 1000 chars.                         |
| `customSubdomain` | string | no       | 3–63 chars, DNS label, not reserved, not taken.            |
| `contentType`     | string | yes      | `text/html` or `text/plain`, optionally parameterized.     |
| `contentBase64`   | string | yes      | Base64 of the **raw bytes**, not of a re-encoded string.   |
| `sha256`          | string | no       | Hex digest of those bytes; checked before upload.          |
| `visibility`      | string | yes      | `"public"` or `"protected"`.                               |
| `password`        | string | no       | Plaintext, and only if it is genuinely recoverable (§4).   |
| `updateToken`     | string | no       | Raw anonymous edit code, ignored on an owned paste (§4).   |
| `viewsCount`      | number | yes      | The running total. Per-view rows are not migrated.         |
| `createdAt`       | number | yes      | ms — preserved exactly.                                    |
| `updatedAt`       | number | yes      | ms — preserved exactly.                                    |

Base64 rather than an inline string because a legacy paste is not guaranteed to
be valid UTF-8, and the whole migration is judged on a byte-for-byte comparison.
An encoding conversion in the export is the one corruption every later check
would agree was correct.

**The export directory is a secret.** It contains raw update tokens, possibly
raw passwords, and the full content of every private paste. Encrypt it in
transit and delete it once validation passes.

## 4. Credential and ownership policies

### Users and ownership

Every `ownerId` in this app is a Clerk `tokenIdentifier` (`"<issuer>|<subject>"`).
A legacy user row has no relationship to a Clerk identity, and no amount of
scripting can invent one — so ownership is mapped by hand through
`owners.json`, keyed on the legacy user id and populated after those users exist
in Clerk (via Clerk's own user import, matched on email).

**A paste whose owner cannot be resolved imports as anonymous.** Its URL keeps
working — which is the entire point of the migration — but it will not appear in
anyone's dashboard, and it has no update token, so nobody can edit it. This is
recoverable: fill in `owners.json` and run the import again. A second run over a
record that already landed patches in an owner it previously could not resolve,
and touches nothing that is already set. A folder cannot be anonymous, so a
folder whose owner is unresolved is skipped entirely and its pastes import
unfiled.

### Passwords — protection survives, the password does not

`convex/lib/password.ts` stores `pbkdf2-sha256$<iterations>$<salt>$<digest>`.
Rails will have stored bcrypt. There is no conversion between the two: a bcrypt
digest cannot be turned into a PBKDF2 one without the plaintext, which by
construction nobody has.

**Policy: import protected, closed, and require the owner to set a new
password.** A protected paste with no recoverable password gets a hash of a
fresh 32-character random secret that is never written down. Nothing opens it —
not the old password, not us — until its owner calls `setPassword`, which needs
only ownership, not the old password.

Rejected alternatives, and why:

- _Import as public._ Publishes content whose author chose not to publish it.
  Not a trade-off, just a data breach with extra steps.
- _Dual-verify: keep the bcrypt digest and check it on unlock._ It works, and it
  costs a bcrypt dependency, a `"use node"` action hop on every unlock, a second
  hash format in the schema, and a migration-on-successful-login path that lives
  forever because you can never prove the last user has come back. For a
  password on a shared HTML page it is not worth any of that.

The exception: if your legacy app stored the password **recoverably** — some old
apps did — put the plaintext in the `password` field and it is re-hashed on the
way in, and the paste opens with the password its author remembers. Today's
8-character minimum is deliberately not enforced on migrated passwords: a short
legacy password is still the one its author chose, and refusing it would break
the paste rather than protect anyone.

**Tell the affected owners before cutover.** They are a countable, named set —
the inventory tells you exactly how many.

### Anonymous update tokens

The same reasoning, with a better outcome: the new app stores only
`sha256(updateToken)`, so if Rails kept the edit code recoverably, put it in
`updateToken` and the author can still edit their paste after cutover. If Rails
hashed it with anything other than SHA-256, it cannot come across and that paste
becomes permanently read-only. It keeps serving; only editing is lost.

An owned paste never keeps an update token — `pastes.claim` retires it — so an
`updateToken` on a record that also has an owner is dropped rather than stored.

### API keys — do not migrate, reissue

`convex/lib/apiKeys.ts` stores `sha256(key)` and returns the raw key exactly
once. Rails will have done something equivalent. Legacy raw keys are therefore
unrecoverable, and a key that cannot be verified is not a key.

**Policy: no API keys are migrated.** Before cutover, email every account with
an active key: their key stops working on switchover day and they mint a new one
from the dashboard in about fifteen seconds. Carry across the key's _name_ and
_scopes_ in that email if you want to be kind; do not carry the row, because a
row that can never authenticate anything is just a lie in the table.

### OAuth / MCP credentials — do not migrate, reconnect

Same shape of problem, worse. Access and refresh tokens are bound to the legacy
app's client registration and its redirect URIs; the new MCP surface
(`app/mcp/route.ts`) authenticates with Clerk sessions and API keys, not with
whatever the Rails app issued. A migrated credential would authenticate against
a provider record that no longer exists.

**Policy: nothing is migrated. Users reconnect.** Revoke the legacy client
registration when Rails goes read-only, so a stale token cannot be replayed
against the old app either.

### Analytics

`pastes.viewsCount` — the number people actually look at — is migrated. The
per-view rows in `pasteViews` are not: the columns do not correspond (the new
table holds a coarse country, a referrer host and a browser bucket, and nothing
else), the rows expire on a retention sweep anyway, and re-deriving them from a
legacy schema would produce numbers that look precise and are not. If the
history matters, archive the legacy table as a file before decommissioning.

## 5. Running it

```bash
# 1. In the legacy app, after adapting every ASSUMPTION in the script:
bin/rails runner scripts/export-legacy.rb ./export

# 2. Import those users into Clerk, then fill in the mapping:
mv export/owners.template.json export/owners.json && $EDITOR export/owners.json

# 3. Import. Safe to interrupt, safe to re-run.
CONVEX_URL=https://your-deployment.convex.cloud npm run migrate:import -- ./export
npm run migrate:import -- ./export --prod        # when it is for real

# 4. Validate, and read the report.
npm run migrate:validate -- ./export --sample=200

# 5. Reset a rehearsal so you can run it again.
npm run migrate:import -- ./export --rollback
```

The import writes `export/import-report.json` (counts, per-record failures and
the wall-clock duration); the validation writes
`export/discrepancy-report.json` and exits non-zero if anything at all
disagrees, so it can gate the cutover from CI.

Both drivers reach internal Convex functions through `npx convex run`, because a
client library cannot call `internal.*` — which is the point of internal
functions. The bytes do not go that way: they are uploaded straight to File
Storage over a signed URL, exactly as a browser does when someone publishes.

### What validation checks

Presence, then per record: filename, title, description, custom subdomain,
visibility, view count, both timestamps, owner identity, content length, and
Convex's stored SHA-256 against the export's own digest. Then folder ownership
(a folder must belong to the same account as the paste filed in it), and
wildcard resolution through `pastes.resolveForRuntime` — the same query the
wildcard host and the raw endpoint use — for every paste with a custom subdomain
plus a spread sample of the rest, asserting that a protected paste answers
locked with no URL and a public one hands over a URL. For the sample it also
pulls the bytes back out of storage and compares them to the export byte for
byte, because the digest is computed by the same system being validated. Last it
walks every token in the deployment to count what landed and to name rows that
are in Convex but not in the export.

## 6. Records that cannot be migrated directly

These fail loudly, one report line each, and the run continues. Fix them at the
source and run the import again.

- **A token that is not a lowercase DNS label.** `pastes.resolveForRuntime`
  lowercases its argument before looking up either a custom subdomain or a
  token, so a stored token with an uppercase letter is unreachable at its own
  wildcard host and at `/p/<token>/raw`. If the legacy alphabet is mixed case —
  `SecureRandom.urlsafe_base64` is — this is not a per-record problem but a
  project decision, and it belongs in the inventory before anything else:
  lowercasing tokens changes URLs and can collide, keeping them means changing
  how the app resolves them. Neither is a thing to discover mid-run.
- **A custom subdomain that is reserved, malformed, or already taken.**
  `RESERVED_SUBDOMAINS` in `convex/lib/validation.ts` is the list. Failing is
  deliberate: silently dropping the subdomain would break a URL without anyone
  noticing, which is precisely what this migration exists to prevent.
- **Content over 5 MB, or with a content type the app does not serve.** The
  import runs the same `describeUpload` checks as a normal publish, so a
  migrated paste can never be one the app itself would have refused.
- **Timestamps before the year 2000.** Almost always an export still emitting
  seconds.
- **Nested folders.** The schema has one flat level. Flatten in the export.
- **API keys, OAuth and MCP credentials.** By policy, §4.
- **Per-view analytics rows.** By policy, §4.

## 7. Dry run, on staging

Everything below needs a production-like snapshot and a staging Convex
deployment. None of it has been done.

1. Restore a production snapshot into a staging Rails instance and run the
   export against it. Record how long the export takes and how large the
   directory is.
2. Import into a **preview or staging** Convex deployment. Never `--prod` for a
   rehearsal.
3. Record the wall-clock duration from `import-report.json`. That number is the
   cutover window, so measure it on data the size of production, not a sample.
4. Read the import log: every failure line, grouped by cause. Expect the first
   run to fail records; that is what it is for.
5. Run the validation and read `discrepancy-report.json`.
6. Fix the failures at the source — the export script, `owners.json`, or a
   decision about tokens and subdomains — and run the import again. It is
   idempotent, so this costs only the records that did not land.
7. Repeat 4–6 until the import reports zero failures and validation reports zero
   discrepancies and zero unexpected rows.
8. Prove the rollback: `--rollback`, confirm the deployment is empty, and import
   once more from scratch. A rehearsal you can only run once is not a rehearsal.
9. Only then schedule the production run.
