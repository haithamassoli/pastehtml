# pastehtml.dev Rebuild — Project Tasks

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

- [ ] Create a storage helper module
- [ ] Implement browser upload URL generation
- [ ] Implement file storage metadata retrieval
- [ ] Implement file deletion
- [ ] Implement file replacement
- [ ] Implement storage cleanup helpers
- [ ] Implement storage ownership validation
- [ ] Ensure Convex storage IDs are never trusted without authorization checks

### Upload Validation

- [ ] Define the initial maximum HTML upload size
- [ ] Validate upload size before paste creation
- [ ] Validate non-empty content
- [ ] Validate allowed content type
- [ ] Preserve uploaded bytes without HTML sanitization
- [ ] Reject unsupported payloads with structured errors

### Browser Upload Flow

- [ ] Implement request for a signed Convex upload URL
- [ ] Implement direct browser-to-Convex upload
- [ ] Return the resulting storage ID
- [ ] Create paste metadata after successful upload
- [ ] Handle abandoned uploads
- [ ] Handle failed uploads
- [ ] Add cleanup strategy for orphaned storage objects

### File Replacement

- [ ] Implement replacement upload flow
- [ ] Update paste storage ID atomically where possible
- [ ] Delete old storage object after successful replacement
- [ ] Prevent old content deletion before new content is committed
- [ ] Test rollback behavior after failed replacement

## Milestone Acceptance Criteria

- [ ] HTML is stored in Convex File Storage
- [ ] Paste metadata references stored HTML correctly
- [ ] Browser uploads bypass unnecessary Vercel proxying
- [ ] Replacing HTML does not corrupt existing pastes
- [ ] Orphaned file cleanup has a defined implementation

---

# Milestone 3 — Anonymous Paste Publishing

## Goal

Implement the simplest core product flow: upload HTML and immediately receive a public paste URL without creating an account.

## Tasks

### Public Publishing UI

- [ ] Create the home page publishing interface
- [ ] Add drag-and-drop HTML upload
- [ ] Add file picker upload
- [ ] Add paste-from-text option if desired
- [ ] Display upload progress
- [ ] Display validation errors
- [ ] Display successful publish result
- [ ] Add copy-public-URL action
- [ ] Add copy-raw-URL action
- [ ] Add publish-another action

### Anonymous Authorization

- [ ] Generate a secure anonymous update token
- [ ] Store only a hash of the anonymous update token
- [ ] Return the raw update token only once
- [ ] Implement update authorization using the token
- [ ] Implement delete authorization using the token
- [ ] Ensure tokens are never logged

### API Response

- [ ] Define the create-paste response contract
- [ ] Return paste identifier
- [ ] Return public URL
- [ ] Return raw URL
- [ ] Return update token for anonymous pastes
- [ ] Add consistent error responses

### Tests

- [ ] Test anonymous browser publishing
- [ ] Test invalid upload
- [ ] Test oversized upload
- [ ] Test empty upload
- [ ] Test update-token generation
- [ ] Test unauthorized anonymous update
- [ ] Test authorized anonymous update
- [ ] Test authorized anonymous deletion

## Milestone Acceptance Criteria

- [ ] A visitor can publish an HTML file without an account
- [ ] A public paste URL is returned immediately
- [ ] The anonymous user receives an update token
- [ ] The update token can securely update or delete the paste
- [ ] Invalid uploads fail with structured errors

---

# Milestone 4 — Wildcard Subdomain Runtime

## Goal

Serve every paste as a real HTML page from an isolated wildcard subdomain on Vercel.

## Tasks

### Vercel Domain Configuration

- [ ] Add `pastehtml.dev` to the Vercel project
- [ ] Configure `www.pastehtml.dev`
- [ ] Configure wildcard `*.pastehtml.dev`
- [ ] Verify wildcard SSL issuance
- [ ] Document DNS configuration
- [ ] Document local wildcard-host development strategy

### Host Routing

- [ ] Create `proxy.ts`
- [ ] Parse incoming hostnames safely
- [ ] Detect the root application domain
- [ ] Detect wildcard subdomains
- [ ] Ignore unsupported hostnames
- [ ] Normalize hostname casing
- [ ] Strip development ports safely
- [ ] Route wildcard requests internally to the paste runtime
- [ ] Handle reserved subdomains
- [ ] Handle custom subdomain lookup
- [ ] Handle token-based subdomain lookup

### Runtime Route

- [ ] Create the internal paste runtime route
- [ ] Resolve paste metadata by subdomain
- [ ] Fetch HTML from Convex File Storage
- [ ] Return stored HTML as `text/html`
- [ ] Return 404 for missing paste
- [ ] Return disabled-state response when applicable
- [ ] Add cache headers
- [ ] Add ETag support
- [ ] Add conditional request support
- [ ] Add required security headers
- [ ] Ensure analytics does not block the HTML response

### Isolation Tests

- [ ] Verify wildcard paste content cannot access main-app authentication cookies
- [ ] Verify one subdomain cannot access another paste's protected state
- [ ] Verify main application routes do not accidentally execute paste HTML
- [ ] Verify arbitrary scripts run only in the intended paste origin
- [ ] Verify wildcard requests cannot rewrite into privileged internal routes

## Milestone Acceptance Criteria

- [ ] `https://TOKEN.pastehtml.dev` serves the uploaded HTML
- [ ] Wildcard SSL works on Vercel
- [ ] Missing tokens return 404
- [ ] User HTML does not receive main-app authentication credentials
- [ ] Host routing has automated tests

---

# Milestone 5 — Raw and Preview Endpoints

## Goal

Provide raw source retrieval and a controlled preview/render route.

## Tasks

### Raw Endpoint

- [ ] Implement `GET /p/[token]/raw`
- [ ] Load the original stored HTML
- [ ] Return the original content without rendering it in the application
- [ ] Set an appropriate `Content-Type`
- [ ] Set an appropriate filename header
- [ ] Add ETag support
- [ ] Add conditional requests
- [ ] Define caching behavior
- [ ] Verify byte-level output against stored content

### Preview Endpoint

- [ ] Implement `GET /p/[token]/render`
- [ ] Return HTML preview
- [ ] Add sandbox-oriented Content Security Policy
- [ ] Prevent access to main-application cookies
- [ ] Prevent privileged application API access
- [ ] Test scripts inside the preview
- [ ] Test forms inside the preview
- [ ] Test modal behavior if supported
- [ ] Verify unsafe capabilities remain blocked

### Metadata Page

- [ ] Implement `GET /p/[token]`
- [ ] Show paste information
- [ ] Show public URL
- [ ] Show raw URL
- [ ] Show preview link
- [ ] Show ownership controls when authorized

## Milestone Acceptance Criteria

- [ ] Raw endpoint returns the stored content correctly
- [ ] Preview endpoint works with explicit sandboxing
- [ ] Metadata page works for public pastes
- [ ] Raw output passes byte-level regression tests

---

# Milestone 6 — Clerk Authentication

## Goal

Add production-ready user authentication while keeping wildcard paste origins isolated.

## Tasks

### Clerk Setup

- [ ] Configure Clerk production application
- [ ] Configure allowed callback URLs
- [ ] Configure sign-in page
- [ ] Configure sign-up page
- [ ] Configure sign-out flow
- [ ] Configure desired OAuth providers
- [ ] Configure email authentication if required
- [ ] Configure Convex Clerk integration
- [ ] Configure authentication state in server components
- [ ] Configure authentication state in route handlers

### Application Auth Helpers

- [ ] Create `getCurrentUser`
- [ ] Create `requireCurrentUser`
- [ ] Create ownership guard helpers
- [ ] Create API auth helpers
- [ ] Create authorization error utilities

### Security

- [ ] Verify Clerk cookies are not scoped to `.pastehtml.dev`
- [ ] Verify wildcard paste hosts cannot access Clerk credentials
- [ ] Verify authenticated mutations validate identity inside Convex
- [ ] Add origin checks where required
- [ ] Add CSRF protections where required
- [ ] Test logout invalidation

### Account Claiming

- [ ] Decide whether anonymous pastes can be claimed after sign-in
- [ ] If supported, implement claim flow
- [ ] Validate anonymous update token before claiming
- [ ] Prevent claiming a paste twice

## Milestone Acceptance Criteria

- [ ] Users can register, sign in, and sign out
- [ ] Convex can securely identify signed-in users
- [ ] Authenticated pastes are owned by the correct user
- [ ] Wildcard paste subdomains do not receive authenticated app credentials

---

# Milestone 7 — Authenticated Dashboard

## Goal

Create the realtime management experience for signed-in users.

## Tasks

### Dashboard Shell

- [ ] Create dashboard layout
- [ ] Create navigation
- [ ] Create mobile navigation
- [ ] Create account menu
- [ ] Add empty states
- [ ] Add loading states
- [ ] Add error states

### Paste List

- [ ] Display user's pastes
- [ ] Subscribe using Convex realtime queries
- [ ] Display paste title or filename
- [ ] Display public URL
- [ ] Display view count
- [ ] Display created date
- [ ] Display last updated date
- [ ] Add search
- [ ] Add folder filtering
- [ ] Add sorting
- [ ] Add pagination or incremental loading if needed
- [ ] Add copy URL action
- [ ] Add delete action
- [ ] Add create paste action

### Paste Details

- [ ] Create paste details page
- [ ] Show metadata
- [ ] Show public URL
- [ ] Show raw URL
- [ ] Show preview
- [ ] Add title editing
- [ ] Add file replacement
- [ ] Add folder management
- [ ] Add password settings
- [ ] Add analytics summary
- [ ] Add destructive delete action
- [ ] Add confirmation dialogs

### Realtime Behavior

- [ ] Verify new paste appears without refresh
- [ ] Verify edits update without refresh
- [ ] Verify deleted paste disappears without refresh
- [ ] Verify view count updates without refresh
- [ ] Verify folder moves update without refresh

## Milestone Acceptance Criteria

- [ ] Signed-in users can manage their pastes
- [ ] Dashboard data updates in realtime
- [ ] All destructive actions require explicit confirmation
- [ ] Mobile dashboard remains usable

---

# Milestone 8 — Folder Management

## Goal

Allow users to organize pastes into folders.

## Tasks

- [ ] Create folder list UI
- [ ] Create new-folder dialog
- [ ] Implement folder rename UI
- [ ] Implement folder delete UI
- [ ] Add folder detail page
- [ ] Add folder paste list
- [ ] Add move-paste action
- [ ] Add remove-from-folder action
- [ ] Add folder filter to dashboard
- [ ] Ensure folder ownership is validated
- [ ] Prevent cross-account folder assignment
- [ ] Keep pastes when a folder is deleted
- [ ] Add realtime folder updates
- [ ] Add folder operation tests

## Milestone Acceptance Criteria

- [ ] Users can create, rename, and delete folders
- [ ] Pastes can be moved between folders
- [ ] Deleting a folder preserves its pastes
- [ ] Folder changes update in realtime

---

# Milestone 9 — Password-Protected Pastes

## Goal

Allow paste owners to require a password before public content is served.

## Tasks

### Password Management

- [ ] Select a modern password hashing library compatible with the runtime
- [ ] Implement password hashing
- [ ] Implement password verification
- [ ] Ensure plaintext passwords are never stored
- [ ] Add enable-password UI
- [ ] Add change-password UI
- [ ] Add remove-password UI

### Unlock Flow

- [ ] Detect protected pastes in wildcard runtime
- [ ] Render password challenge page
- [ ] Submit password securely
- [ ] Verify password server-side
- [ ] Create paste-specific unlock session
- [ ] Scope unlock state to one paste only
- [ ] Set expiration
- [ ] Add logout/forget-unlock behavior if needed

### Abuse Prevention

- [ ] Rate limit password attempts
- [ ] Add temporary lockout rules if needed
- [ ] Ensure responses do not expose password validity details unnecessarily
- [ ] Log suspicious attempt patterns safely

### Tests

- [ ] Test correct password
- [ ] Test incorrect password
- [ ] Test expired unlock session
- [ ] Test unlock isolation between pastes
- [ ] Test password removal
- [ ] Test password replacement
- [ ] Test rate limiting

## Milestone Acceptance Criteria

- [ ] Owners can enable and remove password protection
- [ ] Protected pastes cannot be viewed without a valid password
- [ ] Unlock state is isolated per paste
- [ ] Password brute-force attempts are rate-limited

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

Support user-selected subdomains such as `my-demo.pastehtml.dev` in addition to generated paste tokens.

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
- [ ] Folder management works
- [ ] Password protection works
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
