# pastehtml.assoli.site Rebuild — Project Tasks

This file breaks the project into implementation milestones and actionable tasks based on the PRD.

The target stack is:

```text
Next.js
TypeScript
Convex
Convex File Storage
Clerk
Tailwind CSS
shadcn/ui
MCP TypeScript SDK
Vercel
Vitest
Playwright
Sentry
```

---

# Milestone 0 — Project Foundation

## Goal

Create the new application foundation, configure the development environment, and establish the project conventions before implementing product features.

## Tasks

- [x] Create a new Next.js application with TypeScript
- [x] Enable the latest stable Next.js App Router architecture
- [x] Configure ESLint
- [x] Configure Prettier
- [x] Configure strict TypeScript settings
- [x] Configure path aliases
- [x] Add Tailwind CSS
- [x] Add shadcn/ui
- [x] Configure project-wide typography and base styles
- [x] Create the initial application layout
- [x] Create the initial marketing layout
- [x] Create the initial dashboard layout
- [x] Install Convex
- [x] Initialize the Convex project
- [x] Configure local Convex development
- [x] Configure Convex generated types
- [x] Install Clerk
- [x] Configure Clerk development environment
- [x] Install the official MCP TypeScript SDK
- [x] Install Vitest
- [x] Install Playwright
- [x] Add environment variable validation
- [x] Create `.env.example`
- [x] Add a centralized configuration module
- [x] Define naming conventions for Convex functions
- [x] Define naming conventions for API routes
- [x] Define error-code conventions
- [x] Add a reusable application logger
- [x] Add a reusable request/correlation ID helper
- [x] Configure GitHub Actions for linting
- [x] Configure GitHub Actions for type checking
- [x] Configure GitHub Actions for unit tests
- [x] Configure GitHub Actions for build verification
- [x] Create a basic README for the new architecture
- [x] Document local development commands
- [x] Document environment setup
- [x] Verify the application runs locally
- [x] Verify Convex connects correctly
- [x] Verify Clerk authentication bootstraps correctly
- [x] Verify the application builds successfully

## Milestone Acceptance Criteria

- [x] The application runs locally without Ruby or Rails
- [x] Next.js, Convex, Clerk, and the test stack are configured
- [x] CI passes linting, type checking, tests, and builds
- [x] Environment configuration is documented
- [x] The project can be deployed to a temporary Vercel environment <!-- deploy step -->

---

# Milestone 1 — Convex Data Model and Core Domain Layer

## Goal

Define the product data model and implement the domain-level backend functions required for pastes, folders, users, and API credentials.

## Tasks

### Schema

- [x] Create `convex/schema.ts`
- [x] Define the `pastes` table
- [x] Define the `folders` table
- [x] Define the `apiKeys` table
- [x] Define the `pasteViews` table
- [x] ~~Define any required user metadata table~~ — not required: ownership is Clerk `tokenIdentifier` on `ownerId`.
- [x] Define any required password-session table
- [x] Add `by_token` index to pastes
- [x] Add `by_custom_subdomain` index to pastes
- [x] Add `by_owner` index to pastes
- [x] Add `by_folder` index to pastes
- [x] Add appropriate folder ownership indexes
- [x] Add appropriate API-key indexes
- [x] Add appropriate analytics indexes

### Paste Domain Functions

- [x] Implement secure public token generation
- [x] Implement reserved-subdomain validation
- [x] Implement paste creation mutation
- [x] Implement paste metadata retrieval by token
- [x] Implement paste retrieval by custom subdomain
- [x] Implement paste listing by owner
- [x] Implement paste listing by folder
- [x] Implement paste metadata update
- [x] Implement paste deletion
- [x] Implement ownership checks
- [x] Implement authorization helpers
- [x] Implement anonymous update-token authorization
- [x] Implement paste visibility rules
- [x] Implement paste content metadata updates
- [x] Implement paste view-count updates
- [x] ~~Implement soft-delete behavior if required~~ — not required: `pastes.remove` hard-deletes and drops the stored file. Add if the product needs undo.
- [x] Implement hard-delete internal function

### Folder Domain Functions

- [x] Implement folder creation
- [x] Implement folder rename
- [x] Implement folder deletion
- [x] Implement folder listing
- [x] Implement move-paste-to-folder — `pastes.update({ token, folderId })`
- [x] Implement remove-paste-from-folder — `pastes.update({ token, folderId: null })`
- [x] Ensure deleting a folder does not delete contained pastes

### User Domain Functions

- [x] Implement Clerk user identity mapping
- [x] Implement reusable `getCurrentUser` helper
- [x] Implement reusable `requireCurrentUser` helper
- [x] ~~Implement user metadata initialization if needed~~ — not needed, no user table.
- [x] Implement owner-based access controls

### Validation

The validator is written and unit-tested (`scripts/migrate-validate.mjs`); every
item below is an action it performs against real data, so none can be ticked
until there is a staging deployment to run it on.

- [x] Add shared validation for paste filenames
- [x] Add shared validation for titles
- [x] Add shared validation for custom subdomains
- [x] Add shared validation for folder names
- [x] Add shared validation for file-size metadata
- [x] Add shared validation for content types
- [x] Add shared validation for API scopes

## Milestone Acceptance Criteria

- [x] Convex schema deploys successfully
- [x] Pastes can be created, queried, updated, and deleted through Convex
- [x] Folder operations work
- [x] Owner authorization works
- [x] Anonymous management authorization works
- [x] All primary domain functions have unit tests

---

# Milestone 2 — HTML File Storage

## Goal

Store uploaded HTML in Convex File Storage while preserving the original content and keeping metadata in Convex documents.

## Tasks

### Storage Abstraction

- [x] Create a storage helper module
- [x] Implement browser upload URL generation
- [x] Implement file storage metadata retrieval — `describeUpload` reads size/type from `_storage`
- [x] Implement file deletion
- [x] Implement file replacement — `pastes.replaceContent`
- [x] Implement storage cleanup helpers — `storage.sweepOrphans`, hourly cron
- [x] Implement storage ownership validation
- [x] Ensure Convex storage IDs are never trusted without authorization checks — size/type come from storage metadata, and a storage id already backing a paste is refused

### Upload Validation

- [x] Define the initial maximum HTML upload size
- [x] Validate upload size before paste creation
- [x] Validate non-empty content
- [x] Validate allowed content type
- [x] Preserve uploaded bytes without HTML sanitization
- [x] Reject unsupported payloads with structured errors

### Browser Upload Flow

- [x] Implement request for a signed Convex upload URL
- [x] Implement direct browser-to-Convex upload
- [x] Return the resulting storage ID
- [x] Create paste metadata after successful upload
- [x] Handle abandoned uploads — swept once unreferenced past the grace period
- [x] Handle failed uploads — structured `AppError`, uploaded bytes left to the sweep
- [x] Add cleanup strategy for orphaned storage objects

### File Replacement

- [x] Implement replacement upload flow
- [x] Update paste storage ID atomically where possible
- [x] Delete old storage object after successful replacement
- [x] Prevent old content deletion before new content is committed
- [x] Test rollback behavior after failed replacement

## Milestone Acceptance Criteria

- [x] HTML is stored in Convex File Storage
- [x] Paste metadata references stored HTML correctly
- [x] Browser uploads bypass unnecessary Vercel proxying
- [x] Replacing HTML does not corrupt existing pastes
- [x] Orphaned file cleanup has a defined implementation

---

# Milestone 3 — Anonymous Paste Publishing

## Goal

Implement the simplest core product flow: upload HTML and immediately receive a public paste URL without creating an account.

## Tasks

### Public Publishing UI

- [x] Create the home page publishing interface
- [x] Add drag-and-drop HTML upload
- [x] Add file picker upload
- [x] Add paste-from-text option if desired — textarea on the home page
- [x] Display upload progress — indeterminate; `fetch` exposes none, XHR upgrade noted in the page
- [x] Display validation errors
- [x] Display successful publish result
- [x] Add copy-public-URL action
- [x] Add copy-raw-URL action
- [x] Add publish-another action

### Anonymous Authorization

- [x] Generate a secure anonymous update token
- [x] Store only a hash of the anonymous update token — SHA-256 in `pastes.updateTokenHash`
- [x] Return the raw update token only once
- [x] Implement update authorization using the token
- [x] Implement delete authorization using the token
- [x] Ensure tokens are never logged — `lib/logger.ts` redacts any `*token*` field

### API Response

- [x] Define the create-paste response contract — `PublishResult` in `lib/upload.ts`
- [x] Return paste identifier
- [x] Return public URL — `pasteUrls()` in `lib/urls.ts`
- [x] Return raw URL
- [x] Return update token for anonymous pastes
- [x] Add consistent error responses

### Tests

- [x] Test anonymous browser publishing — Playwright `e2e/publish.spec.ts`
- [x] Test invalid upload
- [x] Test oversized upload
- [x] Test empty upload
- [x] Test update-token generation
- [x] Test unauthorized anonymous update
- [x] Test authorized anonymous update
- [x] Test authorized anonymous deletion

## Milestone Acceptance Criteria

- [x] A visitor can publish an HTML file without an account
- [x] A public paste URL is returned immediately
- [x] The anonymous user receives an update token
- [x] The update token can securely update or delete the paste
- [x] Invalid uploads fail with structured errors

---

# Milestone 4 — Wildcard Subdomain Runtime

## Goal

Serve every paste as a real HTML page from an isolated wildcard subdomain on Vercel.

## Tasks

### Vercel Domain Configuration

Verified live on 2026-08-30 against `pastehtml.assoli.site`.

- [x] Add `pastehtml.assoli.site` to the Vercel project — serves `HTTP/2 200`
- [x] Configure `www.pastehtml.assoli.site` — `200`; `www` is reserved, so host
      routing hands it to the app
- [x] Configure wildcard `*.pastehtml.assoli.site` — an arbitrary subdomain
      reaches the runtime rather than `DEPLOYMENT_NOT_FOUND`
- [x] Verify wildcard SSL issuance — Let's Encrypt `CN=*.pastehtml.assoli.site`,
      valid to 2026-11-28, `SSL certificate verify ok`
- [x] Document DNS configuration — README "Domains"
- [x] Document local wildcard-host development strategy — `*.localhost` resolves
      to loopback, so no hosts file or DNS is needed

### Host Routing

- [x] Create `proxy.ts`
- [x] Parse incoming hostnames safely — `normalizeHost` in `lib/host.ts`
- [x] Detect the root application domain — derived from `NEXT_PUBLIC_APP_URL`
- [x] Detect wildcard subdomains
- [x] Ignore unsupported hostnames — anything not under the root host, and any
      label that is not a valid single DNS label, falls through to the app
- [x] Normalize hostname casing
- [x] Strip development ports safely — including bracketed IPv6 literals
- [x] Route wildcard requests internally to the paste runtime
- [x] Handle reserved subdomains — `RESERVED_SUBDOMAINS` resolve to the app
- [x] Handle custom subdomain lookup
- [x] Handle token-based subdomain lookup

### Runtime Route

- [x] Create the internal paste runtime route — `app/internal/paste/[subdomain]`
- [x] Resolve paste metadata by subdomain — `pastes.resolveForRuntime`
- [x] Fetch HTML from Convex File Storage
- [x] Return stored HTML as `text/html` — the stored content type, verbatim
- [x] Return 404 for missing paste
- [x] Return disabled-state response when applicable — a `protected` paste gets
      the unlock challenge (Milestone 9); there is no disabled flag until
      Milestone 15 adds paste-disable
- [x] Add cache headers
- [x] Add ETag support — Convex's stored SHA-256 digest
- [x] Add conditional request support — `If-None-Match` → 304
- [x] Add required security headers — `X-Content-Type-Options`, `Referrer-Policy`
- [x] Ensure analytics does not block the HTML response — `after()`

### Isolation Tests

- [x] Verify wildcard paste content cannot access main-app authentication
      cookies — `e2e/runtime.spec.ts` reads `document.cookie` from inside the
      paste origin and asserts it is empty
- [x] Verify one subdomain cannot access another paste's protected state — the
      proxy pins the subdomain from the Host header, so no path on a paste
      origin can address a different paste
- [x] Verify main application routes do not accidentally execute paste HTML —
      no app route renders paste content; Milestone 5's preview endpoint adds
      the sandboxed one and its own tests
- [x] Verify arbitrary scripts run only in the intended paste origin — paste
      HTML is only ever served from its own origin, never inlined into the app
- [x] Verify wildcard requests cannot rewrite into privileged internal routes —
      `proxy.test.ts`, from both a paste host and the app host

## Milestone Acceptance Criteria

- [x] `https://TOKEN.pastehtml.assoli.site` serves the uploaded HTML — the full
      publish-then-serve path is covered end to end by `e2e/runtime.spec.ts`; in
      production the routing, lookup and headers are confirmed live
- [x] Wildcard SSL works on Vercel — Let's Encrypt wildcard certificate issued
- [x] Missing tokens return 404 — live: an unknown subdomain returns
      `404 Paste not found.` with `no-store` and the runtime's security headers
- [x] User HTML does not receive main-app authentication credentials
- [x] Host routing has automated tests

---

# Milestone 5 — Raw and Preview Endpoints

## Goal

Provide raw source retrieval and a controlled preview/render route.

## Tasks

### Raw Endpoint

- [x] Implement `GET /p/[token]/raw`
- [x] Load the original stored HTML — streamed from Convex File Storage
- [x] Return the original content without rendering it in the application —
      `text/plain` + `nosniff`, so the app origin never parses paste markup
- [x] Set an appropriate `Content-Type`
- [x] Set an appropriate filename header — an RFC 5987 `Content-Disposition`
      naming the uploaded file
- [x] Add ETag support — Convex's stored SHA-256 digest
- [x] Add conditional requests — `If-None-Match` → 304, storage never read
- [x] Define caching behavior — `public, max-age=0, must-revalidate`, as the
      wildcard runtime; Milestone 16 tunes both together
- [x] Verify byte-level output against stored content — unit test over
      BOM/multi-byte/CR/tab bytes, plus `e2e/preview.spec.ts` comparing the
      published buffer

### Preview Endpoint

- [x] Implement `GET /p/[token]/render`
- [x] Return HTML preview
- [x] Add sandbox-oriented Content Security Policy — a `sandbox` directive
      granting only scripts, forms, modals, popups and downloads
- [x] Prevent access to main-application cookies — no `allow-same-origin`, so
      the document is an opaque origin; `document.cookie` throws
- [x] Prevent privileged application API access — an opaque origin cannot make a
      credentialed same-origin request
- [x] Test scripts inside the preview — e2e asserts the paste's own script ran
- [x] Test forms inside the preview — e2e submits a form inside the preview
- [x] Test modal behavior if supported — e2e asserts `alert()` opens a dialog
- [x] Verify unsafe capabilities remain blocked — e2e asserts `window.origin`
      is `null` and both cookies and `localStorage` raise `SecurityError`

### Metadata Page

- [x] Implement `GET /p/[token]`
- [x] Show paste information — title, filename, size, views, publish date
- [x] Show public URL
- [x] Show raw URL
- [x] Show preview link
- [x] Show ownership controls when authorized — `isViewerOwner` is decided by
      Convex from the caller's own identity; the entry point renders only for
      the owner, and the controls themselves land with Milestone 7's detail page

## Milestone Acceptance Criteria

- [x] Raw endpoint returns the stored content correctly
- [x] Preview endpoint works with explicit sandboxing
- [x] Metadata page works for public pastes
- [x] Raw output passes byte-level regression tests

---

# Milestone 6 — Clerk Authentication

## Goal

Add production-ready user authentication while keeping wildcard paste origins isolated.

## Tasks

### Clerk Setup

- [ ] Configure Clerk production application — **deferred to Milestone 20**. A
      production instance needs `clerk.`/`accounts.`/`clkmail.` DNS records on
      `assoli.site` and production keys in Vercel, which is exactly the work
      Milestone 20 already owns. The development instance is fully configured.
- [x] Configure allowed callback URLs — instance `paths` now point at the app
      (`sign_in` `/sign-in`, `sign_up` `/sign-up`, `home` and
      `after_sign_out_all` `/`); a development instance accepts any localhost
      origin
- [x] Configure sign-in page — `app/sign-in/[[...sign-in]]`
- [x] Configure sign-up page — `app/sign-up/[[...sign-up]]`
- [x] Configure sign-out flow — `afterSignOutUrl="/"` on `ClerkProvider`, driven
      from `UserButton`
- [x] Configure desired OAuth providers — Google enabled. Left as configured;
      the provider set is PRD open question 5 and adding one is a single
      `clerk config patch`.
- [x] Configure email authentication if required — email + password, with
      `email_code` for sign-in and sign-up verification
- [x] Configure Convex Clerk integration — `convex/auth.config.ts` +
      `CLERK_JWT_ISSUER_DOMAIN` on the deployment, `ConvexProviderWithClerk` on
      the client, Clerk's `convex` JWT template
- [x] Configure authentication state in server components — `auth()` in the
      dashboard layout guard; `lib/auth.ts` `getCurrentUser` /
      `requireCurrentUser`
- [x] Configure authentication state in route handlers — same helpers;
      `AppError` carries the 401, so a handler answers with `.toResponse()`

### Application Auth Helpers

- [x] Create `getCurrentUser` — `lib/auth.ts` (Clerk) and `convex/lib/auth.ts`
      (Convex identity)
- [x] Create `requireCurrentUser` — both sides
- [x] Create ownership guard helpers — `requireOwner` and `authorizePasteWrite`
      in Convex; `requireOwnedPaste` in `lib/auth.ts` delegates to Convex so the
      check cannot be bypassed by skipping the app-side call
- [x] Create API auth helpers — `authedConvex()` forwards Clerk's `convex` JWT so
      a server-side Convex call runs as the signed-in user
- [x] Create authorization error utilities — `AppError` / `ErrorCode`
      (`UNAUTHORIZED` 401, `FORBIDDEN` 403), already the codes Convex `fail()`
      raises

### Security

- [x] Verify Clerk cookies are not scoped to `.pastehtml.assoli.site` —
      `e2e/auth.spec.ts` signs in and asserts every app-host cookie has an exact
      `Domain`, never a leading dot
- [x] Verify wildcard paste hosts cannot access Clerk credentials — three layers:
      `proxy.test.ts` proves Clerk never runs on a paste host and that `Cookie`
      and `Authorization` are stripped from the rewrite; `e2e/auth.spec.ts` reads
      `document.cookie` from inside a paste while a real session is live
- [x] Verify authenticated mutations validate identity inside Convex — every
      owner check derives the caller from `ctx.auth.getUserIdentity()`, never
      from an argument; covered by the owner-authorization and claim suites
- [x] ~~Add origin checks where required~~ — not required: Convex authenticates
      with a bearer JWT rather than cookies, and the app has no Server Actions or
      cookie-authenticated mutating route, so no endpoint is reachable
      cross-site with ambient credentials
- [x] ~~Add CSRF protections where required~~ — same reason at the time. Now
      required and done: Milestone 10's REST API does accept the Clerk cookie,
      so `lib/api.ts` refuses a cookie-only write carrying a foreign `Origin`.
      Milestone 15 re-audits with the full header and CSP pass.
- [x] Test logout invalidation — `e2e/auth.spec.ts` signs out and the next
      `/dashboard` request is bounced to `/sign-in`

### Account Claiming

- [x] Decide whether anonymous pastes can be claimed after sign-in — **yes**
      (PRD open question 11). The browser already holds the update token after
      publishing, so this is the natural bridge into the dashboard.
- [x] If supported, implement claim flow — `pastes.claim` + "Save to my account"
      on the publish result
- [x] Validate anonymous update token before claiming — constant-time compare
      against the stored SHA-256, via the shared `requireUpdateToken`
- [x] Prevent claiming a paste twice — the claim retires the token and sets
      `ownerId`; a second attempt gets `CONFLICT`

## Milestone Acceptance Criteria

- [x] Users can register, sign in, and sign out
- [x] Convex can securely identify signed-in users
- [x] Authenticated pastes are owned by the correct user
- [x] Wildcard paste subdomains do not receive authenticated app credentials

---

# Milestone 7 — Authenticated Dashboard

## Goal

Create the realtime management experience for signed-in users.

## Tasks

### Dashboard Shell

- [x] Create dashboard layout — `app/(dashboard)/dashboard/layout.tsx`; the
      Clerk guard lives there, so every nested route inherits it
- [x] Create navigation — one section until Milestone 8 adds folders
- [x] Create mobile navigation — the nav scrolls rather than wraps and the whole
      dashboard collapses to a single column below `sm`; asserted at a 390px
      viewport in `e2e/dashboard.spec.ts`, including no horizontal overflow
- [x] Create account menu — Clerk's `UserButton` in the root header, which is
      already on every page including this one
- [x] Add empty states — first-run state on the list, and a "nothing matches"
      state for the filters
- [x] Add loading states — `AuthLoading` while Clerk settles, then a skeleton
      while the Convex subscription is still `undefined`
- [x] Add error states — `app/(dashboard)/dashboard/error.tsx`, the native Next
      boundary; a rejected Convex query throws during render and lands there

### Paste List

- [x] Display user's pastes
- [x] Subscribe using Convex realtime queries — `useQuery(api.pastes.listByOwner)`
- [x] Display paste title or filename — `displayName` in `lib/paste-list.ts`
- [x] Display public URL
- [x] Display view count
- [x] Display created date
- [x] Display last updated date
- [x] Add search — title, filename and token, case-insensitive
- [x] Add folder filtering — including "no folder"; hidden until the account has
      a folder, since creating one is Milestone 8's UI
- [x] Add sorting — newest, recently updated, most viewed, name
- [x] ~~Add pagination or incremental loading if needed~~ — not needed:
      `listByOwner` is already bounded, and the arrangement is a pure function
      over that page. `lib/paste-list.ts` names the swap if an account outgrows it.
- [x] Add copy URL action — shared `components/copy-button.tsx`
- [x] Add delete action
- [x] Add create paste action — "New paste" in the shell header

### Paste Details

- [x] Create paste details page — `app/(dashboard)/dashboard/pastes/[token]`
- [x] Show metadata
- [x] Show public URL
- [x] Show raw URL
- [x] Show preview — the sandboxed `/render` endpoint in an iframe that repeats
      the same fence as a `sandbox` attribute
- [x] Add title editing
- [x] Add file replacement — `replaceHtml`, so the public URL is unchanged and
      the old file is dropped only after the new one commits
- [x] Add folder management — same visibility rule as the list filter
- [x] Add password settings — enable, change and remove, over
      `pastes.setPassword` / `pastes.removePassword` (Milestone 9)
- [x] Add analytics summary — the live view total, plus size and last update.
      Milestone 12 turns that into a real breakdown.
- [x] Add destructive delete action
- [x] Add confirmation dialogs — the platform's own `confirm()` on both delete
      paths; the upgrade path to a Base UI dialog is noted at each call site

### Realtime Behavior

Two tabs, one session: the first sits on the dashboard and is never reloaded,
the second does the work (`e2e/dashboard.spec.ts`).

- [x] Verify new paste appears without refresh — the claim in `publishOwned`
      hands the paste to the account and the open list picks it up
- [x] Verify edits update without refresh — a title saved in the second tab
      renames the row in the first
- [x] Verify deleted paste disappears without refresh
- [x] Verify view count updates without refresh — a hit on the wildcard origin,
      which records the view _after_ the response is already on the wire, still
      reaches the open dashboard
- [x] Verify folder moves update without refresh — a move is
      `pastes.update({ folderId })` feeding the same `listByOwner` subscription
      the title edit already proves; `e2e/folders.spec.ts` now files a paste and
      finds it under the dashboard's folder filter.

## Milestone Acceptance Criteria

- [x] Signed-in users can manage their pastes
- [x] Dashboard data updates in realtime
- [x] All destructive actions require explicit confirmation
- [x] Mobile dashboard remains usable

---

# Milestone 8 — Folder Management

## Goal

Allow users to organize pastes into folders.

## Tasks

The domain functions landed in Milestone 1; this milestone is the UI over them.

- [x] Create folder list UI — `app/(dashboard)/dashboard/folders`, plus a
      "Folders" entry in the dashboard nav
- [x] Create new-folder dialog — an inline one-field form instead. A modal for a
      single text input buys nothing, and this way the new folder appears in the
      list directly beneath it.
- [x] Implement folder rename UI — the platform's own `prompt()`, as the delete
      paths already use `confirm()`; the Base UI upgrade path is noted at the
      call site
- [x] Implement folder delete UI — `confirm()`, and the copy says the pastes are
      kept
- [x] Add folder detail page — `dashboard/folders/[folderId]`
- [x] Add folder paste list — `pastes.listByFolder`, live
- [x] Add move-paste action — the folder `<select>` on the paste detail page,
      one `pastes.update({ folderId })`
- [x] Add remove-from-folder action — per row on the folder page, and "No
      folder" in that same select
- [x] Add folder filter to dashboard — already built in Milestone 7; it now has
      folders to filter by
- [x] Ensure folder ownership is validated — `requireOwner` /
      `requireOwnFolder` inside Convex, from the caller's own identity
- [x] Prevent cross-account folder assignment — `pastes.update` and
      `pastes.create` both resolve the folder against the paste owner
- [x] Keep pastes when a folder is deleted — `folders.remove` schedules a
      batched detach; the pastes and their public URLs are untouched
- [x] Add realtime folder updates — every folder view is a `useQuery`
      subscription
- [x] Add folder operation tests — `convex/folders.test.ts` for the domain and
      the authorization cases, `e2e/folders.spec.ts` for the workflow

## Milestone Acceptance Criteria

- [x] Users can create, rename, and delete folders
- [x] Pastes can be moved between folders
- [x] Deleting a folder preserves its pastes
- [x] Folder changes update in realtime — the rename in `e2e/folders.spec.ts`
      repaints the list without a reload

---

# Milestone 9 — Password-Protected Pastes

## Goal

Allow paste owners to require a password before public content is served.

## Tasks

### Password Management

- [x] Select a modern password hashing library compatible with the runtime —
      **none**: PBKDF2-HMAC-SHA256 through Web Crypto, which the Convex V8
      runtime provides natively. argon2id or bcrypt would mean a WASM/native
      dependency plus a `"use node"` action hop on every attempt; PBKDF2 is the
      strongest KDF already in the runtime. `convex/lib/password.ts` names the
      upgrade path.
- [x] Implement password hashing — 100k iterations, 16-byte random salt
- [x] Implement password verification — constant-time, and the stored record is
      self-describing so the cost can be raised without invalidating passwords
- [x] Ensure plaintext passwords are never stored — only
      `pbkdf2-sha256$<iterations>$<salt>$<digest>`; `passwordHash` never leaves
      the backend, and `getOwned` exposes a `hasPassword` boolean instead
- [x] Add enable-password UI — paste detail page
- [x] Add change-password UI — the same form once a password is set
- [x] Add remove-password UI — with a `confirm()`, as the other destructive paths

### Unlock Flow

- [x] Detect protected pastes in wildcard runtime — `resolveForRuntime` returns
      `locked`, and withholds the storage URL and digest with it, so the content
      is gated in Convex rather than at the serving layer
- [x] Render password challenge page — `challenge.ts`, static HTML under
      `default-src 'none'` with no user-controlled content
- [x] Submit password securely — same-origin `POST /` on the paste host
- [x] Verify password server-side — `pastes.unlock`; the runtime only relays
- [x] Create paste-specific unlock session — `pasteUnlocks`, storing only the
      SHA-256 of the session secret
- [x] Scope unlock state to one paste only — two independent layers: the cookie
      is host-only to that subdomain, and the session names its paste, so a
      copied cookie unlocks nothing else
- [x] Set expiration — 12 hours, checked on every resolve; expired sessions for a
      paste are swept on its next successful unlock
- [x] ~~Add logout/forget-unlock behavior if needed~~ — not needed: the cookie is
      session-scoped to one paste and expires on its own, and changing or
      removing the password revokes every outstanding session.

### Abuse Prevention

- [x] Rate limit password attempts — 10 per (paste, client address) per 15
      minutes. `unlock` _returns_ rejections rather than throwing, because a
      Convex mutation is a transaction and a throw would roll back the very
      counter that throttles the attack.
- [x] Add temporary lockout rules if needed — the window is the lockout; past the
      cap even the correct password is refused until it resets
- [x] Ensure responses do not expose password validity details unnecessarily —
      unknown paste, unprotected paste and wrong password return an identical
      value, asserted in `convex/password.test.ts`
- [x] Log suspicious attempt patterns safely — a `console.warn` naming the paste,
      the client and the count when a lockout trips; never the attempted password

### Tests

- [x] Test correct password
- [x] Test incorrect password — including a prefix of the right one
- [x] Test expired unlock session
- [x] Test unlock isolation between pastes
- [x] Test password removal
- [x] Test password replacement — old sessions and the old password both die
- [x] Test rate limiting — the cap, that a correct password is refused past it,
      that a second client is unaffected, and that success clears the budget

Across `convex/lib/password.test.ts`, `convex/password.test.ts`, the runtime
route's own suite, `proxy.test.ts` (the unlock cookie is the only one that
crosses into a paste origin) and `e2e/password.spec.ts`.

## Milestone Acceptance Criteria

- [x] Owners can enable and remove password protection
- [x] Protected pastes cannot be viewed without a valid password — the wildcard
      runtime challenges, and the raw and preview endpoints stay closed because
      the host-only unlock cookie never reaches the app origin
- [x] Unlock state is isolated per paste
- [x] Password brute-force attempts are rate-limited

---

# Milestone 10 — Public REST API

## Goal

Provide a stable automation-friendly API for developers, scripts, and AI systems.

## Tasks

### API Infrastructure

- [x] Define API versioning strategy — path-based `/api/v1`, additive changes
      only within a version; documented in `docs/api.md`
- [x] Define standard JSON success format — `{ data }`, via `ok()` in `lib/api.ts`
- [x] Define standard JSON error format — `{ error: { code, message } }`
- [x] Define API error codes — the existing `ErrorCode` set in `lib/errors.ts`;
      `toAppError` maps a Convex rejection onto it and refuses to pass through a
      code it does not recognise
- [x] Add request IDs — `X-Request-Id` on every response, echoing an incoming one
- [x] Add API rate limiting — `convex/rateLimit.ts`, per caller per minute, with
      `RateLimit-*` headers; 240 reads / 60 writes
- [x] Add API logging without storing secrets or HTML payloads unnecessarily —
      `logger.child({ requestId })` logs the operation and its outcome only; the
      body is never logged and `lib/logger.ts` redacts token-shaped fields
- [x] Re-check CSRF, deferred here from Milestone 6 — the API accepts a Clerk
      cookie and a `text/plain` POST is CORS-simple, so cookie-only writes now
      require a same-origin `Origin`; header credentials and scripts are
      unaffected

### Create Paste

- [x] Implement `POST /api/pastes` — `POST /api/v1/pastes`
- [x] Accept raw `text/html` — the body _is_ the HTML, so `--data-binary @file`
      and a shell pipe both work; metadata rides in the query string
- [x] Validate request size — `Content-Length` first, then the actual bytes, then
      the stored object's own size inside Convex, which cannot be lied about
- [x] Upload HTML to Convex File Storage — the same `publishHtml` the browser
      uses; `lib/upload.ts` now takes any Convex client
- [x] Create paste metadata
- [x] Support anonymous creation
- [x] Support authenticated creation — Clerk session token or cookie
- [x] Support API-key creation — `Authorization: Bearer ph_…`
- [x] Return public URL
- [x] Return raw URL
- [x] Return anonymous update token when applicable

### Retrieve Paste Metadata

- [x] Implement `GET /api/pastes/[token]` — `GET /api/v1/pastes/[token]`
- [x] Return public metadata
- [x] Return owner-only metadata when authorized — the owner view is tried first
      and falls back to the public one; Convex decides which the caller gets

### Update Paste

- [x] Implement `PATCH /api/pastes/[token]`
- [x] Support owner authentication
- [x] Support API-key authentication
- [x] Support anonymous update token — `X-Update-Token`, its own header so it can
      never be confused with a bearer credential
- [x] Support content replacement — an HTML body replaces the content, a JSON
      body edits the metadata
- [x] Support title update
- [x] Support folder update where applicable — `folderId`, `null` to unfile
- [x] Support password settings only when appropriately authorized — `password`
      goes through `setPassword`/`removePassword`, not `update`, because
      changing it revokes every outstanding unlock session

### Delete Paste

- [x] Implement `DELETE /api/pastes/[token]`
- [x] Support owner authentication
- [x] Support API-key authentication — requires the `pastes:delete` scope
- [x] Support anonymous update token
- [x] Remove public availability immediately — the row goes in the transaction
      that authorized the delete, so the wildcard URL 404s at once
- [x] Trigger storage cleanup — `hardDeletePaste` drops the stored file with it

### Documentation

- [x] Document `curl` publishing — `docs/api.md`, plus the README
- [x] Document API authentication — all three credentials and what each grants
- [x] Document create request
- [x] Document update request
- [x] Document delete request
- [x] Document error codes
- [x] Document rate limits
- [x] Add API examples to the home page — a copyable one-line `curl`

## Milestone Acceptance Criteria

- [x] HTML can be published with a single API request
- [x] Anonymous and authenticated API flows work — anonymous end to end in
      `e2e/api.spec.ts`; the owner and API-key paths in `convex/apiKeys.test.ts`,
      where the authorization actually happens
- [x] API errors are consistent — one envelope, one code set, asserted across
      400/401/403/404/409/413/415 in `e2e/api.spec.ts`
- [x] Existing important API behavior is preserved where practical

### Carried into Milestone 11

API-key _authentication_ landed here because the API needs it: `convex/lib/
apiKeys.ts` (generate, hash, verify, expiry, revocation) plus `apiKeys.create`,
with scopes enforced inside Convex. Milestone 11 still owns the settings UI,
listing, revocation and `lastUsedAt`.

---

# Milestone 11 — API Keys

## Goal

Allow authenticated users to create scoped credentials for automation.

## Tasks

### API Key Backend

Most of this landed in Milestone 10, because the REST API could not authenticate
without it; verified here rather than rewritten.

- [x] Implement cryptographically secure API-key generation — `randomString`
      over `crypto.getRandomValues`, rejecting bytes past the last whole
      multiple of the alphabet so the distribution is unbiased
- [x] Define API-key prefix format — `ph_` + 40 characters; the first 6 of the
      secret are stored as `keyPrefix`, enough to recognise a key in a list and
      far too little to use
- [x] Hash API keys before persistence — SHA-256 hex, the same treatment update
      tokens get. A key is high-entropy random, so a plain digest is the right
      primitive; PBKDF2 is for passwords, which are guessable
- [x] Show raw key only once — returned by `apiKeys.create` and by nothing else;
      `list`'s returns validator has no field it could be added to
- [x] Implement API-key lookup — the `by_key_hash` index, so the raw key is
      never needed to find its row
- [x] Implement key verification — `verifyApiKey`, which refuses every failure
      with one message: a caller learns their key does not work, never whether
      it once existed
- [x] Implement scope verification — `requireScope`, called inside Convex rather
      than at the API edge, so a key cannot gain reach by taking another route in
- [x] Implement expiration — optional `expiresAt`, checked in `verifyApiKey`
- [x] Implement revocation — `apiKeys.revoke`, owner-only and idempotent; the
      first timestamp stands, because that is when access actually stopped
- [x] Implement `lastUsedAt` — `apiKeys.touch`. Verification happens in a query
      and queries cannot write, so `lib/api.ts` issues this alongside the
      rate-limit charge it already makes, in the same `Promise.all` — no extra
      round-trip. The write is throttled to once a minute per key, which is
      plenty for a displayed date and keeps a hot key off its own row
- [x] Prevent revoked-key reuse — asserted through `apiKeys.revoke`, not a
      hand-patched row, so the mutation and the check are tested together
- [x] Prevent expired-key reuse — asserted with a clock moved past the expiry

### API Key UI

- [x] Create API Keys settings page — `/dashboard/settings/api-keys`, live on
      `useQuery` and reached from the dashboard nav
- [x] Add create-key dialog — an inline form instead, as on the folders page. A
      modal would have had to hand the raw secret over on its way out; inline,
      the secret simply appears above the list it just joined
- [x] Add name field
- [x] Add scope selection — native checkboxes over the `SCOPES` list `schema.ts`
      already exports, so the page cannot drift from the backend
- [x] Add optional expiration — `<input type="date">`, read as the end of the
      chosen day in the browser's timezone, which is the one the person picking
      the date is thinking in
- [x] Show raw secret once after creation — in a dismissible block that says so
- [x] Add copy-key action — the existing `components/copy-button.tsx`
- [x] Add key list
- [x] Show key prefix
- [x] Show creation date
- [x] Show last-used date — or "never used"
- [x] Show expiration state — revoked / expired / expires / no expiry. `list`
      returns the raw timestamps and the page compares them, because a
      subscribed query that read the clock would go stale as it resolved
- [x] Add revoke action — behind `confirm()`, like every other destructive
      action in the app, and hidden once the key is already revoked

### Tests

- [x] Test valid key — publishes as the key's owner, not anonymously
- [x] Test invalid key — an unknown key is rejected, never downgraded to
      anonymous
- [x] Test revoked key
- [x] Test expired key
- [x] Test scope restrictions — read, write and delete, in both directions
- [x] Test cross-user access prevention — another account's paste, and another
      account's key in `apiKeys.revoke` and `apiKeys.list`
- [x] Test `lastUsedAt` and that `list` never leaks the digest — not on the
      original list, but they are the two things this milestone actually added

## Milestone Acceptance Criteria

- [x] Users can create and revoke API keys
- [x] Raw secrets are never persisted — only a SHA-256, asserted against the
      stored row and against the `list` payload
- [x] API scopes are enforced
- [x] API key usage is visible in the dashboard — prefix, scopes, created, last
      used and expiry state, live

---

# Milestone 12 — Analytics

## Goal

Provide lightweight paste analytics without slowing down public page delivery.

## Tasks

### Analytics Model

- [x] Finalize analytics fields — timestamp, referring host, approximate
      country, coarse browser family. One row per view in `pasteViews`; the
      lifetime total stays denormalized on `pastes.viewsCount`
- [x] Decide analytics retention period — 90 days for the rows, forever for the
      total. `analytics.RETENTION_MS`, swept daily by a cron, and the counter is
      never rewound, so the headline number outlives the detail behind it
- [x] Decide whether approximate country is required — yes, at country
      granularity only. Vercel's edge already sets `x-vercel-ip-country`; reading
      the header is what `@vercel/functions`' `geolocation()` does anyway, so a
      dependency for it would buy nothing
- [x] Decide whether referrer is required — yes, but the host alone. A full
      Referer carries a path and a query string that can name the visitor or
      what they searched for; `referrerHost` in `pastes.recordView` drops both
- [x] Decide whether user-agent family is required — yes, as one of five
      buckets. The raw string is a near-fingerprint, so it is read once at the
      edge and never sent to Convex; the column is a `v.union` of literals so a
      public mutation cannot widen it
- [x] Avoid storing unnecessary personal data — nothing stored identifies a
      visitor: no address, no full user-agent, no cookie, no session. The
      address the country came from never leaves the edge

### Collection

- [x] Implement non-blocking view recording — already `after()`-based in the
      wildcard route: the response is on the wire before the mutation is called
- [x] Increment paste view count
- [x] Record timestamp
- [x] Record optional referrer — normalized to a host inside the mutation, not
      at the caller, because `recordView` is public and the route is not the
      only thing that can reach it
- [x] Record optional country — clamped to a two-letter code, same reason
- [x] Record optional user-agent family
- [x] ~~Add abuse filtering if required~~ — not required. Per-visitor dedup would
      mean deriving and storing a key from the address, which is exactly the
      data this milestone decided not to keep; bot filtering is the filter
- [x] Exclude internal preview requests if appropriate — already excluded
      structurally: only the wildcard origin records views, and the dashboard
      preview and `/p/[token]/raw` are on the app origin
- [x] Exclude known bots if product policy requires it — a bot is traffic, not a
      reader, so it moves neither the total nor the breakdown. Substring checks
      on the user-agent, with `ua-parser-js` named as the upgrade path

### Aggregation

- [x] Implement total views — off the counter, so it is exact whatever the
      table holds
- [x] Implement recent views — last 24 hours and last 7 days
- [x] Implement views by day — 30 UTC days, zero-filled so the chart has no gaps
- [x] Implement top referrers if enabled
- [x] Implement country summary if enabled — and browsers, which is the same
      three lines
- [x] Optimize high-traffic aggregation strategy — bounded and indexed: one
      `by_paste_and_timestamp` range capped at 2000 rows, bucketed in JS. Past
      that a paste's breakdown is flagged `truncated` while the total stays
      exact; `@convex-dev/aggregate` is the noted upgrade

### UI

- [x] Add analytics summary to paste details — `analytics.tsx` beside the page,
      owner-authorized in Convex like everything else on it
- [x] Add view-count card — the section owns the total now, so `getOwned` no
      longer has to render it twice
- [x] Add recent activity visualization if needed — one CSS bar per day. A chart
      library for thirty numbers would outweigh the rest of the page
- [x] Add referrer table if enabled
- [x] Add country table if enabled
- [x] Add realtime total view count — `useQuery`, so a hit on the wildcard origin
      repaints the open page

## Milestone Acceptance Criteria

- [x] Public paste serving does not wait on analytics writes — `after()`, and
      `route.test.ts` asserts the mutation has not been called when the response
      is returned
- [x] View totals update correctly
- [x] Analytics UI is available to authorized owners — and only to them: a
      stranger, a signed-out caller and an anonymous paste all reject in
      `convex/analytics.test.ts`
- [x] Analytics collection follows the chosen privacy policy — the referrer is
      reduced to a host, the country to two letters, the user-agent to a bucket,
      and the rows expire

---

# Milestone 13 — MCP Server

## Goal

Allow AI agents and MCP clients to publish and manage pastes using the current MCP specification.

## Tasks

### MCP Foundation

- [x] Verify the current MCP specification before implementation — read from the
      installed SDK (1.30.0) rather than from memory: latest protocol revision
      `2025-11-25`, still-supported `2025-06-18` and `2025-03-26`, streamable
      HTTP as the remote transport, `stdio`/SSE not applicable to a Vercel route
- [x] Install and configure the official MCP TypeScript SDK — installed in
      Milestone 0; configured here
- [x] Create `/mcp` route — `app/mcp/route.ts`, `POST` only
- [x] Define MCP transport — the SDK's own
      `WebStandardStreamableHTTPServerTransport`, which speaks `Request`/
      `Response` and so drops straight into a route handler. Stateless
      (`sessionIdGenerator: undefined`) with `enableJsonResponse`, because a
      serverless function holds nothing between requests: one server and one
      transport per request, no session id, no `GET` SSE stream
- [x] Define authentication requirements — see _Authentication_ below
- [x] Implement MCP-compatible error handling — a failed tool answers
      `isError: true` with `{"error":{"code","message"}}`, the same `ErrorCode`
      set the REST API returns; protocol and rate-limit failures stay at the
      HTTP layer, through the same `route()` wrapper
- [x] Add MCP request logging without leaking content or credentials — tool name
      and outcome only, through the existing redacting `logger`

### Tools

- [x] Implement `create_paste` — delegates to `publishHtml`
- [x] Implement `get_paste` — owner view first, public view as the fallback
- [x] Implement `update_paste` — HTML, metadata, or both in one call
- [x] Implement `delete_paste` — `pastes.remove`
- [x] Implement `list_pastes` — `pastes.listByOwner` now takes the same
      `apiKey` argument as `pastes.getOwned` and requires `pastes:read`, so a
      key lists its own account and a write-only key is refused
      (`convex/apiKeys.test.ts`)
- [x] Define input schemas for each tool
- [x] Define output schemas for each tool — loose where a paste's owner-only
      fields may or may not be present, so a conforming client never rejects its
      own data
- [x] Reuse core paste domain functions — `publishHtml`, `replaceHtml`,
      `pasteUrls`, `convex/pastes.ts`; the MCP layer adds no paste logic
- [x] Reuse core authorization logic — every tool forwards the credential and
      lets Convex decide; ownership and scopes are never re-derived here

### Authentication

- [x] Decide launch MCP authorization model — **`Authorization: Bearer ph_…`
      API keys**, the credential Milestone 11 already issues, whose scopes
      Convex already enforces. It costs nothing to build, it is revocable per
      key, and every production MCP client can send a static header. Anonymous
      `create_paste` stays possible, matching the REST API
- [x] Implement authorization flow — `credentialsFrom(request)` from
      `lib/api.ts`, unchanged; anonymous pastes additionally accept their update
      token as a tool argument, since an MCP client cannot set a per-call header
- [ ] Support current MCP client registration requirements — **deferred**. OAuth
      2.1 with dynamic client registration means running an authorization
      server, and a static API key already authenticates every client we care
      about. Revisit when a client that cannot send a header asks for it
- [ ] Support current MCP metadata/discovery requirements — **deferred with the
      line above**: `/.well-known/oauth-protected-resource` and the
      `WWW-Authenticate` challenge only describe the OAuth model, and publishing
      them while there is no authorization server would advertise a flow that
      does not exist
- [x] Add token validation — `convex/lib/apiKeys.ts` `verifyApiKey`, against the
      stored SHA-256
- [x] Add scope validation — `requireScope` inside Convex, so `/mcp` can never
      grant more than the equivalent REST call
- [x] Add token revocation strategy — the same keys page: revoke or expire, and
      `verifyApiKey` refuses both on the next request

### Agent Experience

- [x] Return public URL directly from `create_paste`
- [x] Return raw URL directly from `create_paste`
- [x] Provide clear tool descriptions — written for an agent deciding which tool
      to call, with `readOnlyHint`/`destructiveHint` annotations
- [x] Provide predictable machine-readable errors
- [x] Document MCP setup — `docs/mcp.md`
- [x] Test with at least one production-grade MCP client — driven live by the
      official SDK's own `Client` over `StreamableHTTPClientTransport` against a
      running server: it negotiated the protocol, listed all five tools, created
      a paste whose public URL then served the HTML and whose raw URL answered
      `text/plain`, read it back, renamed it, had a wrong update token refused
      with `FORBIDDEN`, deleted it with the right one, and got a 404 after.
      `app/mcp/route.test.ts` keeps the same ground covered unattended

## Milestone Acceptance Criteria

- [x] An MCP client can create a paste
- [x] The tool returns a working public URL
- [x] Authenticated MCP clients can manage authorized pastes — read, update,
      delete and list, each with the credential's scope enforced inside Convex
- [x] MCP follows the current specification at launch — protocol, transport and
      framing come from the official SDK, so they track the spec revision the
      SDK ships

---

# Milestone 14 — Custom Subdomains

## Goal

Support user-selected subdomains such as `my-demo.pastehtml.assoli.site` in addition to generated paste tokens.

## Tasks

The name rules, the uniqueness check and the host routing all landed with the
milestones that needed them — a `customSubdomain` column with no way to set it
would have been dead weight. What was actually missing was the way in: an
availability query and a UI. Those are what this milestone adds.

- [x] Finalize whether custom subdomains are included in v1 — **yes**, they ship
      in v1. The wildcard runtime already serves any single label, so a vanity
      name costs a column and a lookup, not an architecture.
- [x] Define minimum length — 3, `SUBDOMAIN_MIN_LENGTH` (Milestone 1)
- [x] Define maximum length — 63, the DNS label ceiling (Milestone 1)
- [x] Define valid character rules — lowercase letters, digits and interior
      hyphens (Milestone 1)
- [x] Normalize to lowercase — `validateCustomSubdomain` trims and lowercases
      before anything else looks at the value (Milestone 1)
- [x] Reject invalid DNS labels — one regex, and `lib/host.ts` applies the same
      one when routing, so a name that cannot be stored also cannot be reached
      (Milestone 1 / Milestone 4)
- [x] Create reserved-subdomain list — `RESERVED_SUBDOMAINS`, read by both the
      validator and `lib/host.ts`, which keeps serving those labels from the app
      (Milestone 1 / Milestone 4)
- [x] Validate uniqueness — `claimSubdomain`, one `by_custom_subdomain` lookup
      (Milestone 1)
- [x] Implement custom-subdomain lookup — `pastes.getByCustomSubdomain`, and
      `resolveForRuntime` tries the subdomain index before the token index, so
      one host lookup serves both kinds of name (Milestone 1 / Milestone 4)
- [x] Implement custom-subdomain assignment — `pastes.create({ customSubdomain })`
      and `pastes.update`, plus the REST API's `subdomain` field (Milestone 1 /
      Milestone 10). This milestone adds the dashboard UI over them.
- [x] Implement custom-subdomain removal — `pastes.update({ customSubdomain: null })`
- [x] Implement custom-subdomain change — the same field on the same mutation. A
      dedicated assign/change/remove mutation would be three names for one
      `patch`, and three places for the uniqueness check to drift apart.
- [x] Restrict custom-subdomain changes to authorized owners — `authorizePasteWrite`,
      which resolves the caller from their own Clerk session, API key or update
      token; no caller-supplied owner id exists to spoof. **Decision**: an
      anonymous paste's update-token holder may claim a name too. The token is
      that paste's only credential, anonymous publishing is the front door, and
      gating vanity names behind a sign-up would be a product decision dressed
      up as a security one. The squatting that allows is metered in Milestone 15,
      noted at the call site.
- [x] Prevent race conditions when assigning subdomains — nothing to build: a
      Convex mutation is a single serializable transaction, so the availability
      read and the write that follows it commit together, and OCC retries any
      mutation whose reads a concurrent commit invalidated. Two callers racing
      for one name cannot both see it free — the loser re-runs, reads the
      winner's row and gets `CONFLICT`. The argument is written out over
      `claimSubdomain`, because it only holds while that read stays inside the
      mutation that writes.
- [x] Add UI for custom subdomain selection — `custom-subdomain.tsx` on the paste
      detail page: the current URL with a copy button, one form for both assign
      and change, and a `confirm()`-guarded remove
- [x] Add availability indicator — `pastes.checkSubdomain`, a live subscription
      behind a 300ms `setTimeout` debounce. It _returns_ its rejection instead of
      throwing, so a half-typed name shows a message rather than tripping the
      dashboard error boundary, and it answers "available" for the asking
      paste's own name. Advisory only — the mutation re-checks.
- [x] Add tests for reserved names — `convex/lib/validation.test.ts` for the
      list, `convex/pastes.test.ts` for the mutation and the indicator
- [x] Add tests for duplicates — a second paste claiming a taken name, a paste
      re-saving its own (a no-op, not a conflict), and the old name going free
      again the moment a change commits
- [x] Add tests for invalid characters — the DNS-label cases and both ends of the
      length range in `convex/lib/validation.test.ts`
- [x] Add tests for routing — `proxy.test.ts` rewrites `my-demo.<root>` to the
      paste runtime (vanity names are hyphenated where generated tokens never
      are), `lib/host.test.ts` covers the label rules under the production root,
      and `pastes.test.ts` proves `resolveForRuntime` hands that label the right
      paste

## Milestone Acceptance Criteria

- [x] Authorized users can assign an available custom subdomain — from the
      dashboard, the REST API, or at publish time
- [x] Reserved and invalid names are rejected — `VALIDATION` for a malformed
      label, `CONFLICT` for a reserved or taken one
- [x] Custom subdomains route to the correct paste
- [x] Duplicate assignment is impossible — see the transaction argument above

---

# Milestone 15 — Security Hardening and Abuse Prevention

## Goal

Harden the product before migration and public launch.

## Tasks

### Cookie and Origin Security

- [x] Audit all cookies — two families and nothing else. Clerk's session
      cookies on the app host, which Clerk sets and scopes itself, and
      `ph_unlock`, the single cookie this app writes
      (`app/internal/paste/[subdomain]/route.ts`). No analytics cookie, no
      preference cookie, nothing on a paste origin but the unlock session.
- [x] Verify no auth cookie is available to wildcard paste origins — holds,
      unchanged from Milestone 6 and still three layers deep: Clerk never runs
      on a paste host, the rewrite rebuilds `Cookie` from scratch keeping only
      `ph_unlock`, and `e2e/auth.spec.ts` reads `document.cookie` from inside a
      paste while a real session is live.
- [x] Audit SameSite settings — `ph_unlock` is `Lax`, and `Lax` is the correct
      one rather than the weaker one: the unlock POST is same-origin, so
      `Strict` would pass too, but it would then drop the cookie on the next
      inbound link to the paste and re-challenge a visitor who had just
      unlocked it.
- [x] Audit Secure flags — `ph_unlock` carries `Secure` exactly when the request
      arrived over HTTPS, so production is always secure and `http://…localhost`
      still works in development.
- [x] Audit HttpOnly flags — `ph_unlock` is `HttpOnly`, which matters more here
      than usual: once a paste is unlocked its own scripts run on that same
      origin, and this is what keeps the session out of their reach.
- [x] Add Origin validation to sensitive endpoints — two now. `lib/api.ts`
      refuses a cookie-only write carrying a foreign `Origin` (Milestone 10),
      and the unlock POST now requires its own. A form POST is CORS-simple, so
      without that check any page on the internet could submit password guesses
      from its visitors' browsers and spread the per-address throttle across
      every one of them. The check and the challenge page's own headers
      interact: under `Referrer-Policy: no-referrer` Chrome sends
      `Origin: null` for a form post, which named nobody and locked every real
      visitor out — caught only in a browser, by `e2e/password.spec.ts`. The
      challenge is `same-origin` now (it loads nothing, under
      `default-src 'none'`, so the paste URL still never leaves), a literal
      `null` origin stays refused, and two cases in the runtime route's suite
      pin both halves so the header cannot be "hardened" back.
- [x] Add CSRF protection where necessary — those two are all of it. Convex
      authenticates with a bearer JWT rather than a cookie, and the app has no
      Server Actions, so there is no third cookie-authenticated write to forge.

### XSS and HTML Isolation

An audit, not a build: React escapes its children, so the question is only
whether any paste-controlled string escapes React. None does — `grep` finds no
`dangerouslySetInnerHTML` and no `innerHTML` anywhere in `app/`.

- [x] Audit dashboard rendering of paste metadata — title, filename, description
      and custom subdomain each reach the DOM as a React child, on the dashboard
      detail page, the folder and dashboard lists, and `/p/[token]`. The only
      paste value that reaches an attribute is `customSubdomain`, and it is a
      validated DNS label, so no `javascript:` URL can be built out of one.
- [x] Escape user-controlled titles — nothing to add: `{displayName(paste)}` and
      `{paste.title || paste.filename}` are children, and the copy of the title
      that reaches `generateMetadata` is escaped by React on the way into `<title>`
- [x] Escape user-controlled filenames — the same, plus the one place a filename
      leaves the DOM: the raw endpoint percent-encodes it into `Content-Disposition`
      in RFC 5987 form, which also neutralises quotes (`app/p/[token]/raw/route.test.ts`
      asserts it on a filename containing them)
- [x] Never inject raw paste HTML into privileged app DOM — the app origin has
      exactly two routes to stored bytes and neither parses them as app-origin
      markup: `/p/[token]/raw` serves `text/plain` + `nosniff`, and
      `/p/[token]/render` serves them under a CSP `sandbox` without
      `allow-same-origin`. Proven in `e2e/preview.spec.ts`, which reads
      `document.contentType` on one and `window.origin === "null"` on the other.
- [x] Audit preview sandbox — the fence is stated twice and holds at both: the
      render response carries a CSP `sandbox` directive, and the dashboard
      `<iframe>` that embeds it carries a `sandbox` attribute. Neither grants
      `allow-same-origin`, which is the whole sandbox.
- [x] Audit Content Security Policy — two exist and both are correct: the render
      sandbox above, and the unlock challenge's `default-src 'none'` policy,
      which pins `form-action` to `'self'` and renders nothing user-controlled.
      The wildcard runtime deliberately sets none — a published page is meant to
      run its own scripts, and its isolation is the separate origin. The app
      origin's own header is the Headers subsection's box.

### Rate Limiting

The audit's finding, which shapes the rest: **an identifier the edge supplies
is not a security boundary.** Milestone 10's limiter keys on the caller's
address and Milestone 9's on a `client` argument, and both are reachable around
— `NEXT_PUBLIC_CONVEX_URL` is in the browser bundle, so anyone can call the
public Convex mutations directly and label themselves however they like. Every
limit below is therefore charged inside Convex, by `enforce` in
`convex/rateLimit.ts`, and the edge limiter is kept for what it is good at:
answering with `RateLimit-*` headers before any work happens.

- [x] Rate limit anonymous paste creation — the hole `convex/rateLimit.ts`
      admitted in its own header comment. The browser publishes by calling
      `pastes.create` directly (`lib/upload.ts`), so the REST limiter never saw
      the front door; `create` now charges `paste:create` itself. A signed-in
      author is charged to their account. **Anonymous authors share one global
      bucket** — a Convex mutation cannot see a client address and a
      caller-supplied one would be a lie — which makes it a burn-rate ceiling
      rather than a fairness mechanism, and a denial-of-service surface in its
      own right. Hence the 10-second window: 30 per 10s holds the same sustained
      ceiling a per-minute limit would while capping an outage at ten seconds.
      Recorded in the module's `ponytail:` note along with the OCC contention
      that one shared row implies.
- [x] Rate limit password attempts — Milestone 9 said this was done. It was not:
      `unlock` is public and its `client` argument is caller-supplied, so a
      guesser mints a fresh identifier per attempt and the per-(paste, client)
      cap never trips. Fixed with a second cap that does not read `client` at
      all — 100 failures per paste per 15 minutes, in the same `unlockAttempts`
      table under a sentinel row. The per-client cap stays and stays first, so
      an honest visitor still has a budget of their own instead of a share of
      one an attacker is draining. The trade-off is stated where the constants
      are: a paste under attack is shut to everyone, correct password included,
      for the rest of the window. `unlockAttempts` also gained the hourly sweep
      it never had, because a fresh `client` per guess is a fresh row.
- [x] Rate limit API-key requests — verified, not rebuilt: `lib/api.ts` charges
      `api:read` / `api:write` per key prefix before the handler runs, 240 and
      60 a minute. Underneath it the paste buckets now apply to a key like any
      other caller.
- [x] Rate limit MCP requests — verified: `app/mcp/route.ts`'s `POST` is the
      same `route()` wrapper at `api:write`, so one JSON-RPC request is one
      charge, and the tools land on the same in-Convex buckets underneath.
      Nothing to add.
- [x] Rate limit paste updates — `update` and `replaceContent` charge
      `paste:write`, keyed to the owning account or, for an anonymous paste, to
      the paste itself. Per-paste rather than global, so no shared chokepoint.
- [x] Rate limit destructive operations — the same bucket on `remove`,
      `setPassword` and `removePassword`; the last two are destructive in the
      sense that matters, since either revokes every outstanding unlock session.
- [x] Define rate-limit response format — unchanged at the edge: `429` with
      `{ error: { code: "RATE_LIMITED" } }` and `RateLimit-Limit` /
      `-Remaining` / `-Reset`. An in-Convex refusal raises the same
      `RATE_LIMITED` code, which `toAppError` maps onto the same envelope, but
      carries no `RateLimit-*` headers — the budget it spent is neither
      per-request nor per-caller, so there is no honest number to report.

Two public mutations are deliberately left uncharged, and both are named here
rather than quietly skipped. `pastes.recordView` is unmetered because a cap on
it would drop the views of a paste that got popular, which is a product
regression to fix an inflated number; retention already bounds the table.
`storage.generateUploadUrl` is unmetered because the hourly orphan sweep bounds
what an unreferenced upload can cost to an hour of storage — charge it the day
that stops being true, in a bucket of its own so it does not spend the
creation budget twice.

### Abuse Controls

All of it lives in `convex/admin.ts`, and the shape of that file is the
trade-off worth recording: **the moderation workflow is `npx convex run`.** A
one-person product has exactly one moderator, and a console for them would be a
login page, an admin role and a permission model to get wrong — three new ways
to lose control of the takedown button, to save typing a command. The file's
header carries the six invocations. Give it a UI the day a second person
moderates.

- [x] Add paste-disable internal function — `admin.disable` / `admin.enable`,
      setting `disabledAt` + `disabledReason` on the paste. This is the answer
      Milestone 4 anticipated and left open: `resolveForRuntime` now withholds
      the storage URL for a disabled paste exactly as it does for a locked one,
      so the wildcard runtime answers `410 Gone` and the raw and preview
      endpoints stop with it — one flag, every surface, no serving-layer change.
      Disabled beats locked, so a takedown cannot be opened with the password
      its author set.
- [x] Add paste-delete administrative function — `admin.purge`, by token, no
      caller authorization. It reuses `pastes.hardDelete`, so the row and the
      stored bytes go together. `disable` is the one to reach for first: it is
      reversible and it keeps the evidence.
- [x] Add simple internal moderation workflow — `admin:pending` for the queue,
      `admin:inspect` to look, `admin:disable` / `admin:purge` to act,
      `admin:resolve` to close. Five commands, no UI, per the trade-off above.
- [x] Add abuse-report intake mechanism — `POST /api/v1/abuse`, unauthenticated,
      writing to `abuseReports`. A sign-up wall in front of a report means never
      hearing about the phishing page. Throttled twice: per address by the REST
      limiter, and per _reported paste_ in Convex, so one target cannot be
      report-bombed into an unreadable queue.
- [x] Add operational metadata required for abuse investigation — `admin.inspect`
      returns what a decision actually needs: owner (Clerk's `tokenIdentifier`,
      which is what Clerk's own dashboard looks an account up by) or its absence,
      timestamps, size, content type, the stored SHA-256 — which identifies the
      exact bytes, so the same payload is recognisable across pastes without
      keeping a copy — view count, and the paste's report history.
- [x] Avoid unnecessary sensitive-data retention — audited and it already holds,
      and the new code keeps it: no publisher address is stored anywhere, so
      there is none for `inspect` to return; `pasteViews` keeps a country, a
      referring host and a browser bucket and no visitor; `lib/logger.ts`
      redacts anything token-shaped. `abuseReports` deliberately records nothing
      about the reporter — a contact address a one-person product cannot act on
      is personal data with only a downside.
- [x] ~~Add configurable blocked identifiers if needed~~ — not needed, and the
      configurable list that matters already exists: `RESERVED_SUBDOMAINS` in
      `convex/lib/validation.ts` is one array in one place, and adding a
      phishing-bait label to it is a one-line change. Blocking a _publisher_
      would need a repeat abuser to exist first; until one does, `admin.disable`
      and `admin.purge` are the whole response and a block list is a table to
      maintain for nobody.

**API-key scopes, folded in here because it is the same question** — who may do
what: `folders:read` and `folders:write` were grantable and enforced nowhere.
`convex/folders.ts` took no `apiKey` at all, so no key could reach folder CRUD,
while the one folder operation a key _could_ reach — `pastes.update({ folderId })`
— was gated on `pastes:write`. A key deliberately scoped to pastes could refile
its owner's pastes. Implemented rather than dropped: folders are a real feature
and MCP already advertises `folderId` to key holders, so two dead scopes were
the bug, not two scopes too many. `apiKey` is threaded through the folder
functions with the matching `requireScope`, and both `pastes.create` and
`pastes.update` now require `folders:write` when folder membership is what they
are editing.

### Headers

Every rule in `next.config.ts` is scoped with `has: [{ type: "host" }]`, and
that scoping is the whole exercise. Proxy rewrites a paste origin to the runtime
_after_ header rules match, so a path-only rule would match `/` on a paste host
too — and a published page is meant to be embeddable and to run its own
scripts, so a frame or CSP rule reaching one would break the product. Verified
against a running build: the app host gets all five headers, a paste host gets
only the runtime's own three, and `/p/[token]/render` keeps its `sandbox` CSP
with nothing appended to it.

- [x] Configure dashboard CSP — `base-uri 'self'`, `object-src 'none'`,
      `frame-ancestors 'self'` and `form-action 'self'`, on the app's own pages
      only, listed one by one so it can never reach `/p/[token]/render` and
      end up as a second CSP header beside its sandbox. Deliberately **no
      `script-src`**: locking scripts down needs a per-request nonce threaded
      through Proxy into Next's and Clerk's inline bootstrap, which also makes
      every page dynamic — a real cost for a policy that is depth here, not the
      primary defence, since uploaded HTML never enters this DOM at all. What is
      left closes what React's escaping does not: a stolen `<base>`, a plugin
      object, a form posting credentials elsewhere, and being framed.
- [x] Configure `X-Content-Type-Options` — `nosniff` on every app-host response.
      The raw endpoint already set it per-response and still does; this is the
      same guarantee for everything else the app serves.
- [x] Configure referrer policy — `strict-origin-when-cross-origin` on the app
      host. Paste responses keep the stricter `no-referrer` they already set,
      since a paste path can name what someone published.
- [x] Configure frame policy where relevant — `X-Frame-Options: SAMEORIGIN` plus
      `frame-ancestors 'self'`. `SAMEORIGIN` rather than `DENY` because the
      dashboard previews a paste in a same-origin iframe. The wildcard runtime
      is untouched and stays framable by anyone, which is the point of it.
- [x] Configure permissions policy — `camera`, `microphone`, `geolocation` and
      `payment` all denied on the app host. A published page keeps every
      capability it wants, because the policy never reaches its origin.
- [x] Audit CORS behavior — no `Access-Control-Allow-Origin` anywhere, and that
      is the finding: the REST API and `/mcp` are for scripts, CLIs and agents,
      none of which are subject to CORS, so cross-origin browser JS cannot read
      a response and nothing needs it to. Adding `*` would only widen what a
      hostile page can do with a visitor's ambient credentials.
- [x] Audit cache headers on private content — the dashboard was already correct
      and needed nothing: every route under it reads `auth()`, so Next marks it
      `private, no-cache, no-store, max-age=0, must-revalidate` (confirmed with
      `curl` against a production build). The API did need a line: a `GET` on a
      paste returns the owner view or the public view for the same URL depending
      on who asks, so `lib/api.ts` now states `private, no-store` on every
      response it builds rather than leaving that to a default.

### Secrets

- [x] Audit Vercel environment secrets — one secret, `CLERK_SECRET_KEY`. The
      other four variables are `NEXT_PUBLIC_*` and public by definition: the app
      URL, the Convex deployment URL, the Clerk publishable key and the sign-in
      paths.
- [x] Audit Convex environment secrets — one, `CLERK_JWT_ISSUER_DOMAIN`, and it
      is not even secret — it is the public issuer URL Convex fetches a JWKS
      from. It lives on the deployment rather than in `.env.local` because
      `convex/auth.config.ts` runs in Convex, not in Next.
- [x] Verify no secret is exposed with `NEXT_PUBLIC_` — holds. `lib/env.ts` is
      the only module that reads `process.env` in application code, every
      `NEXT_PUBLIC_` name in it is public by design, and `CLERK_SECRET_KEY` is
      read only from `serverEnv()`, a function no client module imports.
- [x] Add secret rotation procedure — below. Two secrets, so it is two
      procedures, and Milestone 18 folds them into the operations runbook.
- [x] Ensure logs redact credentials — already true and re-checked:
      `lib/logger.ts` replaces any field whose name matches
      `password|token|secret|apikey|api_key|authorization|cookie`, recursively,
      and `lib/api.ts` logs an operation and a status code but never a body.
      The one credential-adjacent value that reaches a log line deliberately is
      the first nine characters of an API key, used as a rate-limit bucket name;
      that prefix is stored in `apiKeys.keyPrefix` on purpose and is not enough
      to authenticate with.

**Rotation.** Neither secret is stored anywhere but its own provider, so
rotation is: mint the new one, set it, redeploy, revoke the old one — in that
order, so there is no window with no valid credential.

- `CLERK_SECRET_KEY` — Clerk dashboard → API keys → create a new secret key;
  `vercel env rm CLERK_SECRET_KEY production` then `vercel env add`, or the
  dashboard; redeploy (a secret is read at runtime, but the deploy is what picks
  up the new environment); confirm a sign-in works; delete the old key in Clerk.
  Sessions survive — the key signs API calls, not the session cookie.
- `CLERK_JWT_ISSUER_DOMAIN` — not a rotation but a re-point, and the one that
  needs care: `npx convex env set CLERK_JWT_ISSUER_DOMAIN <new issuer>` takes
  effect on the next request, and every JWT from the old issuer stops verifying
  at that moment. Do it with the Clerk instance switch, not before it.
- Convex deploy key — `npx convex dashboard` → Settings → Deploy keys → revoke
  and regenerate, then update `CONVEX_DEPLOY_KEY` in Vercel. Nothing in the app
  reads it; only builds do.
- An anonymous paste's update token cannot be rotated by design — it is issued
  once and never redisplayed. The recovery is to claim the paste into an
  account, which retires the token.

### Security Testing

Most of this was already tested where the rule lives, milestone by milestone.
What this pass adds is `convex/security.test.ts` for the cases that span two
functions or two credentials, and `e2e/security.spec.ts` for a paste that goes
looking rather than an app that says it is safe.

- [x] Test subdomain cookie isolation — already covered by `e2e/auth.spec.ts`
      (a real Clerk session, no leading-dot `Domain`, empty `document.cookie`
      inside a paste) and `proxy.test.ts` (the `Cookie` header rebuilt from
      scratch). `e2e/security.spec.ts` adds the active version: a paste that
      reads for the cookie, frames the dashboard, and writes to its own
      `localStorage` to prove the app origin never sees it.
- [x] Test CSRF defenses — already covered by `e2e/api.spec.ts` over real HTTP.
      `lib/api.test.ts` adds the case this product specifically has to get
      right: a cookie-only write from a **wildcard paste origin**, which a
      suffix match on the host would have let through.
- [x] Test IDOR scenarios — `convex/security.test.ts` walks every owner-only
      entry point with the wrong account and asserts the code _and_ that the
      rejection carries nothing but `{ code, message }`: no owner identity, no
      title, no document id.
- [x] Test cross-user paste access — the read/update/delete cases are in
      `convex/pastes.test.ts` and `convex/apiKeys.test.ts`; `security.test.ts`
      adds content replacement, both password mutations and analytics.
- [x] Test cross-user folder access — already covered by `convex/folders.test.ts`
      (get, rename, remove, assignment, and `listByFolder`, which answers
      `NOT_FOUND` because the folder is what the caller does not own)
- [x] Test API-key scope bypass attempts — `security.test.ts` takes a
      delete-only key to every other function on a paste and gets `FORBIDDEN`
      from each, because the scope is checked inside the function rather than at
      the surface that called it. **Finding, since fixed**: `folders:read` and
      `folders:write` were grantable but checked nowhere — `convex/folders.ts`
      took no `apiKey` at all, and the one folder operation a key can reach,
      `pastes.update({ folderId })`, was gated on `pastes:write` alone. The
      folder functions now take a key and check the scope, refiling a paste
      costs `folders:write`, and the case is live rather than skipped.
- [x] Test anonymous update-token guessing resistance — `security.test.ts`: a
      truncated token, a one-character miss, a lengthened one, another paste's
      _live_ token, and an owned paste that no token manages at all
- [x] Test password brute-force controls — the cap, its per-client scope, its
      reset and the no-free-guess rule are covered by `convex/password.test.ts`
      and still hold. **Finding, since fixed**: `pastes.unlock` is a public
      Convex mutation and `client` is just an argument, so a caller who skipped
      our runtime picked a fresh identifier per guess and never met the cap — no
      address pool needed. A second cap now counts every failure against the
      paste itself, whatever the caller calls itself, and `unlockAttempts` has
      the sweep it was missing. The rotating-identifier case in
      `security.test.ts` is live rather than skipped.
- [x] Test hostile HTML payloads — `e2e/security.spec.ts` publishes a page that
      tries the app's cookies, `document.domain`, a framed dashboard, a
      `postMessage` at it, and `fetch` at `/api/v1` with ambient credentials,
      and asserts each comes back empty. A second test proves the paste origin
      routes no app path at all, so there is no origin where ambient credentials
      and a privileged endpoint could meet.
- [x] Test malformed host headers — `proxy.test.ts`: an IPv6 literal, an
      over-long label, embedded whitespace and tabs, plain and percent-encoded
      path traversal, an empty label, a root dot behind a port, and an absent
      `Host`. None produces a rewrite. The label rules themselves stay in
      `lib/host.test.ts`. A CRLF is not testable and does not need to be — the
      runtime refuses to build the header value at all.

## Milestone Acceptance Criteria

- [x] Critical security review findings are resolved — three were found and all
      three are closed: the password throttle could be walked past by inventing
      a `client` per guess, anonymous publishing had no limit at all because the
      browser calls Convex directly, and two API-key scopes were grantable but
      checked nowhere. The pattern behind all three is one line long — an
      identifier or a check that lives at the edge is not a boundary — and every
      fix moved the enforcement into Convex.
- [x] Auth cookies remain isolated from wildcard content — re-audited, unchanged
      since Milestone 6, and now also true of the headers: every rule in
      `next.config.ts` is scoped to the app host, so nothing this milestone
      added reaches a paste origin.
- [x] Sensitive operations have rate limits — creation, updates, content
      replacement, deletion, password changes, unlock attempts and abuse
      reports, all charged inside Convex where no surface can skip them.
- [x] Privileged application pages never execute uploaded HTML — the other
      half's audit, and it holds: `text/plain` + `nosniff` on the raw endpoint,
      a `sandbox` CSP without `allow-same-origin` on the preview.
- [x] Abuse controls exist for administrators — disable, re-enable, purge,
      inspect, and a report queue, all through `npx convex run`. The deliberate
      absence is a moderation UI; see the Abuse Controls note for why.

---

# Milestone 16 — Caching and Performance

## Goal

Make paste delivery fast globally while preserving correct behavior for updates and deletions.

## Tasks

### Runtime Performance

- [x] Measure baseline paste request latency
- [x] Ensure paste lookup uses indexed Convex queries
- [x] Avoid unnecessary React rendering in runtime route
- [x] Minimize runtime dependencies
- [x] Avoid blocking analytics writes
- [x] Avoid unnecessary file transformations

### HTTP Caching

- [x] Define cache policy for public paste runtime
- [x] Define cache policy for raw endpoint
- [x] Define cache policy for preview endpoint
- [x] Define cache policy for metadata page
- [x] Define cache policy for dashboard routes
- [x] Implement ETags
- [x] Implement `If-None-Match`
- [x] Return `304 Not Modified` when appropriate
- [x] Ensure deleted content does not remain cached too long
- [x] Ensure updated content invalidates or bypasses stale cache

### Content Hashing

- [x] Generate content hash when uploading HTML
- [x] Store content hash in paste metadata
- [x] Recalculate hash on replacement
- [x] Use content hash for ETag where appropriate

### Load Testing

- [x] Create load-test scenario for public paste reads
- [x] Create load-test scenario for anonymous creation
- [x] Create load-test scenario for API publishing
- [x] Create load-test scenario for high-view-count paste
- [x] Verify analytics does not become a bottleneck
- [x] Review Convex usage patterns under load
- [ ] Review Vercel function behavior under load — needs a deployment;
      everything measurable locally is in `docs/load-testing.md`

## Milestone Acceptance Criteria

- [x] Typical paste requests avoid unnecessary backend work
- [x] Conditional requests work
- [x] Updated pastes become visible within the chosen cache policy
- [x] High-traffic pastes do not block on analytics processing

---

# Milestone 17 — Observability and Operational Tooling

## Goal

Make production issues diagnosable before migrating real traffic.

## Tasks

### Logging

- [x] Add structured server logs
- [x] Add request IDs
- [x] Add correlation IDs across Next.js and Convex where practical
- [x] Log paste operation type without logging full HTML
- [x] Redact API keys
- [x] Redact update tokens
- [x] Redact authentication tokens
- [x] Redact passwords

### Error Tracking

- [x] Configure Sentry or equivalent
- [x] Add Next.js error tracking
- [x] Add client-side error tracking
- [x] Add release/environment labels
- [ ] Add source maps — browser maps are emitted and uploaded; the Node
      bundle has no upload path without `@sentry/nextjs` (`lib/sentry.ts`)
- [x] Verify sensitive data is scrubbed

### Monitoring

- [x] Define critical production health checks
- [x] Monitor failed paste creates
- [x] Monitor runtime 5xx rate
- [x] Monitor API error rate
- [x] Monitor MCP error rate
- [x] Monitor Convex function errors
- [ ] Monitor storage errors — a failed storage read is a returned 502, not a
      throw, so `onRequestError` misses it; visible only as a Vercel status code
- [x] Monitor auth failures
- [x] Monitor abnormal rate-limit spikes

### Operational Documentation

- [x] Create incident-response notes
- [x] Create rollback runbook
- [x] Create migration rollback runbook
- [x] Document Convex deployment recovery
- [x] Document Vercel deployment rollback
- [x] Document domain/DNS recovery steps

## Milestone Acceptance Criteria

- [x] Production errors are visible and diagnosable
- [x] Credentials are not leaked through logs
- [x] Rollback instructions exist
- [x] Core product health can be monitored

---

# Milestone 18 — Automated Testing and Compatibility Suite

## Goal

Build enough automated coverage to safely replace the existing Rails application.

## Tasks

### Unit Tests

- [x] Test token generation
- [x] Test custom-subdomain validation
- [x] Test reserved-subdomain validation
- [x] Test password hashing helpers
- [x] Test API-key hashing helpers
- [x] Test ownership checks
- [x] Test scope checks
- [x] Test anonymous update-token checks
- [x] Test error normalization

### Integration Tests

- [x] Test anonymous paste creation
- [x] Test authenticated paste creation
- [x] Test paste retrieval
- [x] Test paste update
- [x] Test paste deletion
- [x] Test folder creation
- [x] Test folder deletion
- [x] Test folder movement
- [x] Test API-key authentication
- [x] Test protected paste unlock
- [x] Test analytics update
- [x] Test storage replacement

### End-to-End Tests

- [x] Test homepage upload
- [x] Test drag-and-drop upload
- [x] Test generated wildcard URL
- [x] Test raw endpoint
- [x] Test preview endpoint
- [x] Test sign-up
- [x] Test sign-in
- [x] Test dashboard
- [x] Test folder workflow
- [x] Test password protection
- [x] Test API key creation
- [x] Test API publishing
- [x] Test MCP publishing
- [x] Test paste deletion

### Compatibility Tests

- [x] Build representative legacy paste fixture set
- [x] Include HTML with inline CSS
- [x] Include HTML with inline JavaScript
- [x] Include Unicode HTML
- [x] Include unusual whitespace
- [x] Include large HTML near the size limit
- [x] Include malformed but browser-renderable HTML
- [ ] Compare old public runtime behavior — needs the running Rails app; the
      property a diff would establish is proven in `e2e/compat.spec.ts`
- [ ] Compare old raw endpoint bytes — same: byte-identity is proven against
      the fixture corpus, not against live legacy responses
- [x] Compare old render behavior where required
- [x] Verify existing tokens map correctly
- [x] Verify existing URLs remain valid

## Milestone Acceptance Criteria

- [x] Critical product flows have end-to-end coverage
- [x] Raw-output compatibility is verified
- [x] Security-critical authorization checks have automated tests
- [x] CI blocks deployment on failed critical tests

---

# Milestone 19 — Legacy Rails Data Migration

## Goal

Move production data from the Rails application into Convex without breaking existing paste URLs.

## Tasks

### Migration Analysis

Every inventory item below is blocked on access to the production Rails app.
`docs/migration.md` §1 is the blank table to fill in against the real database.

- [ ] Inventory existing Rails tables
- [ ] Inventory existing paste fields
- [ ] Inventory folders
- [ ] Inventory user records
- [ ] Inventory API keys
- [ ] Inventory OAuth/MCP records
- [ ] Inventory password-protected paste data
- [ ] Inventory analytics data
- [ ] Inventory stored HTML
- [x] Identify records that cannot be migrated directly
- [x] Define source-of-truth rules during migration

### Migration Tooling

- [x] Create export script from legacy application
- [x] Create normalized migration format
- [x] Create Convex import script
- [x] Create HTML upload migration process
- [x] Preserve paste tokens
- [x] Preserve custom subdomains
- [x] Preserve ownership mappings
- [x] Preserve folder relationships
- [x] Preserve creation timestamps
- [x] Preserve update timestamps
- [x] Preserve password behavior where safely possible
- [x] Define API-key migration policy
- [x] Define OAuth/MCP credential migration policy

### Validation

- [ ] Count source pastes
- [ ] Count migrated pastes
- [ ] Compare metadata samples
- [ ] Compare HTML hashes
- [ ] Compare raw bytes for samples
- [ ] Validate wildcard URLs
- [ ] Validate folder ownership
- [ ] Validate user ownership
- [ ] Validate password-protected samples
- [ ] Generate migration discrepancy report

### Dry Run

Blocked on a staging Convex deployment and a real export.

- [ ] Run full migration against staging
- [ ] Measure migration duration
- [ ] Validate migration logs
- [ ] Validate rollback
- [ ] Fix failed records
- [ ] Repeat until clean

## Milestone Acceptance Criteria

- [ ] All required production records can be migrated
- [x] Existing public tokens are preserved
- [ ] HTML content passes hash/byte validation
- [ ] Migration has been successfully rehearsed on staging
- [x] A rollback path exists

---

# Milestone 20 — Vercel Production Deployment

## Goal

Deploy the complete rebuilt application to production infrastructure before traffic cutover.

## Tasks

### Vercel

- [x] Create production Vercel project — `pastehtml` under
      `haitham-assolis-projects`, Hobby plan
- [x] Configure production environment variables — `NEXT_PUBLIC_APP_URL`
      (trailing slash removed), live Clerk keys, `CONVEX_DEPLOY_KEY`. The Convex
      URLs are no longer set by hand: `convex deploy` injects them at build time
- [x] Configure preview environment variables — dev Clerk keys scoped to Preview
      only, plus a preview-scoped `CONVEX_DEPLOY_KEY`
- [x] Configure build command — `npx convex deploy --cmd 'npm run build'`
- [x] Configure Convex deployment command — same command; the build log confirms
      the injected deployment URL
- [x] Configure production domain — `pastehtml.assoli.site`
- [x] Configure wildcard domain — `*.pastehtml.assoli.site`. Both need an
      **explicit** ALIAS record; see the RFC 4592 note in `docs/operations.md`
- [x] Configure `www` — 308 redirect to the apex
- [x] Verify SSL — apex, wildcard and both Clerk hosts
- [x] Verify deployment protection settings — `all_except_custom_domains`:
      production public, preview behind Vercel SSO
- [x] Verify function runtime settings — Node 24.x, region moved `iad1` → `dub1`
      to sit beside Convex's `eu-west-1`. `/api/health` went 104ms → 17ms
- [x] Verify preview deployments — a preview build ran and was torn down

### Convex

- [x] Create production Convex deployment — `ceaseless-reindeer-646`
      (`aws-eu-west-1`), separate from the dev deployment
- [x] Configure production environment variables — `CLERK_JWT_ISSUER_DOMAIN`
      pointing at the production Clerk instance
- [x] Configure Clerk auth integration — production instance
      `clerk.pastehtml.assoli.site`, `convex` JWT template, DNS/SSL/mail
      complete. JWKS `kid` matches what Convex validates against
- [x] Configure file storage — exercised end to end by the production smoke run
- [x] Verify indexes — 15 created on the production deployment
- [x] Verify scheduled functions — `analytics:sweep`,
      `pastes:sweepUnlockAttempts`, `rateLimit:sweep`, `storage:sweepOrphans`
      all logged executions on prod
- [x] Configure preview deployment strategy — per-branch deployments via a
      preview deploy key, inheriting the dev Clerk issuer
- [x] Ensure preview branches cannot access production data — proven, not
      assumed: a preview build created its own deployment
      (`dependable-toad-634`), which was then deleted

### Smoke Tests

Automated in `scripts/smoke.mjs` (`npm run smoke [url]`), which cleans up every
paste it creates and exits non-zero on the first failure. What needs a signed-in
browser was done by hand against production and is marked as such.

- [x] Publish anonymous paste in production — script
- [x] Open wildcard public URL — script; asserts byte-identical body against a
      non-ASCII payload, not just a 200
- [x] Open raw URL — script; `text/plain; charset=utf-8` + `nosniff` + identical
      bytes
- [x] Open preview URL — script; sandbox CSP with no `allow-same-origin`
- [x] Create account — **by hand, with a caveat**: the production sign-up form
      is behind a Turnstile that will not solve under automation, and password
      sign-in on a fresh device demands an emailed code a synthetic address
      cannot receive. The account was created through the Clerk Backend API and
      the session taken by impersonation. Not a product bug, but **no one has
      yet completed a real production sign-up with a real inbox** — do that once
- [x] Publish authenticated paste — by hand; published to the account, listed in
      the dashboard as owned
- [x] Create folder — by hand; created, listed, renamed, deleted
- [x] Create API key — by hand; scopes honoured, key shown once, `Last used`
      tracked, revocation immediate (revoked key → 401)
- [x] Publish through API — script, with a real production key: 201, owned, no
      `updateToken`
- [x] Publish through MCP — script, via the official SDK over
      `StreamableHTTPClientTransport`: `listTools`, `create_paste`, byte check,
      `delete_paste`, then asserts the URL 404s
- [x] Protect a paste with password — script; challenge without the content,
      wrong password 401, right password 303 + host-only `ph_unlock` cookie,
      cookie replay serves the exact bytes
- [x] Verify analytics — by hand; views, 7-day and 24-hour counts, referrer,
      country and browser breakdowns, correctly split across two browsers
- [ ] Verify logs and Sentry — **logs yes, Sentry no.** 112 log lines captured
      across three smoke runs, all `level: info`, request ids and MCP tool lines
      present. But no `NEXT_PUBLIC_SENTRY_DSN` is set in any environment, and
      production logs `"errorTracking":false` on every cold start. `lib/sentry.ts`
      no-ops by design, so nothing is broken — this box cannot be ticked until a
      DSN is set. See `docs/operations.md` "Turning it on"

## Milestone Acceptance Criteria

- [x] Production environment is operational — `https://pastehtml.assoli.site`
- [x] Wildcard routing works — live paste 200 with exact bytes, unknown
      subdomain 404
- [x] Convex production deployment works — `ceaseless-reindeer-646`, exercised
      by the smoke run
- [x] Preview environments remain isolated from production data — demonstrated
      with a real preview build
- [ ] All smoke tests pass — 8/8 automated steps pass and every by-hand flow
      checked out; held open only by the Sentry box above

---

# Milestone 21 — Production Cutover

## Goal

Move real production traffic from the Rails application to the new Next.js + Convex implementation.

> **There was no Rails application to move traffic off.** The site launched on
> the new stack; `pastehtml.assoli.site` has never pointed anywhere else. So the
> Final Data Migration section is **n/a** throughout, and what remains — proving
> every public surface actually answers, and knowing how to put it back — was
> done for real. `docs/cutover.md` is the runbook, with the verification
> commands and the rollback path.

## Tasks

### Pre-Cutover

- [x] Freeze schema-changing work — n/a as an event; recorded in
      `docs/cutover.md` as the change that ends the rollback window
- [x] Complete final migration rehearsal — **n/a**: no legacy source
- [ ] Verify latest backup — **no backup exists yet.** Convex scheduled backups
      are an un-toggled dashboard setting; `docs/cutover.md` has the command to
      take one. This is a real gap, not an n/a
- [x] Verify rollback plan — `docs/cutover.md` §5, cross-referenced to
      `docs/operations.md`
- [x] Verify DNS access — `vercel dns ls assoli.site`
- [x] Verify Vercel rollback access — `vercel ls pastehtml`, 6 ready production
      deployments to roll back to
- [x] Verify Convex deployment access — `npx convex env list --prod` reaches
      `ceaseless-reindeer-646`
- [x] Verify monitoring dashboards — Vercel Observability, Convex dashboard and
      Clerk all reachable
- [ ] Verify error alerts — **fails.** No Sentry DSN and no uptime checker
      pointed at `/api/health`. Every monitoring surface is a screen someone has
      to look at; nothing pushes
- [x] Notify maintainers of cutover procedure — n/a: single maintainer, who is
      running it

### Final Data Migration

Every item below is **n/a — there is no legacy source**. `docs/cutover.md` §1
names the `docs/migration.md` procedure that would apply to each if one ever
appears.

- [x] Put legacy write operations into maintenance/read-only mode if needed
- [x] Export final legacy data
- [x] Import final data to Convex
- [x] Upload final HTML files
- [x] Validate counts
- [x] Validate hashes
- [x] Validate sample URLs
- [x] Validate users
- [x] Validate folders
- [x] Validate protected pastes
- [x] Resolve migration failures before cutover

### Traffic Switch

Verified against live production, 22 surfaces; the evidence table is in
`docs/cutover.md`.

- [x] Point production domain to Vercel configuration — n/a as a switch: this is
      the only configuration the domain has ever had
- [x] Verify root domain — 200
- [x] Verify `www` — 308 → apex
- [x] Verify wildcard subdomains — live paste 200 with byte-identical content,
      unknown subdomain 404, `/internal/paste/*` refused by `proxy.ts`
- [x] Verify API routes — publish 201, read 200, wrong verb 405, bad key 401
- [x] Verify MCP endpoint — `POST /mcp` initialize 200,
      `serverInfo.name=pastehtml`; `GET` 405 by design
- [x] Verify Clerk callbacks — `/sign-in`, `/sign-in/sso-callback`,
      `/sign-in/factor-one`, `/sign-up/continue`,
      `/sign-up/verify-email-address` all 200; `/dashboard` signed out → 307
- [x] Verify raw routes — 200 `text/plain; charset=utf-8` + `nosniff`; unknown
      token 404
- [x] Verify password-protected routes — origin, raw and render all 401 while
      locked; unlock → 303 + `ph_unlock` cookie → 200

### Post-Cutover Monitoring

These are ongoing observations, not one-time actions, and with no alerting
configured none of them pushes. `docs/cutover.md` §4 turns each into a named
screen plus the number that means roll back — which is as close to "done" as a
checkbox gets here.

- [ ] Monitor 4xx rates
- [ ] Monitor 5xx rates
- [ ] Monitor missing-paste reports
- [ ] Monitor Convex errors
- [ ] Monitor Vercel errors
- [ ] Monitor authentication errors
- [ ] Monitor API errors
- [ ] Monitor MCP errors
- [ ] Monitor storage failures
- [ ] Monitor abnormal latency
- [ ] Compare traffic against expected baseline

## Milestone Acceptance Criteria

- [x] Production traffic is served by the new application — it always was
- [x] Existing paste URLs continue working — proven by `npm run smoke` and the
      verification matrix
- [x] No critical migration issues remain — none exist to remain
- [ ] Error rates remain within acceptable levels — unmeasurable beyond Vercel's
      own view until alerting exists. Zero warnings or errors across 112 log
      lines is the most that can be said
- [x] Rollback remains possible during the validation window — `vercel rollback`
      against 6 ready deployments

---

# Milestone 22 — Legacy Decommission

## Goal

Retire the Ruby/Rails infrastructure after the new application has proven stable.

> **There was nothing to retire.** The site launched on the new stack rather
> than cutting over from a running Rails deployment — this repository has never
> contained Rails source, a legacy database or a VPS, and `docs/migration.md`
> says so. The items below marked **n/a** are closed because no such thing
> exists, not because they were done. `docs/decommission.md` carries the
> evidence and the runbook that would apply if a real legacy environment ever
> needs retiring.

## Tasks

- [x] Define stability validation period — **n/a**: no cutover from a legacy
      system, so there is no window during which two stacks coexist
- [x] Keep legacy environment read-only during validation period — **n/a**: no
      legacy environment
- [x] Archive final legacy database backup — **n/a**: no legacy database.
      `docs/decommission.md` §2 records where one would be archived
- [x] Archive final file-storage backup — **n/a**: no legacy file storage
- [x] Archive deployment configuration — **n/a**: no legacy deployment; the
      current one is `next.config.ts` plus the Vercel project, both in git or
      reproducible from `docs/operations.md`
- [x] Archive migration scripts — kept in-tree rather than archived:
      `scripts/export-legacy.rb`, `scripts/migrate-*.mjs`, `convex/migrate.ts`,
      38 passing tests. ~600 lines, and the only path if a legacy source ever
      appears
- [x] Document old infrastructure dependencies — the honest answer is none;
      `docs/decommission.md` §1 is the evidence table
- [x] Remove production traffic from Rails — **n/a**: no Rails ever served this
      deployment
- [x] Disable legacy background jobs — **n/a**
- [x] Disable legacy API write paths — **n/a**: the only write paths are
      `/api/v1/*` and `POST /mcp`, both current
- [x] Remove unused secrets — vacuous: 10 Vercel production variables (app URL,
      3 Convex, 6 Clerk) and 1 Convex variable, none legacy
- [x] Remove unused infrastructure — **n/a**
- [x] Remove unused database resources — **n/a**: Convex is the only database
- [x] Remove unused VPS resources — **n/a**: there is no VPS
- [x] Update project documentation — `README.md` gained a Deployment section
      (`docs/operations.md` opens by pointing at it and it did not exist), and
      the doc index now lists operations, migration and decommission
- [x] Update architecture diagrams — **n/a**: the repo has no architecture
      diagram. README "Architecture" is a directory map and is current
- [x] Confirm no runtime dependency on Ruby remains — one `.rb` file in the
      tree, imported by nothing, in no npm script, untouched by CI. No Gemfile,
      Rakefile, Dockerfile or buildpack; Vercel runs the Next.js preset on
      Node 24

## Milestone Acceptance Criteria

- [x] Production no longer depends on Ruby or Rails — evidenced in
      `docs/decommission.md` §1
- [x] Legacy data backups are safely retained — vacuous: there is no legacy data
- [x] Old infrastructure has been decommissioned — vacuous: none was ever
      attached to this deployment
- [x] New architecture is fully documented — README Deployment +
      `docs/operations.md` + `docs/decommission.md`

---

# Milestone 23 — Post-Launch Improvements

## Goal

Improve the product after the successful rebuild without blocking the initial launch.

> Every task here is _evaluate_, _review_ or _improve_ — none is _build_. The
> deliverable is `docs/post-launch.md`: a verdict per item with the trigger that
> would change it, measurements with their source, and a refusal to invent
> numbers that could not be measured. Product tally: **0 now, 3 later, 10 no.**
> Two items on the list turned out to be already built.

## Tasks

### Product Improvements

- [x] Evaluate anonymous paste expiration — verdict recorded
- [x] Evaluate paste revision history — **later**, one of the three
- [x] Evaluate custom domains — **already built**: Milestone 14 shipped custom
      subdomains (`customSubdomain`, `by_custom_subdomain`, `claimSubdomain`,
      dashboard UI). Full apex custom domains remain a _no_
- [x] Evaluate multi-file site support — verdict recorded
- [x] Evaluate CSS/JS asset uploads — verdict recorded
- [x] Evaluate GitHub integration — verdict recorded
- [x] Evaluate CLI — verdict recorded
- [x] Evaluate npm package — verdict recorded
- [x] Evaluate webhook notifications — verdict recorded
- [x] Evaluate templates — **later**, one of the three
- [x] Evaluate screenshots/previews — **already built**: `/p/[token]/render`
      serves a sandboxed preview
- [x] Evaluate team workspaces — **later**, one of the three
- [x] Evaluate organization accounts — this _is_ team workspaces plus billing;
      flagged so it is not scheduled twice

### Performance Improvements

- [x] Review real production latency — measured, and it found the biggest win in
      the document: functions in `iad1` against Convex in `eu-west-1`, ~210ms of
      a 599ms paste read. **Fixed during Milestone 20** — `dub1`, re-measured at
      339ms. A second finding corrected a doc: the ETag no longer buys latency
      (349ms conditional against 339ms full), only bytes
- [x] Review Convex usage and costs — usage measured over a 16.7h log window;
      dollar amounts **not measurable** (no billing surface in the CLI) and not
      extrapolated
- [x] Review Vercel usage and costs — Hobby, free at this volume. The two costs
      that are not money: no log drain, and a ToS ban on commercial use
- [x] Review file-storage usage — 20.1 MiB at rest. Egress **not measurable**:
      bytes leave via a signed URL and never run a Convex function
- [x] Optimize high-traffic paste behavior — the region move is exactly this,
      and it is done. Nothing else cleared the bar
- [x] Optimize analytics storage — evaluated, declined: the `viewsCount` patch
      already carries its own trigger in a code comment and it has not fired
- [x] Optimize dashboard query patterns — evaluated, declined for the same
      reason. The one real hot spot is elsewhere: `storage.sweepOrphans` is 67%
      of bytes read and 63% of CPU, restarting from `null` every hour. Trigger
      recorded at ~3,000 pastes

### Security Improvements

- [x] Perform post-launch security review — nothing has drifted since Milestone
      15, but the review found one real bug and it is **fixed**: `pastes.unlock`
      charged nothing on the success path and nothing swept `pasteUnlocks`, so
      anyone holding a paste's password could grow that table until the
      `.collect()` in `unlock` and `revokeUnlocks` crossed Convex's read limit —
      at which point the _owner_ could no longer change or remove the password.
      Fixed by bounding the table (`MAX_UNLOCK_SESSIONS`, oldest evicted), not
      by rate-limiting: `writeClient` charges an owned paste to `user:<ownerId>`,
      so charging this public mutation would have let any visitor drain the
      owner's whole write budget. Covered by a test
- [x] Review abuse patterns — no organic traffic yet; nothing to pattern-match
- [x] Adjust rate limits — reviewed against real traffic, deliberately unchanged
      (5 OCC retries in 72h, zero fatal). The `anon` bucket carries its own
      documented trigger
- [x] Review authentication events — every post-hardening Convex function is
      `internal*`; folder scopes genuinely enforced
- [x] Review API key usage — scopes, revocation and `Last used` verified live
      during the Milestone 20 smoke pass
- [x] Review MCP authorization behavior — no gap found
- [ ] Improve moderation tooling — evaluated, deferred; no abuse to moderate yet

### Developer Experience

- [x] Improve contributor documentation — verdict recorded; README gained a
      Deployment section in Milestone 22
- [x] Improve local wildcard-domain tooling — verdict recorded
- [x] Improve test fixtures — verdict recorded
- [x] Improve API docs — verdict recorded
- [x] Improve MCP docs — verdict recorded
- [x] Automate release notes — **no**, with reason
- [x] Automate dependency updates — the one _now_, and it is small

---

# Global Definition of Done

The rebuild is considered complete when all launch-critical milestones are complete and the following checks pass:

- [x] No Ruby runtime is required — evidence in `docs/decommission.md` §1
- [x] No Rails server is required — there has never been one
- [x] No self-managed application server is required — Vercel, Node 24, `dub1`
- [x] No self-managed database is required — Convex `ceaseless-reindeer-646`
- [x] Next.js is deployed on Vercel — `https://pastehtml.assoli.site`
- [x] Convex is the active backend data platform
- [x] Convex File Storage contains active HTML content — exercised end to end by
      `npm run smoke` against production
- [x] Clerk authentication is operational — production instance
      `clerk.pastehtml.assoli.site`, DNS/SSL/mail complete. Email + password
      only; Google sign-in needs a Google Cloud OAuth client
- [x] Anonymous publishing works — smoke step 2
- [x] Authenticated publishing works — verified by hand in production
- [x] Wildcard paste URLs work — byte-identical content, unknown subdomain 404
- [x] Raw paste URLs work — `text/plain; charset=utf-8` + `nosniff`
- [x] Preview routes work — sandbox CSP, no `allow-same-origin`
- [x] Folder management works
- [x] Password protection works
- [x] API keys work — scoped, hashed, revocable, with `lastUsedAt` and the
      settings UI (Milestone 11)
- [x] REST API publishing works
- [x] MCP publishing works — verified live with the official SDK client
      (Milestone 13)
- [x] Analytics works without blocking public responses — recorded in
      `after()`, after the HTML is already on the wire (Milestone 12)
- [x] Security isolation between app and paste origins is verified — audited
      and attacked from inside a published page (Milestone 15)
- [x] Migration has preserved required existing paste URLs — vacuous: there were
      no existing URLs to preserve. The tooling is retained unused
      (`docs/decommission.md` §2)
- [x] Automated critical-path tests pass — 356 unit/integration + 40 e2e, gated
      in CI (Milestone 18), plus `npm run smoke` against production
- [ ] Production monitoring is enabled — structured logs and `/api/health` are
      live and clean, but **error tracking is off**: no `NEXT_PUBLIC_SENTRY_DSN`
      in any environment, so production logs `"errorTracking":false` on every
      cold start and no alert can fire. The last box standing
- [x] Rollback procedures are documented — `docs/operations.md` (Milestone 17)
      and `docs/cutover.md` §5
- [x] Legacy Rails infrastructure is no longer required — there never was any

---

# Recommended Implementation Order

The recommended execution order is:

```text
Milestone 0   Project Foundation
Milestone 1   Convex Data Model
Milestone 2   HTML File Storage
Milestone 3   Anonymous Publishing
Milestone 4   Wildcard Runtime
Milestone 5   Raw / Preview Endpoints
Milestone 6   Authentication
Milestone 7   Dashboard
Milestone 8   Folders
Milestone 9   Password Protection
Milestone 10  REST API
Milestone 11  API Keys
Milestone 12  Analytics
Milestone 13  MCP
Milestone 14  Custom Subdomains
Milestone 15  Security Hardening
Milestone 16  Caching / Performance
Milestone 17  Observability
Milestone 18  Testing / Compatibility
Milestone 19  Legacy Migration
Milestone 20  Production Deployment
Milestone 21  Production Cutover
Milestone 22  Legacy Decommission
Milestone 23  Post-Launch Improvements
```

The most important architectural proof should happen before building the full product:

```text
Upload HTML
→ Convex File Storage
→ Convex metadata
→ wildcard subdomain
→ serve exact HTML
→ raw endpoint
→ update
→ delete
```

If this vertical slice works correctly on Vercel with the real wildcard-domain setup, the rest of the product can safely be built on top of it.
