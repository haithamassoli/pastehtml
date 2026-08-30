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
