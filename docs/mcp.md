# MCP Server

Publish HTML from an AI agent and get back a link you can hand to a person. One
endpoint, five tools, no SDK to install:

```text
https://pastehtml.assoli.site/mcp
```

It speaks [Model Context Protocol](https://modelcontextprotocol.io) over
streamable HTTP, built on the official TypeScript SDK, and it delegates to the
same backend as the [REST API](./api.md) — same authorization, same error codes,
same URLs.

## Setup

### Claude Code

```bash
claude mcp add --transport http pastehtml https://pastehtml.assoli.site/mcp \
  --header "Authorization: Bearer $PASTEHTML_API_KEY"
```

Drop the `--header` to publish anonymously. Check it took:

```bash
claude mcp list
```

### Any client that reads a config file

```jsonc
{
  "mcpServers": {
    "pastehtml": {
      "type": "http",
      "url": "https://pastehtml.assoli.site/mcp",
      "headers": {
        "Authorization": "Bearer ph_…",
      },
    },
  },
}
```

Editors and desktop apps differ only in where that file lives — Claude Code
reads `.mcp.json` in the project root, or `~/.claude.json` for a user-scoped
server.

## Authentication

| Credential   | How it travels                   | Grants                      |
| ------------ | -------------------------------- | --------------------------- |
| API key      | `Authorization: Bearer ph_…`     | Everything its scopes allow |
| Update token | `updateToken` argument on a tool | Manage one anonymous paste  |
| None         | —                                | `create_paste`, anonymously |

An **API key** is created at
[/dashboard/settings/api-keys](https://pastehtml.assoli.site/dashboard/settings/api-keys)
and shown once. Its scopes — `pastes:read`, `pastes:write`, `pastes:delete` —
are checked inside the backend, not at this endpoint, so a key can never do more
through MCP than it can through the REST API. Revoke it or give it an expiry
from the same page; both take effect on the next request.

An **update token** is the only way to manage a paste published with no
credential. It comes back once, in the `create_paste` result, and it is passed
back as a tool _argument_ rather than a header, because an MCP client sends the
same headers on every call.

Full OAuth 2.1 with dynamic client registration is **not** implemented, and
neither is the `/.well-known/oauth-protected-resource` metadata that only
describes that flow. A static bearer token is what every production client can
already send, and it is revocable per key. See `docs/tasks.md`, Milestone 13.

Requests carrying an `Origin` header from another site, with no API key and no
update token, are refused — the same cross-origin rule the REST API applies.

## Tools

| Tool           | Does                                | Needs                      |
| -------------- | ----------------------------------- | -------------------------- |
| `create_paste` | Publishes HTML, returns the URLs    | Nothing, or `pastes:write` |
| `get_paste`    | Reads one paste's metadata          | Nothing, or `pastes:read`  |
| `update_paste` | Replaces content, metadata, or both | Ownership                  |
| `delete_paste` | Deletes the paste and its HTML      | Ownership                  |
| `list_pastes`  | Lists the pastes an account owns    | `pastes:read`              |

Every tool publishes a JSON Schema for its input and its output, so a client can
validate both. Results come back twice over: as `structuredContent` for a client
that reads the output schema, and as JSON text for one that does not.

### `create_paste`

| Argument      | Type   | Notes                                      |
| ------------- | ------ | ------------------------------------------ |
| `html`        | string | Required. The whole document, at most 5 MB |
| `filename`    | string | Defaults to `index.html`                   |
| `title`       | string |                                            |
| `description` | string |                                            |
| `subdomain`   | string | Custom subdomain instead of a token        |
| `folderId`    | string | Requires an API key                        |

```jsonc
{
  "token": "k3n8pq2vd41x",
  "publicUrl": "https://k3n8pq2vd41x.pastehtml.assoli.site",
  "rawUrl": "https://pastehtml.assoli.site/p/k3n8pq2vd41x/raw",
  "updateToken": "…", // anonymous pastes only, returned exactly once
}
```

`publicUrl` is the working link — it serves the uploaded bytes verbatim on their
own origin, so scripts and styles in the page run. Give that one to the user.

### `get_paste`

Takes `token`. Returns title, filename, content type and length, view count,
timestamps and every URL the paste has. Owner-only fields (`folderId`,
`hasPassword`) appear when the API key owns the paste. Never returns the HTML —
fetch `rawUrl` for that.

### `update_paste`

Takes `token`, an optional `updateToken`, and any of `html`, `filename`,
`title`, `description`, `subdomain` and `folderId`. `subdomain` and `folderId`
accept `null` to clear them. Passing `html` replaces the stored document; the
public URL does not change, so a link already shared starts serving the new
content.

### `delete_paste`

Takes `token` and an optional `updateToken`. The paste row and its stored HTML
go together and nothing is recoverable, so confirm with the user first.

### `list_pastes`

Takes an optional `limit` (default 50, maximum 200) and returns the pastes owned
by the account, newest first. Anonymous pastes are listed nowhere — they are
reachable only by their token.

## Errors

A tool that fails answers with `isError: true` and a single text block holding
the same envelope the REST API returns:

```json
{ "error": { "code": "NOT_FOUND", "message": "Paste not found." } }
```

The code is stable and safe to branch on; the message is for a human.

| Code                     | Meaning                                         |
| ------------------------ | ----------------------------------------------- |
| `VALIDATION`             | Invalid field                                   |
| `UNAUTHORIZED`           | Missing, unknown, revoked or expired credential |
| `FORBIDDEN`              | Valid credential, not allowed here              |
| `NOT_FOUND`              | No such paste or folder                         |
| `CONFLICT`               | Subdomain taken or reserved                     |
| `PAYLOAD_TOO_LARGE`      | HTML over 5 MB                                  |
| `UNSUPPORTED_MEDIA_TYPE` | Content type is not `text/html` or `text/plain` |
| `RATE_LIMITED`           | Too many requests                               |
| `INTERNAL`               | Our fault — quote the `X-Request-Id`            |

Malformed arguments never reach the backend: the SDK rejects them against the
tool's input schema first. Failures below the tool layer — a bad JSON-RPC frame,
an unsupported protocol version, the rate limit — stay HTTP failures, with the
REST error envelope and an `X-Request-Id`.

Every call is charged to the write bucket, 60 per minute per API key or per
address. `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` come back
on every response.

## Verifying by hand

The endpoint is plain JSON-RPC over `POST`, so `curl` is enough. The `Accept`
header must list both types — that is the transport specification, not us:

```bash
curl -sX POST https://pastehtml.assoli.site/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Publish something:

```bash
curl -sX POST https://pastehtml.assoli.site/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":
       {"name":"create_paste","arguments":{"html":"<h1>hello</h1>"}}}'
```

For a UI, point the official inspector at it:

```bash
npx @modelcontextprotocol/inspector
```

Swap the host for `http://localhost:3000` to try any of this against
`npm run dev`.
