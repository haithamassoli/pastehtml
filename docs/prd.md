# Product Requirements Document (PRD)

## Product

**pastehtml.assoli.site — Next-Generation Rebuild**

## Document Status

- **Status:** Draft
- **Language:** English
- **Target Platform:** Web
- **Hosting:** Vercel
- **Backend / Data Platform:** Convex
- **Primary Framework:** Next.js
- **Primary Language:** TypeScript

---

## 1. Executive Summary

pastehtml.assoli.site is a developer-focused platform for publishing raw HTML files as live web pages with minimal friction.

The current product will be rebuilt without Ruby or Rails. The new version will use a TypeScript-first architecture built around Next.js, Convex, and Vercel.

The rebuilt product must preserve the core behavior of the existing service while improving maintainability, deployment simplicity, security, developer experience, scalability, observability, and future extensibility.

A central product requirement is that uploaded HTML can be served as a real web page on an isolated wildcard subdomain such as:

```text
https://abc123.pastehtml.assoli.site
```

The product must also provide raw content access, preview/render routes, authenticated account features, folders, API keys, programmatic publishing, analytics, and MCP integration.

---

## 2. Product Vision

Create the fastest and simplest way for developers, AI agents, automation tools, and technical users to publish HTML to the web.

The ideal workflow should be:

```text
HTML in
  ↓
pastehtml.assoli.site
  ↓
Public URL out
```

Publishing should require as few steps as possible.

The product should work equally well for:

- humans using the web interface,
- developers using the API,
- scripts using `curl`,
- AI agents,
- MCP clients,
- CI/CD systems,
- internal automation.

The rebuild should feel simple to use while remaining technically robust behind the scenes.

---

## 3. Goals

### 3.1 Primary Goals

The rebuild must:

1. Remove Ruby and Rails from the application stack.
2. Move to an end-to-end TypeScript codebase.
3. Deploy the public application on Vercel.
4. Use Convex as the backend data platform.
5. Use Convex File Storage for uploaded HTML content.
6. Preserve wildcard-subdomain publishing.
7. Preserve exact uploaded HTML content.
8. Preserve public API compatibility where practical.
9. Support anonymous and authenticated publishing.
10. Support user accounts, folders, API keys, and analytics.
11. Support MCP-based publishing and management.
12. Improve security isolation between the main application and user-generated HTML.
13. Improve developer experience and reduce infrastructure maintenance.
14. Provide a clean architecture that can evolve without tightly coupling domain logic to Next.js.

### 3.2 Secondary Goals

The rebuild should:

- provide realtime dashboard updates,
- provide better analytics,
- support preview deployments,
- make local development easier,
- improve error handling,
- provide structured logs and observability,
- improve automated testing,
- simplify future mobile or third-party client development.

---

## 4. Non-Goals

The initial rebuild will not attempt to:

- build a visual website builder,
- become a full static-site hosting platform,
- execute arbitrary server-side code uploaded by users,
- provide server-side PHP, Ruby, Python, or Node execution,
- provide a general-purpose object storage product,
- replace Vercel or Convex infrastructure,
- support arbitrary custom domains in the first release unless explicitly prioritized,
- provide complex team or enterprise collaboration features in the first release,
- provide a full source-code repository hosting workflow.

---

## 5. Target Users

### 5.1 Developers

Developers who want to quickly publish a standalone HTML file for:

- prototypes,
- demos,
- documentation,
- test fixtures,
- design experiments,
- generated reports,
- temporary landing pages.

### 5.2 AI Agents

AI systems that need to generate an HTML artifact and expose it through a public URL.

Typical workflow:

```text
Generate HTML
→ POST HTML to pastehtml.assoli.site
→ receive URL
→ return URL to user
```

### 5.3 Automation and CI Systems

Scripts and pipelines that need to publish generated HTML output.

Examples include:

- test reports,
- benchmarks,
- documentation previews,
- build summaries,
- static exports.

### 5.4 Non-Technical Users

Users who receive or upload an HTML file and want a working shareable URL without configuring hosting.

---

## 6. Core User Stories

### Publishing

As a visitor, I want to upload an HTML file and immediately receive a public URL.

As a developer, I want to POST raw HTML to an API and receive a public URL.

As an AI agent, I want to publish HTML through MCP and return the resulting link.

As an authenticated user, I want my pastes associated with my account.

### Management

As an authenticated user, I want to:

- view my pastes,
- rename them,
- update their HTML,
- delete them,
- organize them into folders,
- protect selected pastes with a password,
- generate API keys,
- revoke API keys,
- view basic analytics.

### Consumption

As a viewer, I want a paste URL to behave like a normal web page.

As a developer, I want access to the exact raw uploaded content.

As a user, I want a safe preview route for viewing content inside the main application context.

---

## 7. Product Principles

### 7.1 Publishing Must Be Fast

The shortest supported flow should remain:

```bash
curl --data-binary @page.html \
  -H "Content-Type: text/html" \
  https://pastehtml.assoli.site/api/pastes
```

The response should contain the published URL and identifiers needed to manage the paste.

### 7.2 User HTML Is Untrusted

Uploaded HTML must always be treated as untrusted content.

The application must never assume uploaded HTML is safe.

### 7.3 Main-App Authentication Must Be Isolated

Authentication credentials for `pastehtml.assoli.site` must not be exposed to content served from:

```text
*.pastehtml.assoli.site
```

### 7.4 Preserve Original Content

The platform must avoid modifying uploaded HTML unless a specific feature explicitly requires transformation.

### 7.5 Framework Logic Must Not Become Domain Logic

Core rules for pastes, ownership, API keys, folders, permissions, and publishing should be implemented in reusable domain/backend modules rather than scattered across React components and Next.js routes.

---

## 8. Technical Architecture

### 8.1 High-Level Stack

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui

Convex
├── Database
├── Queries
├── Mutations
├── Actions
├── Internal Functions
├── File Storage
└── Scheduled Functions

Authentication
└── Clerk initially

MCP
└── Official MCP TypeScript SDK

Hosting
└── Vercel
```

### 8.2 Architecture Overview

```text
                    Browser / API Client / Agent
                               │
                               ▼
                         Vercel / Next.js
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
       pastehtml.assoli.site      *.pastehtml.assoli.site
                 │                           │
         Main Application              Paste Runtime
                 │                           │
         Dashboard / API               Raw HTML serving
         Auth / MCP                    Password gate
                 │                           │
                 └─────────────┬─────────────┘
                               │
                               ▼
                             Convex
                    ┌──────────┴──────────┐
                    │                     │
                 Database             File Storage
```

---

## 9. Responsibility Boundaries

### Next.js Responsibilities

Next.js should be responsible for:

- main application UI,
- server rendering,
- route handlers,
- wildcard host routing,
- public HTTP API surface,
- raw HTML responses,
- rendered HTML responses,
- MCP HTTP endpoints,
- request parsing,
- HTTP caching headers,
- response security headers,
- host-based routing.

### Convex Responsibilities

Convex should be responsible for:

- paste metadata,
- ownership,
- folders,
- user metadata,
- API keys,
- authorization rules,
- paste lookup,
- paste creation,
- paste updates,
- paste deletion,
- analytics data,
- business logic,
- scheduled cleanup,
- realtime subscriptions,
- storage references.

### Convex File Storage Responsibilities

Convex File Storage should store:

- uploaded HTML bytes,
- future supported assets where applicable.

HTML should not be stored directly in a Convex document when doing so risks document-size limits or alters the original byte representation.

---

## 10. Domain Model

### 10.1 Paste

A paste represents one published HTML document.

Suggested fields:

```ts
{
  token: string
  ownerId?: string
  folderId?: Id<"folders">

  storageId: Id<"_storage">

  filename: string
  title?: string
  description?: string

  customSubdomain?: string

  contentType: string
  contentLength: number

  passwordHash?: string

  updateTokenHash?: string

  visibility: "public" | "protected"

  viewsCount: number

  createdAt: number
  updatedAt: number
}
```

Required indexes:

```text
by_token
by_custom_subdomain
by_owner
by_folder
```

### 10.2 Folder

```ts
{
  ownerId: string
  name: string
  slug?: string
  createdAt: number
  updatedAt: number
}
```

### 10.3 API Key

```ts
{
  ownerId: string
  name: string

  keyPrefix: string
  keyHash: string

  scopes: string[]

  lastUsedAt?: number
  expiresAt?: number

  revokedAt?: number

  createdAt: number
}
```

Raw API keys must never be persisted after creation.

### 10.4 Paste View

```ts
{
  pasteId: Id<"pastes">
  timestamp: number

  country?: string
  referrer?: string
  userAgentFamily?: string
}
```

Analytics storage strategy may be revised depending on traffic volume.

### 10.5 Password Session

Used when a visitor unlocks a password-protected paste.

```ts
{
  pasteId: Id<"pastes">;
  sessionHash: string;
  expiresAt: number;
}
```

A stateless signed token may be used instead if it provides simpler and safer behavior.

---

## 11. Authentication

### 11.1 Initial Provider

Use Clerk for the first production release.

Authentication implementation should be wrapped behind application-level helpers so the system is not unnecessarily coupled to one provider.

### 11.2 Supported Authentication

Initial supported methods should include:

- email-based authentication,
- OAuth providers as supported by the selected auth configuration.

### 11.3 Security Requirement

Authentication cookies for the main application must not be broadly scoped to:

```text
.pastehtml.assoli.site
```

They should remain scoped to the main application host whenever possible.

User-generated HTML hosted on wildcard subdomains must not receive main-application session credentials.

---

## 12. Anonymous Publishing

Anonymous users must be able to publish HTML without creating an account.

The system should return:

- paste token,
- public URL,
- raw URL,
- management/update secret when applicable.

Example response:

```json
{
  "id": "abc123",
  "url": "https://abc123.pastehtml.assoli.site",
  "rawUrl": "https://pastehtml.assoli.site/p/abc123/raw",
  "updateToken": "..."
}
```

The exact API format should remain compatible with the existing service where practical.

---

## 13. Authenticated Publishing

When a signed-in user publishes a paste:

- the paste must be associated with the user,
- the user should not require an anonymous update token,
- the paste should appear immediately in the dashboard,
- realtime queries should update the dashboard automatically.

---

## 14. HTML Upload Flow

### 14.1 Browser Upload

Preferred browser flow:

```text
Browser
  │
  │ request upload URL
  ▼
Convex
  │
  │ signed upload URL
  ▼
Browser
  │
  │ upload HTML directly
  ▼
Convex File Storage
  │
  │ storage ID
  ▼
Convex mutation creates paste metadata
```

The browser should avoid unnecessarily proxying upload bytes through Vercel.

### 14.2 API Upload

The public API must support a simple raw body request:

```http
POST /api/pastes
Content-Type: text/html
```

The body contains the HTML.

The first release should preserve the current practical upload-size expectations.

If larger uploads are introduced later, the API may move to a signed direct-upload flow.

---

## 15. Wildcard Subdomain Routing

### 15.1 Required Behavior

A paste identified by:

```text
abc123
```

must be available at:

```text
https://abc123.pastehtml.assoli.site
```

### 15.2 Routing

Next.js host-based routing should detect wildcard subdomains and internally route the request to the paste runtime.

Conceptually:

```text
abc123.pastehtml.assoli.site/
        ↓
/runtime/abc123
```

The browser URL must not change.

### 15.3 Reserved Subdomains

The system must reserve subdomains such as:

```text
www
api
app
admin
status
docs
mcp
mail
support
```

The final reserved list should be configurable.

---

## 16. Paste Runtime

The paste runtime is responsible for serving uploaded HTML.

### 16.1 Root Request

```http
GET https://abc123.pastehtml.assoli.site/
```

Expected behavior:

- resolve paste,
- verify visibility requirements,
- apply password protection if enabled,
- load HTML bytes,
- return HTML response,
- record analytics asynchronously,
- include appropriate caching headers.

### 16.2 Response Type

Normal live paste:

```http
Content-Type: text/html; charset=utf-8
```

### 16.3 Unknown Paste

Unknown or deleted pastes should return:

```http
404 Not Found
```

### 16.4 Disabled Paste

A disabled paste may return:

```http
410 Gone
```

or a product-specific disabled page.

---

## 17. Raw Endpoint

Required route:

```text
GET /p/:token/raw
```

Purpose:

- allow developers and agents to retrieve original content,
- avoid executing HTML,
- preserve uploaded data.

Expected response:

```http
Content-Type: text/plain; charset=utf-8
```

Where byte preservation is more important than character interpretation, implementation should return the stored bytes directly.

---

## 18. Render / Preview Endpoint

Required route:

```text
GET /p/:token/render
```

This route is intended for controlled previews.

It should use restrictive security headers such as a CSP sandbox.

Example policy direction:

```text
sandbox allow-scripts allow-forms allow-modals
```

The exact policy must be tested against required paste behavior.

The preview route must not grant access to main-application credentials or privileged APIs.

---

## 19. Password Protection

Users must be able to protect a paste with a password.

### Requirements

- passwords must never be stored in plaintext,
- use a modern password hashing algorithm,
- password comparison must happen server-side,
- successful unlocks should create a limited paste-specific session,
- unlocking one paste must not unlock another,
- password sessions should expire,
- brute-force attempts should be rate-limited.

---

## 20. Paste Management

Authenticated users must be able to:

- list pastes,
- search pastes,
- open paste details,
- rename a paste,
- update paste content,
- move a paste into a folder,
- remove a paste from a folder,
- enable or disable password protection,
- delete a paste,
- copy public URLs,
- copy raw URLs,
- view basic analytics.

---

## 21. Folders

Users must be able to:

- create folders,
- rename folders,
- delete folders,
- move pastes between folders,
- filter the dashboard by folder.

Deleting a folder must not automatically delete its pastes unless an explicit destructive action is introduced.

Default behavior:

```text
Delete folder
→ keep pastes
→ set folderId = null
```

---

## 22. API Keys

Authenticated users must be able to create API keys.

### Requirements

- raw secret displayed only once,
- persisted version stored as a secure hash,
- keys have human-readable names,
- keys can be revoked,
- optional expiration should be supported,
- API requests should update `lastUsedAt`,
- scopes should be supported.

Possible scopes:

```text
pastes:read
pastes:write
pastes:delete
folders:read
folders:write
```

---

## 23. Public API

The API should remain simple and automation-friendly.

### 23.1 Create Paste

```http
POST /api/pastes
```

Supports raw HTML body.

### 23.2 Get Paste Metadata

```http
GET /api/pastes/:token
```

### 23.3 Update Paste

```http
PATCH /api/pastes/:token
```

Authorization may use:

- authenticated user ownership,
- API key,
- anonymous update token.

### 23.4 Delete Paste

```http
DELETE /api/pastes/:token
```

### 23.5 API Response Format

JSON responses should use a consistent envelope and error format.

Example error:

```json
{
  "error": {
    "code": "PASTE_NOT_FOUND",
    "message": "Paste not found."
  }
}
```

---

## 24. MCP Integration

The application should expose MCP functionality using the official TypeScript MCP SDK.

MCP should support at minimum:

- create paste,
- retrieve paste information,
- update owned/authorized paste,
- delete owned/authorized paste,
- list user pastes when authenticated.

Potential tools:

```text
create_paste
get_paste
update_paste
delete_paste
list_pastes
```

The MCP architecture must follow the current MCP authorization specification at implementation time.

Authentication behavior should be isolated behind a dedicated module so changes to MCP authorization standards do not affect paste domain logic.

---

## 25. Realtime Dashboard

Convex realtime queries should be used to keep the dashboard synchronized.

Examples:

- newly created paste appears immediately,
- deleted paste disappears immediately,
- updated title appears immediately,
- view counts update without manual refresh,
- folder changes update automatically.

Explicit polling should not be used where Convex subscriptions already solve the problem.

---

## 26. Analytics

### 26.1 Initial Analytics

Initial product analytics should include:

- total views,
- recent views,
- creation date,
- last updated date.

Optional:

- top referrers,
- approximate country,
- browser family.

### 26.2 Privacy

Do not collect unnecessary personal information.

Avoid storing complete IP addresses unless there is a clear security requirement.

If IP information is needed for abuse prevention, use a privacy-conscious derived representation where possible.

### 26.3 Performance

Analytics recording must not delay serving HTML.

Desired behavior:

```text
HTML request
  ├── return HTML
  └── asynchronously record view
```

---

## 27. Caching

Caching rules must reflect paste mutability.

### Requirements

- updated pastes should become visible quickly,
- deleted pastes must not remain publicly cached for long periods,
- ETags should be supported where useful,
- conditional requests should be supported,
- raw and runtime routes may use different caching policies,
- authenticated dashboard routes must not leak private content through shared caches.

A content hash may be stored with each paste revision to simplify cache validation.

---

## 28. Security

Security is a first-class product requirement because the platform intentionally serves arbitrary user-controlled HTML.

### 28.1 Isolation

User HTML must be isolated from authenticated application state.

### 28.2 Cookies

Do not expose application authentication cookies to wildcard user-content subdomains.

### 28.3 CSRF

State-changing authenticated operations must be protected against CSRF or use authentication patterns that provide equivalent guarantees.

### 28.4 XSS

The dashboard must never inject user-provided HTML directly into privileged application DOM.

Paste titles, file names, and metadata must be escaped.

### 28.5 Content Security Policy

The dashboard should use a strict CSP.

Preview routes should use an explicit sandbox-oriented CSP.

### 28.6 Rate Limiting

Rate limits should be implemented for:

- anonymous uploads,
- account sign-up abuse,
- password attempts,
- API usage,
- MCP requests,
- paste updates,
- paste deletion.

### 28.7 API Key Security

API keys must:

- use sufficient entropy,
- be stored only as hashes,
- support revocation,
- avoid exposure in logs.

### 28.8 Secrets

Secrets must be stored using Vercel and Convex environment configuration.

Secrets must never be committed to Git.

---

## 29. Abuse Prevention

The platform should include basic protections against:

- spam,
- phishing,
- malware distribution,
- excessive automated uploads,
- brute-force password guessing,
- resource exhaustion.

Administrative capabilities should include:

- disable paste,
- delete paste,
- block abusive identifiers where appropriate,
- inspect minimal operational metadata,
- review abuse reports.

A full moderation system is not required for the first release.

---

## 30. Error Handling

Errors should be:

- structured,
- actionable,
- safe to expose,
- logged with internal context.

User-facing errors must not expose:

- stack traces,
- secret values,
- internal Convex identifiers unless necessary,
- infrastructure configuration.

Suggested error codes:

```text
PASTE_NOT_FOUND
PASTE_FORBIDDEN
PASTE_PASSWORD_REQUIRED
INVALID_PASSWORD
INVALID_HTML_UPLOAD
UPLOAD_TOO_LARGE
INVALID_API_KEY
RATE_LIMITED
INTERNAL_ERROR
```

---

## 31. Observability

The production system should provide:

- Vercel logs,
- Convex logs,
- structured application logging,
- error tracking,
- performance monitoring.

Recommended additional service:

```text
Sentry
```

or equivalent.

Important operations should carry a request/correlation identifier where practical.

---

## 32. Performance Requirements

Target metrics for typical public paste requests:

- minimize cold-start dependencies,
- avoid unnecessary application rendering,
- avoid database scans,
- use indexed Convex queries,
- avoid synchronous analytics writes before response,
- use direct file retrieval where practical.

Desired user experience:

- paste creation should feel near-instant,
- public paste URLs should load quickly worldwide,
- dashboard interactions should feel realtime.

No strict SLA is defined for the first release.

---

## 33. Accessibility

The main application should target WCAG 2.1 AA practices.

Requirements include:

- keyboard-accessible navigation,
- visible focus states,
- labeled form controls,
- sufficient contrast,
- semantic HTML,
- accessible dialogs,
- screen-reader-friendly errors.

Uploaded user HTML is not required to meet pastehtml.assoli.site accessibility standards because it is user-provided content.

---

## 34. Responsive Design

The application must work on:

- desktop,
- tablet,
- mobile.

Core publishing functionality must be usable from a mobile browser.

The initial dashboard should prioritize desktop workflows while remaining fully functional on smaller screens.

---

## 35. UI Requirements

### Public Home Page

Should provide:

- product explanation,
- HTML upload area,
- drag-and-drop,
- paste/publish action,
- API example,
- MCP/agent entry point,
- authentication actions.

### Dashboard

Should provide:

- paste list,
- folders,
- search/filtering,
- view counts,
- copy URL actions,
- create paste action,
- account/API settings.

### Paste Details

Should provide:

- public URL,
- raw URL,
- preview,
- metadata,
- update HTML,
- folder,
- password settings,
- analytics,
- delete action.

---

## 36. Suggested Application Structure

```text
app/
├── (marketing)/
│   └── page.tsx
│
├── (dashboard)/
│   ├── dashboard/
│   ├── folders/
│   ├── api-keys/
│   └── settings/
│
├── p/
│   └── [token]/
│       ├── page.tsx
│       ├── raw/
│       │   └── route.ts
│       └── render/
│           └── route.ts
│
├── runtime/
│   └── [subdomain]/
│       └── route.ts
│
├── api/
│   ├── pastes/
│   └── folders/
│
├── mcp/
│   └── route.ts
│
└── .well-known/

convex/
├── schema.ts
├── pastes/
│   ├── queries.ts
│   ├── mutations.ts
│   └── internal.ts
├── folders/
├── users/
├── apiKeys/
├── analytics/
└── auth.config.ts

components/

lib/
├── auth/
├── crypto/
├── paste/
├── api/
└── security/

proxy.ts
```

The exact directory layout may evolve during implementation.

---

## 37. Migration Strategy

The rebuild should not require an immediate destructive migration.

### Phase 1 — Foundation

Build:

- Next.js application,
- Convex schema,
- authentication,
- base dashboard,
- file upload,
- paste creation,
- paste serving.

### Phase 2 — Core Compatibility

Implement:

- raw endpoint,
- render endpoint,
- password protection,
- update/delete,
- folders,
- API keys.

### Phase 3 — Agent Features

Implement:

- public API compatibility,
- MCP,
- authentication flows required for agents.

### Phase 4 — Migration

Create migration scripts to move existing production records to:

- Convex Database,
- Convex File Storage.

Preserve existing public tokens and URLs wherever possible.

### Phase 5 — Traffic Cutover

Move production traffic to the new application after:

- automated compatibility tests pass,
- data validation passes,
- wildcard routing is validated,
- authentication is validated,
- rollback procedure exists.

### Phase 6 — Decommission Legacy Stack

After an appropriate validation period:

- make the Rails application read-only,
- archive legacy infrastructure,
- remove unused infrastructure.

---

## 38. Backward Compatibility

Where practical, existing URLs should continue working.

Important URLs include:

```text
https://TOKEN.pastehtml.assoli.site
https://pastehtml.assoli.site/p/TOKEN/raw
https://pastehtml.assoli.site/p/TOKEN/render
```

Existing paste tokens should not change during migration unless technically unavoidable.

The existing API behavior should be preserved where it is useful for current clients and automation.

Any intentionally breaking API change must be documented.

---

## 39. Testing Strategy

### Unit Tests

Test:

- token generation,
- API key hashing,
- password validation,
- permissions,
- subdomain validation,
- reserved subdomain rules,
- domain-level business logic.

### Integration Tests

Test:

- create paste,
- update paste,
- delete paste,
- raw retrieval,
- password flow,
- authenticated ownership,
- API key access,
- folder operations.

### End-to-End Tests

Use Playwright or equivalent.

Critical flows:

1. anonymous browser upload,
2. authenticated upload,
3. public wildcard URL,
4. raw URL,
5. password-protected paste,
6. update paste,
7. delete paste,
8. API publishing,
9. API-key publishing,
10. MCP publishing.

### Compatibility Tests

For migrated pastes, compare old and new behavior for representative samples.

Where byte-level preservation is required, compare actual byte output.

---

## 40. Deployment

### Production

Host Next.js on Vercel.

Use Convex production deployment for:

- database,
- functions,
- storage.

### Preview Environments

Pull requests should receive:

- Vercel preview deployment,
- isolated or appropriately configured Convex preview environment.

Preview infrastructure must never accidentally write to production data.

### Domains

Production should support:

```text
pastehtml.assoli.site
www.pastehtml.assoli.site
*.pastehtml.assoli.site
```

Wildcard DNS and Vercel project configuration must be documented.

---

## 41. Environment Configuration

Example categories:

```text
NEXT_PUBLIC_CONVEX_URL
CONVEX_DEPLOYMENT

CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

APP_URL

MCP_*

SENTRY_*
```

Actual variable names should follow current official SDK requirements.

---

## 42. Data Retention

Initial policy should define:

- anonymous paste retention,
- account-owned paste retention,
- deleted paste retention,
- analytics retention,
- audit/security log retention.

Unless product policy states otherwise, account-owned pastes should remain until explicitly deleted.

Hard deletion from file storage may be asynchronous.

---

## 43. Deletion Semantics

Deleting a paste should:

1. make the public URL unavailable immediately,
2. remove it from dashboard queries,
3. revoke related anonymous management credentials,
4. schedule associated file deletion if not immediately removed,
5. remove or anonymize analytics according to retention policy.

The product should distinguish soft deletion from permanent deletion if moderation or recovery requirements make that necessary.

---

## 44. Token Generation

Public paste tokens must:

- have sufficient entropy,
- be URL-safe,
- avoid reserved subdomain names,
- have negligible collision probability.

Token generation must not depend on sequential database IDs.

---

## 45. Custom Subdomains

Initial product behavior may use the paste token as the subdomain.

If custom subdomains are supported:

```text
my-demo.pastehtml.assoli.site
```

Requirements:

- lowercase normalization,
- uniqueness,
- reserved-name validation,
- minimum/maximum length,
- valid DNS-label characters,
- ownership authorization.

Custom subdomains must never overwrite another user's active route.

---

## 46. File Validation

The service is specifically intended to host HTML.

Initial validation should:

- enforce configured file-size limit,
- require or infer HTML content type,
- reject empty payloads where appropriate,
- preserve content rather than sanitizing live paste HTML.

The privileged dashboard must never render uploaded content unsandboxed.

---

## 47. Revision Strategy

Initial implementation may update the same paste in place.

A future revision system may store:

```text
pasteRevisions
```

to support:

- rollback,
- revision history,
- immutable snapshots.

Revision history is not required for v1 unless needed during migration.

---

## 48. SEO

The main application should have appropriate metadata and canonical URLs.

User-generated paste pages should not automatically inherit the main application's SEO identity.

The product may optionally support:

```http
X-Robots-Tag
```

controls for user content.

SEO policy for public pastes should be explicitly decided before launch.

---

## 49. Product Analytics

The product itself should measure:

- successful publishes,
- failed publishes,
- anonymous vs authenticated publishing,
- API usage,
- MCP usage,
- activation to account creation,
- repeat publishers,
- dashboard engagement,
- storage consumption.

These internal product metrics are separate from per-paste visitor analytics.

---

## 50. Success Metrics

Initial success criteria:

### Technical

- 100% of critical Rails functionality required for launch is available.
- Existing production paste URLs remain functional after migration.
- No authentication cookies are exposed to user-content wildcard subdomains.
- Raw endpoint compatibility tests pass.
- No production migration loses paste content.
- API and browser publishing work reliably.

### Product

- anonymous publishing requires minimal interaction,
- API publishing remains a one-request workflow,
- authenticated dashboard is responsive and realtime,
- AI/MCP publishing produces a usable public URL in one tool flow.

### Operational

- no Ruby runtime is required,
- no Rails server is required,
- no self-managed database server is required,
- no VPS deployment is required for the main application.

---

## 51. Launch Criteria

The new application may replace the legacy application when:

- wildcard routing is working in production,
- Convex production storage is validated,
- authentication isolation is verified,
- anonymous publishing is verified,
- authenticated publishing is verified,
- raw content tests pass,
- password protection works,
- API keys work,
- MCP critical flow works,
- migration script has been tested on a production-like snapshot,
- monitoring is enabled,
- rollback procedure exists.

---

## 52. Risks

### Risk: Wildcard User Content Shares Parent Domain

Mitigation:

- strict cookie scoping,
- no privileged credentials on wildcard hosts,
- careful CSP,
- origin checks.

### Risk: Large HTML Files

Mitigation:

- Convex File Storage,
- direct browser uploads,
- explicit file-size limits.

### Risk: Unexpected Traffic on Popular Pastes

Mitigation:

- CDN-friendly runtime behavior,
- efficient indexed metadata lookups,
- caching strategy,
- non-blocking analytics.

### Risk: Abuse

Mitigation:

- rate limiting,
- moderation controls,
- operational logging,
- reporting process.

### Risk: Tight Coupling to Convex

Mitigation:

- keep domain boundaries clear,
- avoid placing UI-specific behavior in data functions,
- isolate storage and auth integrations.

### Risk: Migration Changes Existing Output

Mitigation:

- byte-level regression tests,
- preserve paste tokens,
- test representative legacy content.

---

## 53. Open Product Decisions

These decisions should be finalized before or during implementation:

1. Should anonymous pastes expire?
2. What is the final maximum HTML upload size?
3. Should custom subdomains be included in v1?
4. Should public pastes be indexed by search engines?
5. Which authentication providers should be enabled?
6. What API rate limits should apply?
7. What MCP authorization model should be used at launch?
8. What paste analytics should be visible to users?
9. How long should view analytics be retained?
10. Should revision history be included in v1?
11. Should users be able to transfer anonymous pastes into an account?
12. Should custom domains be added in a later release?
13. Should static assets beyond a single HTML file be supported later?

---

## 54. Future Opportunities

Not required for the first release:

- custom domains,
- multi-file sites,
- CSS/JS asset uploads,
- paste revision history,
- team workspaces,
- collaborative editing,
- GitHub integration,
- CLI,
- npm package,
- public paste discovery,
- templates,
- AI-assisted HTML generation,
- screenshots and previews,
- short-lived preview environments,
- webhook notifications,
- organization accounts,
- paid storage tiers,
- advanced analytics,
- custom expiration policies.

---

## 55. Recommended Initial Milestone

The first implementation milestone should prove the architecture before building the full dashboard.

Build this vertical slice first:

```text
1. Create HTML paste
2. Store bytes in Convex File Storage
3. Store metadata in Convex
4. Generate token
5. Publish at TOKEN.pastehtml.assoli.site
6. Expose /p/TOKEN/raw
7. Update paste
8. Delete paste
```

Once this works reliably on Vercel with the production wildcard domain, proceed with:

```text
Auth
→ Dashboard
→ Folders
→ Password protection
→ API keys
→ Analytics
→ MCP
```

This reduces architectural risk before investing in secondary features.

---

## 56. Final Recommended Stack

```text
Frontend / HTTP Runtime
  Next.js + React + TypeScript

Backend / Data
  Convex

HTML Storage
  Convex File Storage

Authentication
  Clerk

Styling
  Tailwind CSS + shadcn/ui

Agent Integration
  MCP TypeScript SDK

Hosting
  Vercel

Testing
  Vitest + Playwright

Monitoring
  Vercel + Convex logs + Sentry
```

---

## 57. Definition of Done

The rebuild is complete when a user can:

1. open `pastehtml.assoli.site`,
2. upload an HTML document,
3. receive a public wildcard-subdomain URL,
4. open that URL as a functioning web page,
5. retrieve the original content through the raw endpoint,
6. create an account,
7. manage pastes from a realtime dashboard,
8. organize pastes into folders,
9. protect a paste with a password,
10. publish through an API key,
11. publish through MCP,
12. update or delete owned content,

and the entire production application operates without Ruby, Rails, a self-managed database, or a self-managed application server.
