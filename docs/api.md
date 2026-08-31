# REST API

Publish and manage pastes from a script, a CI job, or an AI agent. Base URL:

```text
https://pastehtml.assoli.site/api/v1
```

## Versioning

The version is in the path. `v1` is stable: a field may be **added** to a
response, but a field is never removed or repurposed, an error code never
changes its meaning, and an authorization rule never loosens without a new
version. A breaking change ships as `/api/v2` while `/api/v1` keeps working.

## Publishing with curl

```bash
curl -X POST https://pastehtml.assoli.site/api/v1/pastes \
     -H 'Content-Type: text/html' \
     --data-binary @index.html
```

The request body **is** the HTML — there is no JSON wrapper and nothing to
escape, so a pipe works too:

```bash
echo '<h1>hello</h1>' | curl -X POST https://pastehtml.assoli.site/api/v1/pastes \
     -H 'Content-Type: text/html' --data-binary @-
```

## Authentication

Three credentials, in decreasing order of privilege. All three are optional:
publishing anonymously needs none.

| Credential          | Header                        | Grants                                       |
| ------------------- | ----------------------------- | -------------------------------------------- |
| API key             | `Authorization: Bearer ph_…`  | Everything its scopes allow, on that account |
| Clerk session token | `Authorization: Bearer <jwt>` | Everything the signed-in user can do         |
| Update token        | `X-Update-Token: <token>`     | Manage one anonymous paste                   |

An **API key** is created at
[/dashboard/settings/api-keys](https://pastehtml.assoli.site/dashboard/settings/api-keys)
and shown once — only its SHA-256 is stored, so a lost key is replaced, never
recovered. Its scopes are checked inside the backend, not at the edge, so a key
can never do more by taking a different route in:

| Scope           | Allows                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `pastes:read`   | `GET` a paste, including its owner-only fields                         |
| `pastes:write`  | `POST` a new paste, `PATCH` an existing one                            |
| `pastes:delete` | `DELETE` a paste                                                       |
| `folders:read`  | Read folders                                                           |
| `folders:write` | Create, rename and delete folders, and move a paste into or out of one |

A key belongs to an account, so it can never manage a paste that belongs to
nobody. Give it an optional expiry date at creation, and revoke it at any time
from the same page — both take effect on the next request, with no way to tell
from the outside which of the two happened, or whether the key ever existed.
The dashboard also shows when each key was last presented, to the minute.

A **browser session** is the one credential a browser attaches by itself, so a
write authorized by nothing else must come from this site: a `POST`, `PATCH` or
`DELETE` carrying an `Origin` header from anywhere else is refused with `403`.
Scripts send no `Origin` and are unaffected; so is anything presenting an API
key or an update token, since neither can be forged by another site.

An **update token** is returned once, in the create response, for anonymous
pastes only. It is the only way to change or remove such a paste — store it or
lose the paste. Signing in and claiming the paste retires the token.

## Create a paste

```http
POST /api/v1/pastes
Content-Type: text/html
```

The body is the HTML, at most 5 MB and not empty. Metadata rides in the query
string, all optional:

| Parameter     | Meaning                                              |
| ------------- | ---------------------------------------------------- |
| `filename`    | Original file name (default `index.html`)            |
| `title`       | Display title                                        |
| `description` | Longer description                                   |
| `subdomain`   | Custom subdomain instead of the generated token      |
| `folderId`    | Folder to file it under (authenticated callers only) |

### Markdown

Send `Content-Type: text/markdown`, or a `filename` ending in `.md` /
`.markdown`, and the body is rendered to a styled, self-contained HTML page
before it is stored. Everything after that is identical to an HTML paste: the
same token, the same origin, and `/raw` returns the rendered HTML — the Markdown
source is not kept.

```bash
curl -X POST https://pastehtml.assoli.site/api/v1/pastes \
     -H 'Content-Type: text/markdown' --data-binary @notes.md
```

GitHub-flavoured: tables, task lists, strikethrough and autolinks. Raw HTML in
the Markdown is passed through, exactly as it would be in an `.html` upload. The
document's first `# heading` becomes its `<title>`, falling back to the filename.

```jsonc
// 201 Created
{
  "data": {
    "pasteId": "...",
    "token": "k3n8pq2vd41x",
    "publicUrl": "https://k3n8pq2vd41x.pastehtml.assoli.site",
    "rawUrl": "https://pastehtml.assoli.site/p/k3n8pq2vd41x/raw",
    "updateToken": "…", // anonymous pastes only, returned exactly once
  },
}
```

## Read a paste

```http
GET /api/v1/pastes/{token}
```

Returns public metadata — title, filename, content type and length, view count,
timestamps, and every URL the paste has. When the request carries a credential
proving ownership, the owner-only fields (`folderId`, `hasPassword`) are
included too. Secrets are never returned by any request.

## Update a paste

```http
PATCH /api/v1/pastes/{token}
```

The `Content-Type` decides what is being updated, exactly as with `POST`:

**HTML body replaces the content.** The public URL does not change, and the old
file is dropped only after the new one commits.

```bash
curl -X PATCH https://pastehtml.assoli.site/api/v1/pastes/$TOKEN \
     -H 'Content-Type: text/html' -H "X-Update-Token: $UPDATE_TOKEN" \
     --data-binary @index.html
```

**JSON body edits the metadata.** Only the keys present are changed; `null`
clears a field where clearing is meaningful.

```bash
curl -X PATCH https://pastehtml.assoli.site/api/v1/pastes/$TOKEN \
     -H 'Content-Type: application/json' -H "Authorization: Bearer $API_KEY" \
     -d '{"title": "Release notes", "folderId": null}'
```

| Field         | Type             | Notes                                    |
| ------------- | ---------------- | ---------------------------------------- |
| `title`       | string           |                                          |
| `description` | string           |                                          |
| `filename`    | string           |                                          |
| `subdomain`   | string \| `null` | `null` removes the custom subdomain      |
| `folderId`    | string \| `null` | `null` removes the paste from its folder |
| `password`    | string \| `null` | Sets or removes password protection      |

Setting or changing `password` revokes every outstanding unlock session, so the
change takes effect for visitors immediately.

## Delete a paste

```http
DELETE /api/v1/pastes/{token}
```

The paste row and its stored HTML go together, in the transaction that
authorized the delete — the public URL stops resolving right away.

## Report abuse

```http
POST /api/v1/abuse
Content-Type: application/json

{ "token": "abc123def456", "reason": "phishing page for a bank" }
```

No credential, and nothing about the reporter is recorded — a report is a
favour, and an address we could not act on would only be personal data to
protect. `token` may be the paste's token or its custom subdomain; an unknown
one is a `404`. Answers `202` once the report is queued for a human.

## Responses

Success is always `{ "data": … }`; failure is always
`{ "error": { "code": …, "message": … } }`. Every response carries an
`X-Request-Id`; send your own to have it echoed back and used in our logs.

| Code                     | Status | Meaning                                         |
| ------------------------ | ------ | ----------------------------------------------- |
| `VALIDATION`             | 400    | Malformed request or invalid field              |
| `UNAUTHORIZED`           | 401    | Missing, unknown, revoked or expired credential |
| `FORBIDDEN`              | 403    | Valid credential, not allowed here              |
| `NOT_FOUND`              | 404    | No such paste or folder                         |
| `CONFLICT`               | 409    | Subdomain taken or reserved                     |
| `PAYLOAD_TOO_LARGE`      | 413    | HTML over 5 MB                                  |
| `UNSUPPORTED_MEDIA_TYPE` | 415    | Stored type is not `text/html` or `text/plain`  |
| `RATE_LIMITED`           | 429    | Too many requests                               |
| `INTERNAL`               | 500    | Our fault — quote the `X-Request-Id`            |

## Rate limits

Per minute, per caller — an API key is charged to the key, everyone else
(including a browser session, which presents no key) to their address:

| Bucket                    | Limit |
| ------------------------- | ----- |
| `GET`                     | 240   |
| `POST`, `PATCH`, `DELETE` | 60    |

Every response carries `RateLimit-Limit`, `RateLimit-Remaining` and
`RateLimit-Reset` (seconds until the window resets). Over the limit is a
`429 RATE_LIMITED`; wait for the reset and retry.

Underneath those, the backend charges the operations themselves — publishing,
editing and deleting — so the ceiling is the same whichever door a client comes
in by. Those answer `429 RATE_LIMITED` without `RateLimit-*` headers, because
the budget they spent is not per-request and not per-caller.

## MCP

The same operations are available to AI agents over the Model Context
Protocol at `POST /mcp`, with the same API keys and the same error codes. See
`docs/mcp.md`.
