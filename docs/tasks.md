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
- [x] ~~Add CSRF protections where required~~ — same reason. Milestone 15
      re-audits this with the full header and CSP pass, and Milestone 10 must
      re-check it when the REST API lands.
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

- [ ] Define API versioning strategy
- [ ] Define standard JSON success format
- [ ] Define standard JSON error format
- [ ] Define API error codes
- [ ] Add request IDs
- [ ] Add API rate limiting
- [ ] Add API logging without storing secrets or HTML payloads unnecessarily

### Create Paste

- [ ] Implement `POST /api/pastes`
- [ ] Accept raw `text/html`
- [ ] Validate request size
- [ ] Upload HTML to Convex File Storage
- [ ] Create paste metadata
- [ ] Support anonymous creation
- [ ] Support authenticated creation
- [ ] Support API-key creation
- [ ] Return public URL
- [ ] Return raw URL
- [ ] Return anonymous update token when applicable

### Retrieve Paste Metadata

- [ ] Implement `GET /api/pastes/[token]`
- [ ] Return public metadata
- [ ] Return owner-only metadata when authorized

### Update Paste

- [ ] Implement `PATCH /api/pastes/[token]`
- [ ] Support owner authentication
- [ ] Support API-key authentication
- [ ] Support anonymous update token
- [ ] Support content replacement
- [ ] Support title update
- [ ] Support folder update where applicable
- [ ] Support password settings only when appropriately authorized

### Delete Paste

- [ ] Implement `DELETE /api/pastes/[token]`
- [ ] Support owner authentication
- [ ] Support API-key authentication
- [ ] Support anonymous update token
- [ ] Remove public availability immediately
- [ ] Trigger storage cleanup

### Documentation

- [ ] Document `curl` publishing
- [ ] Document API authentication
- [ ] Document create request
- [ ] Document update request
- [ ] Document delete request
- [ ] Document error codes
- [ ] Document rate limits
- [ ] Add API examples to the home page

## Milestone Acceptance Criteria

- [ ] HTML can be published with a single API request
- [ ] Anonymous and authenticated API flows work
- [ ] API errors are consistent
- [ ] Existing important API behavior is preserved where practical

---

# Milestone 11 — API Keys

## Goal

Allow authenticated users to create scoped credentials for automation.

## Tasks

### API Key Backend

- [ ] Implement cryptographically secure API-key generation
- [ ] Define API-key prefix format
- [ ] Hash API keys before persistence
- [ ] Show raw key only once
- [ ] Implement API-key lookup
- [ ] Implement key verification
- [ ] Implement scope verification
- [ ] Implement expiration
- [ ] Implement revocation
- [ ] Implement `lastUsedAt`
- [ ] Prevent revoked-key reuse
- [ ] Prevent expired-key reuse

### API Key UI

- [ ] Create API Keys settings page
- [ ] Add create-key dialog
- [ ] Add name field
- [ ] Add scope selection
- [ ] Add optional expiration
- [ ] Show raw secret once after creation
- [ ] Add copy-key action
- [ ] Add key list
- [ ] Show key prefix
- [ ] Show creation date
- [ ] Show last-used date
- [ ] Show expiration state
- [ ] Add revoke action

### Tests

- [ ] Test valid key
- [ ] Test invalid key
- [ ] Test revoked key
- [ ] Test expired key
- [ ] Test scope restrictions
- [ ] Test cross-user access prevention

## Milestone Acceptance Criteria

- [ ] Users can create and revoke API keys
- [ ] Raw secrets are never persisted
- [ ] API scopes are enforced
- [ ] API key usage is visible in the dashboard

---

# Milestone 12 — Analytics

## Goal

Provide lightweight paste analytics without slowing down public page delivery.

## Tasks

### Analytics Model

- [ ] Finalize analytics fields
- [ ] Decide analytics retention period
- [ ] Decide whether approximate country is required
- [ ] Decide whether referrer is required
- [ ] Decide whether user-agent family is required
- [ ] Avoid storing unnecessary personal data

### Collection

- [ ] Implement non-blocking view recording
- [ ] Increment paste view count
- [ ] Record timestamp
- [ ] Record optional referrer
- [ ] Record optional country
- [ ] Record optional user-agent family
- [ ] Add abuse filtering if required
- [ ] Exclude internal preview requests if appropriate
- [ ] Exclude known bots if product policy requires it

### Aggregation

- [ ] Implement total views
- [ ] Implement recent views
- [ ] Implement views by day
- [ ] Implement top referrers if enabled
- [ ] Implement country summary if enabled
- [ ] Optimize high-traffic aggregation strategy

### UI

- [ ] Add analytics summary to paste details
- [ ] Add view-count card
- [ ] Add recent activity visualization if needed
- [ ] Add referrer table if enabled
- [ ] Add country table if enabled
- [ ] Add realtime total view count

## Milestone Acceptance Criteria

- [ ] Public paste serving does not wait on analytics writes
- [ ] View totals update correctly
- [ ] Analytics UI is available to authorized owners
- [ ] Analytics collection follows the chosen privacy policy

---

# Milestone 13 — MCP Server

## Goal

Allow AI agents and MCP clients to publish and manage pastes using the current MCP specification.

## Tasks

### MCP Foundation

- [ ] Verify the current MCP specification before implementation
- [ ] Install and configure the official MCP TypeScript SDK
- [ ] Create `/mcp` route
- [ ] Define MCP transport
- [ ] Define authentication requirements
- [ ] Implement MCP-compatible error handling
- [ ] Add MCP request logging without leaking content or credentials

### Tools

- [ ] Implement `create_paste`
- [ ] Implement `get_paste`
- [ ] Implement `update_paste`
- [ ] Implement `delete_paste`
- [ ] Implement `list_pastes`
- [ ] Define input schemas for each tool
- [ ] Define output schemas for each tool
- [ ] Reuse core paste domain functions
- [ ] Reuse core authorization logic

### Authentication

- [ ] Decide launch MCP authorization model
- [ ] Implement authorization flow
- [ ] Support current MCP client registration requirements
- [ ] Support current MCP metadata/discovery requirements
- [ ] Add token validation
- [ ] Add scope validation
- [ ] Add token revocation strategy

### Agent Experience

- [ ] Return public URL directly from `create_paste`
- [ ] Return raw URL directly from `create_paste`
- [ ] Provide clear tool descriptions
- [ ] Provide predictable machine-readable errors
- [ ] Document MCP setup
- [ ] Test with at least one production-grade MCP client

## Milestone Acceptance Criteria

- [ ] An MCP client can create a paste
- [ ] The tool returns a working public URL
- [ ] Authenticated MCP clients can manage authorized pastes
- [ ] MCP follows the current specification at launch

---

# Milestone 14 — Custom Subdomains

## Goal

Support user-selected subdomains such as `my-demo.pastehtml.assoli.site` in addition to generated paste tokens.

## Tasks

- [ ] Finalize whether custom subdomains are included in v1
- [ ] Define minimum length
- [ ] Define maximum length
- [ ] Define valid character rules
- [ ] Normalize to lowercase
- [ ] Reject invalid DNS labels
- [ ] Create reserved-subdomain list
- [ ] Validate uniqueness
- [ ] Implement custom-subdomain lookup
- [ ] Implement custom-subdomain assignment
- [ ] Implement custom-subdomain removal
- [ ] Implement custom-subdomain change
- [ ] Restrict custom-subdomain changes to authorized owners
- [ ] Prevent race conditions when assigning subdomains
- [ ] Add UI for custom subdomain selection
- [ ] Add availability indicator
- [ ] Add tests for reserved names
- [ ] Add tests for duplicates
- [ ] Add tests for invalid characters
- [ ] Add tests for routing

## Milestone Acceptance Criteria

- [ ] Authorized users can assign an available custom subdomain
- [ ] Reserved and invalid names are rejected
- [ ] Custom subdomains route to the correct paste
- [ ] Duplicate assignment is impossible

---

# Milestone 15 — Security Hardening and Abuse Prevention

## Goal

Harden the product before migration and public launch.

## Tasks

### Cookie and Origin Security

- [ ] Audit all cookies
- [ ] Verify no auth cookie is available to wildcard paste origins
- [ ] Audit SameSite settings
- [ ] Audit Secure flags
- [ ] Audit HttpOnly flags
- [ ] Add Origin validation to sensitive endpoints
- [ ] Add CSRF protection where necessary

### XSS and HTML Isolation

- [ ] Audit dashboard rendering of paste metadata
- [ ] Escape user-controlled titles
- [ ] Escape user-controlled filenames
- [ ] Never inject raw paste HTML into privileged app DOM
- [ ] Audit preview sandbox
- [ ] Audit Content Security Policy

### Rate Limiting

- [ ] Rate limit anonymous paste creation
- [ ] Rate limit password attempts
- [ ] Rate limit API-key requests
- [ ] Rate limit MCP requests
- [ ] Rate limit paste updates
- [ ] Rate limit destructive operations
- [ ] Define rate-limit response format

### Abuse Controls

- [ ] Add paste-disable internal function
- [ ] Add paste-delete administrative function
- [ ] Add simple internal moderation workflow
- [ ] Add abuse-report intake mechanism
- [ ] Add operational metadata required for abuse investigation
- [ ] Avoid unnecessary sensitive-data retention
- [ ] Add configurable blocked identifiers if needed

### Headers

- [ ] Configure dashboard CSP
- [ ] Configure `X-Content-Type-Options`
- [ ] Configure referrer policy
- [ ] Configure frame policy where relevant
- [ ] Configure permissions policy
- [ ] Audit CORS behavior
- [ ] Audit cache headers on private content

### Secrets

- [ ] Audit Vercel environment secrets
- [ ] Audit Convex environment secrets
- [ ] Verify no secret is exposed with `NEXT_PUBLIC_`
- [ ] Add secret rotation procedure
- [ ] Ensure logs redact credentials

### Security Testing

- [ ] Test subdomain cookie isolation
- [ ] Test CSRF defenses
- [ ] Test IDOR scenarios
- [ ] Test cross-user paste access
- [ ] Test cross-user folder access
- [ ] Test API-key scope bypass attempts
- [ ] Test anonymous update-token guessing resistance
- [ ] Test password brute-force controls
- [ ] Test hostile HTML payloads
- [ ] Test malformed host headers

## Milestone Acceptance Criteria

- [ ] Critical security review findings are resolved
- [ ] Auth cookies remain isolated from wildcard content
- [ ] Sensitive operations have rate limits
- [ ] Privileged application pages never execute uploaded HTML
- [ ] Abuse controls exist for administrators

---

# Milestone 16 — Caching and Performance

## Goal

Make paste delivery fast globally while preserving correct behavior for updates and deletions.

## Tasks

### Runtime Performance

- [ ] Measure baseline paste request latency
- [ ] Ensure paste lookup uses indexed Convex queries
- [ ] Avoid unnecessary React rendering in runtime route
- [ ] Minimize runtime dependencies
- [ ] Avoid blocking analytics writes
- [ ] Avoid unnecessary file transformations

### HTTP Caching

- [ ] Define cache policy for public paste runtime
- [ ] Define cache policy for raw endpoint
- [ ] Define cache policy for preview endpoint
- [ ] Define cache policy for metadata page
- [ ] Define cache policy for dashboard routes
- [ ] Implement ETags
- [ ] Implement `If-None-Match`
- [ ] Return `304 Not Modified` when appropriate
- [ ] Ensure deleted content does not remain cached too long
- [ ] Ensure updated content invalidates or bypasses stale cache

### Content Hashing

- [ ] Generate content hash when uploading HTML
- [ ] Store content hash in paste metadata
- [ ] Recalculate hash on replacement
- [ ] Use content hash for ETag where appropriate

### Load Testing

- [ ] Create load-test scenario for public paste reads
- [ ] Create load-test scenario for anonymous creation
- [ ] Create load-test scenario for API publishing
- [ ] Create load-test scenario for high-view-count paste
- [ ] Verify analytics does not become a bottleneck
- [ ] Review Convex usage patterns under load
- [ ] Review Vercel function behavior under load

## Milestone Acceptance Criteria

- [ ] Typical paste requests avoid unnecessary backend work
- [ ] Conditional requests work
- [ ] Updated pastes become visible within the chosen cache policy
- [ ] High-traffic pastes do not block on analytics processing

---

# Milestone 17 — Observability and Operational Tooling

## Goal

Make production issues diagnosable before migrating real traffic.

## Tasks

### Logging

- [ ] Add structured server logs
- [ ] Add request IDs
- [ ] Add correlation IDs across Next.js and Convex where practical
- [ ] Log paste operation type without logging full HTML
- [ ] Redact API keys
- [ ] Redact update tokens
- [ ] Redact authentication tokens
- [ ] Redact passwords

### Error Tracking

- [ ] Configure Sentry or equivalent
- [ ] Add Next.js error tracking
- [ ] Add client-side error tracking
- [ ] Add release/environment labels
- [ ] Add source maps
- [ ] Verify sensitive data is scrubbed

### Monitoring

- [ ] Define critical production health checks
- [ ] Monitor failed paste creates
- [ ] Monitor runtime 5xx rate
- [ ] Monitor API error rate
- [ ] Monitor MCP error rate
- [ ] Monitor Convex function errors
- [ ] Monitor storage errors
- [ ] Monitor auth failures
- [ ] Monitor abnormal rate-limit spikes

### Operational Documentation

- [ ] Create incident-response notes
- [ ] Create rollback runbook
- [ ] Create migration rollback runbook
- [ ] Document Convex deployment recovery
- [ ] Document Vercel deployment rollback
- [ ] Document domain/DNS recovery steps

## Milestone Acceptance Criteria

- [ ] Production errors are visible and diagnosable
- [ ] Credentials are not leaked through logs
- [ ] Rollback instructions exist
- [ ] Core product health can be monitored

---

# Milestone 18 — Automated Testing and Compatibility Suite

## Goal

Build enough automated coverage to safely replace the existing Rails application.

## Tasks

### Unit Tests

- [ ] Test token generation
- [ ] Test custom-subdomain validation
- [ ] Test reserved-subdomain validation
- [ ] Test password hashing helpers
- [ ] Test API-key hashing helpers
- [ ] Test ownership checks
- [ ] Test scope checks
- [ ] Test anonymous update-token checks
- [ ] Test error normalization

### Integration Tests

- [ ] Test anonymous paste creation
- [ ] Test authenticated paste creation
- [ ] Test paste retrieval
- [ ] Test paste update
- [ ] Test paste deletion
- [ ] Test folder creation
- [ ] Test folder deletion
- [ ] Test folder movement
- [ ] Test API-key authentication
- [ ] Test protected paste unlock
- [ ] Test analytics update
- [ ] Test storage replacement

### End-to-End Tests

- [ ] Test homepage upload
- [ ] Test drag-and-drop upload
- [ ] Test generated wildcard URL
- [ ] Test raw endpoint
- [ ] Test preview endpoint
- [ ] Test sign-up
- [ ] Test sign-in
- [ ] Test dashboard
- [ ] Test folder workflow
- [ ] Test password protection
- [ ] Test API key creation
- [ ] Test API publishing
- [ ] Test MCP publishing
- [ ] Test paste deletion

### Compatibility Tests

- [ ] Build representative legacy paste fixture set
- [ ] Include HTML with inline CSS
- [ ] Include HTML with inline JavaScript
- [ ] Include Unicode HTML
- [ ] Include unusual whitespace
- [ ] Include large HTML near the size limit
- [ ] Include malformed but browser-renderable HTML
- [ ] Compare old public runtime behavior
- [ ] Compare old raw endpoint bytes
- [ ] Compare old render behavior where required
- [ ] Verify existing tokens map correctly
- [ ] Verify existing URLs remain valid

## Milestone Acceptance Criteria

- [ ] Critical product flows have end-to-end coverage
- [ ] Raw-output compatibility is verified
- [ ] Security-critical authorization checks have automated tests
- [ ] CI blocks deployment on failed critical tests

---

# Milestone 19 — Legacy Rails Data Migration

## Goal

Move production data from the Rails application into Convex without breaking existing paste URLs.

## Tasks

### Migration Analysis

- [ ] Inventory existing Rails tables
- [ ] Inventory existing paste fields
- [ ] Inventory folders
- [ ] Inventory user records
- [ ] Inventory API keys
- [ ] Inventory OAuth/MCP records
- [ ] Inventory password-protected paste data
- [ ] Inventory analytics data
- [ ] Inventory stored HTML
- [ ] Identify records that cannot be migrated directly
- [ ] Define source-of-truth rules during migration

### Migration Tooling

- [ ] Create export script from legacy application
- [ ] Create normalized migration format
- [ ] Create Convex import script
- [ ] Create HTML upload migration process
- [ ] Preserve paste tokens
- [ ] Preserve custom subdomains
- [ ] Preserve ownership mappings
- [ ] Preserve folder relationships
- [ ] Preserve creation timestamps
- [ ] Preserve update timestamps
- [ ] Preserve password behavior where safely possible
- [ ] Define API-key migration policy
- [ ] Define OAuth/MCP credential migration policy

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

- [ ] Run full migration against staging
- [ ] Measure migration duration
- [ ] Validate migration logs
- [ ] Validate rollback
- [ ] Fix failed records
- [ ] Repeat until clean

## Milestone Acceptance Criteria

- [ ] All required production records can be migrated
- [ ] Existing public tokens are preserved
- [ ] HTML content passes hash/byte validation
- [ ] Migration has been successfully rehearsed on staging
- [ ] A rollback path exists

---

# Milestone 20 — Vercel Production Deployment

## Goal

Deploy the complete rebuilt application to production infrastructure before traffic cutover.

## Tasks

### Vercel

- [ ] Create production Vercel project
- [ ] Configure production environment variables
- [ ] Configure preview environment variables
- [ ] Configure build command
- [ ] Configure Convex deployment command
- [ ] Configure production domain
- [ ] Configure wildcard domain
- [ ] Configure `www`
- [ ] Verify SSL
- [ ] Verify deployment protection settings
- [ ] Verify function runtime settings
- [ ] Verify preview deployments

### Convex

- [ ] Create production Convex deployment
- [ ] Configure production environment variables
- [ ] Configure Clerk auth integration
- [ ] Configure file storage
- [ ] Verify indexes
- [ ] Verify scheduled functions
- [ ] Configure preview deployment strategy
- [ ] Ensure preview branches cannot access production data

### Smoke Tests

- [ ] Publish anonymous paste in production
- [ ] Open wildcard public URL
- [ ] Open raw URL
- [ ] Open preview URL
- [ ] Create account
- [ ] Publish authenticated paste
- [ ] Create folder
- [ ] Create API key
- [ ] Publish through API
- [ ] Publish through MCP
- [ ] Protect a paste with password
- [ ] Verify analytics
- [ ] Verify logs and Sentry

## Milestone Acceptance Criteria

- [ ] Production environment is operational
- [ ] Wildcard routing works
- [ ] Convex production deployment works
- [ ] Preview environments remain isolated from production data
- [ ] All smoke tests pass

---

# Milestone 21 — Production Cutover

## Goal

Move real production traffic from the Rails application to the new Next.js + Convex implementation.

## Tasks

### Pre-Cutover

- [ ] Freeze schema-changing work
- [ ] Complete final migration rehearsal
- [ ] Verify latest backup
- [ ] Verify rollback plan
- [ ] Verify DNS access
- [ ] Verify Vercel rollback access
- [ ] Verify Convex deployment access
- [ ] Verify monitoring dashboards
- [ ] Verify error alerts
- [ ] Notify maintainers of cutover procedure

### Final Data Migration

- [ ] Put legacy write operations into maintenance/read-only mode if needed
- [ ] Export final legacy data
- [ ] Import final data to Convex
- [ ] Upload final HTML files
- [ ] Validate counts
- [ ] Validate hashes
- [ ] Validate sample URLs
- [ ] Validate users
- [ ] Validate folders
- [ ] Validate protected pastes
- [ ] Resolve migration failures before cutover

### Traffic Switch

- [ ] Point production domain to Vercel configuration
- [ ] Verify root domain
- [ ] Verify `www`
- [ ] Verify wildcard subdomains
- [ ] Verify API routes
- [ ] Verify MCP endpoint
- [ ] Verify Clerk callbacks
- [ ] Verify raw routes
- [ ] Verify password-protected routes

### Post-Cutover Monitoring

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

- [ ] Production traffic is served by the new application
- [ ] Existing paste URLs continue working
- [ ] No critical migration issues remain
- [ ] Error rates remain within acceptable levels
- [ ] Rollback remains possible during the validation window

---

# Milestone 22 — Legacy Decommission

## Goal

Retire the Ruby/Rails infrastructure after the new application has proven stable.

## Tasks

- [ ] Define stability validation period
- [ ] Keep legacy environment read-only during validation period
- [ ] Archive final legacy database backup
- [ ] Archive final file-storage backup
- [ ] Archive deployment configuration
- [ ] Archive migration scripts
- [ ] Document old infrastructure dependencies
- [ ] Remove production traffic from Rails
- [ ] Disable legacy background jobs
- [ ] Disable legacy API write paths
- [ ] Remove unused secrets
- [ ] Remove unused infrastructure
- [ ] Remove unused database resources
- [ ] Remove unused VPS resources
- [ ] Update project documentation
- [ ] Update architecture diagrams
- [ ] Confirm no runtime dependency on Ruby remains

## Milestone Acceptance Criteria

- [ ] Production no longer depends on Ruby or Rails
- [ ] Legacy data backups are safely retained
- [ ] Old infrastructure has been decommissioned
- [ ] New architecture is fully documented

---

# Milestone 23 — Post-Launch Improvements

## Goal

Improve the product after the successful rebuild without blocking the initial launch.

## Tasks

### Product Improvements

- [ ] Evaluate anonymous paste expiration
- [ ] Evaluate paste revision history
- [ ] Evaluate custom domains
- [ ] Evaluate multi-file site support
- [ ] Evaluate CSS/JS asset uploads
- [ ] Evaluate GitHub integration
- [ ] Evaluate CLI
- [ ] Evaluate npm package
- [ ] Evaluate webhook notifications
- [ ] Evaluate templates
- [ ] Evaluate screenshots/previews
- [ ] Evaluate team workspaces
- [ ] Evaluate organization accounts

### Performance Improvements

- [ ] Review real production latency
- [ ] Review Convex usage and costs
- [ ] Review Vercel usage and costs
- [ ] Review file-storage usage
- [ ] Optimize high-traffic paste behavior
- [ ] Optimize analytics storage
- [ ] Optimize dashboard query patterns

### Security Improvements

- [ ] Perform post-launch security review
- [ ] Review abuse patterns
- [ ] Adjust rate limits
- [ ] Review authentication events
- [ ] Review API key usage
- [ ] Review MCP authorization behavior
- [ ] Improve moderation tooling

### Developer Experience

- [ ] Improve contributor documentation
- [ ] Improve local wildcard-domain tooling
- [ ] Improve test fixtures
- [ ] Improve API docs
- [ ] Improve MCP docs
- [ ] Automate release notes
- [ ] Automate dependency updates

---

# Global Definition of Done

The rebuild is considered complete when all launch-critical milestones are complete and the following checks pass:

- [ ] No Ruby runtime is required
- [ ] No Rails server is required
- [ ] No self-managed application server is required
- [ ] No self-managed database is required
- [ ] Next.js is deployed on Vercel
- [ ] Convex is the active backend data platform
- [ ] Convex File Storage contains active HTML content
- [ ] Clerk authentication is operational
- [ ] Anonymous publishing works
- [ ] Authenticated publishing works
- [ ] Wildcard paste URLs work
- [ ] Raw paste URLs work
- [ ] Preview routes work
- [x] Folder management works
- [x] Password protection works
- [ ] API keys work
- [ ] REST API publishing works
- [ ] MCP publishing works
- [ ] Analytics works without blocking public responses
- [ ] Security isolation between app and paste origins is verified
- [ ] Migration has preserved required existing paste URLs
- [ ] Automated critical-path tests pass
- [ ] Production monitoring is enabled
- [ ] Rollback procedures are documented
- [ ] Legacy Rails infrastructure is no longer required

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
