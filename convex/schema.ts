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

export default defineSchema({
  pastes: defineTable({
    token: v.string(),
    // Clerk `tokenIdentifier`. Absent for anonymous pastes.
    ownerId: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),

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
  pasteViews: defineTable({
    pasteId: v.id("pastes"),
    timestamp: v.number(),
    country: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgentFamily: v.optional(v.string()),
  }).index("by_paste_and_timestamp", ["pasteId", "timestamp"]),

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

  // Password-attempt throttling, one row per (paste, client). Rewritten in
  // place rather than appended to, so the table stays bounded.
  unlockAttempts: defineTable({
    pasteId: v.id("pastes"),
    client: v.string(),
    count: v.number(),
    resetAt: v.number(),
  }).index("by_paste_and_client", ["pasteId", "client"]),
});
