# pastehtml.dev

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

## Architecture

- `app/(marketing)` — public pages (home / publishing).
- `app/(dashboard)` — authenticated management UI.
- `app/api` — REST API (versioned under `v1`).
- `convex/` — backend: schema, queries, mutations, file storage.
- `lib/` — `env`, `config`, `errors`, `logger`, `request-id` shared modules.
- `proxy.ts` — Clerk middleware + host routing.

See `docs/conventions.md` for naming and error-code conventions, and
`docs/tasks.md` for the milestone plan.
