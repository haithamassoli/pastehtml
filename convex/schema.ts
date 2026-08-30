import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const scopeValidator = v.union(
  v.literal("pastes:read"),
  v.literal("pastes:write"),
  v.literal("pastes:delete"),
  v.literal("folders:read"),
  v.literal("folders:write"),
);

export type Scope = typeof scopeValidator.type;

export const SCOPES: readonly Scope[] = [
  "pastes:read",
  "pastes:write",
  "pastes:delete",
  "folders:read",
  "folders:write",
];

/**
 * How coarse a browser bucket gets. A validator rather than a free string
 * because `pastes.recordView` is public: this is what keeps the column to five
 * possible values whoever calls it. Bots are never recorded at all.
 */
export const userAgentFamilyValidator = v.union(
  v.literal("chrome"),
  v.literal("safari"),
  v.literal("firefox"),
  v.literal("edge"),
  v.literal("other"),
);

export type UserAgentFamily = typeof userAgentFamilyValidator.type;

export default defineSchema({
  pastes: defineTable({
    token: v.string(),
    // Clerk `tokenIdentifier`. Absent for anonymous pastes.
    ownerId: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),

    // ponytail: no `contentHash` column. Convex's `_storage` row already holds
    // a SHA-256 that File Storage computed from the bytes themselves, and
    // `resolveForRuntime` reads it in the same query as this row to use as the
    // ETag — a copy here would be a second thing to keep true, updated by hand
    // on every replacement, and the storage digest would still be the one that
    // could not be wrong. Worth adding only if something needs the hash without
    // resolving the paste at all.
    storageId: v.id("_storage"),

    filename: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),

    customSubdomain: v.optional(v.string()),

    contentType: v.string(),
    contentLength: v.number(),

    // SHA-256 hex. Raw secrets are never persisted.
    passwordHash: v.optional(v.string()),
    updateTokenHash: v.optional(v.string()),

    visibility: v.union(v.literal("public"), v.literal("protected")),

    // Set by `admin.disable` when a paste is taken down for abuse. Withholding
    // happens in `resolveForRuntime`, so every serving surface stops at once.
    // The pair is also the audit trail: when it was disabled, and why.
    disabledAt: v.optional(v.number()),
    disabledReason: v.optional(v.string()),

    viewsCount: v.number(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_custom_subdomain", ["customSubdomain"])
    .index("by_owner", ["ownerId"])
    .index("by_folder", ["folderId"])
    .index("by_storage", ["storageId"]),

  folders: defineTable({
    ownerId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  apiKeys: defineTable({
    ownerId: v.string(),
    name: v.string(),
    keyPrefix: v.string(),
    keyHash: v.string(),
    scopes: v.array(scopeValidator),
    lastUsedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_key_hash", ["keyHash"]),

  // ponytail: one row per view. Fine until traffic warrants @convex-dev/aggregate;
  // the running total lives on `pastes.viewsCount` so reads never scan this table.
  //
  // Nothing here identifies a visitor: an approximate country, the referring
  // site's host and a browser bucket. No address, no full user-agent, no
  // session. Rows are swept after `analytics.RETENTION_MS`; the running total
  // is not, so the headline number outlives the detail behind it.
  pasteViews: defineTable({
    pasteId: v.id("pastes"),
    timestamp: v.number(),
    country: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgentFamily: v.optional(userAgentFamilyValidator),
  })
    .index("by_paste_and_timestamp", ["pasteId", "timestamp"])
    // Retention sweeps read only what has expired, never the whole table.
    .index("by_timestamp", ["timestamp"]),

  // Unlock sessions for password-protected pastes. Only the SHA-256 of the
  // session secret is stored, exactly as with anonymous update tokens.
  pasteUnlocks: defineTable({
    pasteId: v.id("pastes"),
    sessionHash: v.string(),
    expiresAt: v.number(),
  })
    .index("by_session_hash", ["sessionHash"])
    // Revoking every session for a paste when its password changes.
    .index("by_paste", ["pasteId"]),

  // REST API request throttling, one row per (bucket, client). Rewritten in
  // place; a cron drops windows that have reset.
  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    resetAt: v.number(),
  }).index("by_key", ["key"]),

  // Abuse reports, from `POST /api/v1/abuse`. Deliberately holds nothing about
  // the reporter: a one-person product cannot act on a contact address, and an
  // address we cannot use is PII we would only have to protect.
  abuseReports: defineTable({
    // The reported paste's token or custom subdomain, as the reporter gave it.
    token: v.string(),
    reason: v.string(),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolution: v.optional(v.string()),
  }).index("by_token", ["token"]),

  // Password-attempt throttling, one row per (paste, client). Rewritten in
  // place rather than appended to, so the table stays bounded.
  unlockAttempts: defineTable({
    pasteId: v.id("pastes"),
    client: v.string(),
    count: v.number(),
    resetAt: v.number(),
  }).index("by_paste_and_client", ["pasteId", "client"]),
});
