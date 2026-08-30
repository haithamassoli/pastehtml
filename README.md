# pastehtml.assoli.site

Publish HTML and get an instant public URL. Rebuild on Next.js + Convex + Clerk,
deployed to Vercel.

## Stack

Next.js (App Router) · TypeScript · Convex · Convex File Storage · Clerk ·
Tailwind CSS · shadcn/ui · MCP TypeScript SDK · Vitest · Playwright.

## Local development

```bash
npm install
npx convex dev          # links a Convex dev deployment, sets NEXT_PUBLIC_CONVEX_URL, runs codegen
npm run dev             # http://localhost:3000
```

Run `npx convex dev` in a separate terminal alongside `npm run dev` — it watches
`convex/` and keeps generated types in sync.

### Commands

| Command             | Purpose                         |
| ------------------- | ------------------------------- |
| `npm run dev`       | Next.js dev server              |
| `npx convex dev`    | Convex dev deployment + codegen |
| `npm run build`     | Production build                |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | `tsc --noEmit`                  |
| `npm run format`    | Prettier write                  |
| `npm run test`      | Vitest unit tests               |
| `npm run test:e2e`  | Playwright end-to-end tests     |

## Environment setup

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_APP_URL` — app origin (default `http://localhost:3000`).
- `NEXT_PUBLIC_CONVEX_URL` — set automatically by `npx convex dev`.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — from the Clerk
  dashboard.

Required variables are validated at boot in `lib/env.ts`; a missing one throws
immediately.

## Authentication

Clerk holds the sessions; Convex verifies them. `convex/auth.config.ts` points at
`CLERK_JWT_ISSUER_DOMAIN` (set on the Convex deployment, not in `.env.local`), so
`ctx.auth.getUserIdentity()` inside a Convex function is checked against Clerk's
JWKS. **Every ownership decision happens there** — a Convex function derives the
caller from that identity and never from an argument, so no application-side
guard can be skipped to reach someone else's paste. `ownerId` stores Clerk's
`tokenIdentifier`, the stable identity key.

`lib/auth.ts` covers the Next.js side: `getCurrentUser` / `requireCurrentUser`
for server components and route handlers, and `authedConvex()` — a Convex client
that forwards Clerk's `convex` JWT so a server-side call runs as the signed-in
user rather than anonymously.

### Isolation from paste origins

A wildcard paste host never reaches Clerk. `proxy.ts` branches on the Host header
before `clerkMiddleware` runs, so there is no handshake and no session cookie on
`<token>.pastehtml.assoli.site`; the rewrite into the runtime also strips
`Cookie` and `Authorization`, so a domain-scoped cookie added by mistake still
would not arrive. `e2e/auth.spec.ts` signs in for real and then asserts both
halves: the app cookie carries no leading-dot Domain, and `document.cookie` is
empty inside a paste.

There is no cookie-authenticated mutating endpoint in the app — Convex
authenticates with a bearer JWT, not cookies, and the app has no Server Actions —
so there is nothing for a cross-site request to forge. Milestone 15 revisits this
alongside the full header and CSP audit.

### Claiming an anonymous paste

Publishing without an account returns an update token once. Sign in on the same
page and "Save to my account" calls `pastes.claim`, which verifies that token and
transfers ownership. The claim retires the token, so a paste can only ever be
taken into one account.

## Domains

Every paste is served from its own origin, `<token>.pastehtml.assoli.site`, so
uploaded HTML never shares an origin with the dashboard.

### Vercel

The app is a subdomain of `assoli.site`, so there is no apex record to set. Add
both names to the Vercel project — `pastehtml.assoli.site` and the wildcard
`*.pastehtml.assoli.site`.

The wildcard is the constraint. Its certificate can only be issued over DNS-01,
so Vercel has to be able to write a record under the domain, which a plain
`CNAME` does not allow. Two ways to satisfy that:

**Move the zone to Vercel** (Vercel's own recommendation, and what it enables
automatically when you save a wildcard). In Namecheap: Domain List → `assoli.site`
→ Manage → Domain → NAMESERVERS → Custom DNS → the two names Vercel shows,
normally `ns1.vercel-dns.com` / `ns2.vercel-dns.com`. This moves DNS for _all_ of
`assoli.site`, so screenshot the Advanced DNS page first and recreate every record
(MX especially) under Vercel's DNS, or unrelated services on the domain break.

**Or keep Namecheap DNS** and delegate only the ACME name. In Namecheap's
Advanced DNS → Host Records, where the Host field takes the sub-part alone and
Namecheap appends the domain:

| Type  | Host                        | Value                              |
| ----- | --------------------------- | ---------------------------------- |
| CNAME | `pastehtml`                 | the per-project value Vercel shows |
| CNAME | `*.pastehtml`               | `cname.vercel-dns-0.com`           |
| NS    | `_acme-challenge.pastehtml` | `ns1.vercel-dns.com.`              |
| NS    | `_acme-challenge.pastehtml` | `ns2.vercel-dns.com.`              |

Do not hardcode the first CNAME's value: Vercel issues each project a unique one
(e.g. `d1d4fc829fe7bc7c.vercel-dns-017.com`), and the old shared
`cname.vercel-dns.com` is no longer correct everywhere. Copy what the dashboard
shows.

Either way, confirm both domains read **Valid Configuration** under Project →
Domains before cutover. `*.pastehtml.assoli.site` covers exactly one label, so
`a.b.pastehtml.assoli.site` is not certified and `lib/host.ts` refuses to route it.

Setting `NEXT_PUBLIC_APP_URL=https://pastehtml.assoli.site` needs a redeploy to
take effect — `NEXT_PUBLIC_*` is inlined at build time, and `lib/host.ts` derives
the root host from it.

### Locally

Browsers and macOS resolve every `*.localhost` name to the loopback address, so
no hosts-file entry or DNS is needed:

```bash
npm run dev
open http://localhost:3000                 # the app
open http://<token>.localhost:3000         # the paste that token published
```

`lib/host.ts` derives the root host from `NEXT_PUBLIC_APP_URL` and ignores the
port, so the same routing code runs in development and production.

## Testing

`npm run test` runs the Vitest suites (Convex functions under `convex-test`,
host routing, and the serving endpoints) and needs nothing running.

`npm run test:e2e` drives a real browser and needs both `npx convex dev` and a
Clerk development instance. The auth specs sign in as a `+clerk_test` fixture
user, which never receives real mail — create it once per instance:

```bash
clerk users create -d '{"email_address":["e2e+clerk_test@example.com"],"password":"<15+ chars>"}' --yes
```

`e2e/global.setup.ts` fetches Clerk's testing token (which bypasses bot
protection) from the keys in `.env.local`. Override the fixture address with
`E2E_CLERK_USER_EMAIL` if your instance uses a different one.

## Architecture

- `app/(marketing)` — public pages (home / publishing).
- `app/(dashboard)` — authenticated management UI.
- `app/api` — REST API (versioned under `v1`).
- `convex/` — backend: schema, queries, mutations, file storage.
- `lib/` — `env`, `config`, `errors`, `logger`, `request-id` shared modules.
- `proxy.ts` — host routing (wildcard paste origins) + Clerk on app hosts.
- `app/internal/paste/[subdomain]` — the paste runtime; reachable only through
  the rewrite in `proxy.ts`, never directly.

See `docs/conventions.md` for naming and error-code conventions, and
`docs/tasks.md` for the milestone plan.
