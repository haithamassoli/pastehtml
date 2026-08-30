# Conventions

## Convex functions

- One domain per file under `convex/` (e.g. `pastes.ts`, `folders.ts`, `apiKeys.ts`).
- Public API: `query` / `mutation` / `action`. Internal-only: `internalQuery` /
  `internalMutation` / `internalAction`.
- Name functions as verbs: `create`, `getByToken`, `listByOwner`, `update`,
  `remove`. Referenced as `api.pastes.create`, `internal.pastes.hardDelete`.
- Every function declares `args` validators. Authorization is checked _inside_
  the function via the shared `requireCurrentUser` / ownership helpers — never
  trust an id passed by the client.

## API routes

- REST lives under `app/api/`. Versioned: `app/api/v1/...`.
- Resource-based paths: `POST /api/v1/pastes`, `GET /api/v1/pastes/[token]`,
  `PATCH`/`DELETE` on the same. Plural nouns, no verbs in the path.
- Success: `{ data: ... }`. Error: `{ error: { code, message } }` via
  `AppError.toResponse()` (see `lib/errors.ts`).
- Every handler mints/propagates a request id (`lib/request-id.ts`).

## Error codes

Stable machine-readable codes live in `lib/errors.ts` (`ErrorCode`). Throw
`AppError` with a code; never invent inline code strings. Each code maps to a
fixed HTTP status there.

## Logging

Use `lib/logger.ts`. Structured JSON, one line per event. Sensitive keys
(password, token, secret, apikey, authorization, cookie) are auto-redacted —
never log raw HTML payloads or credentials.
