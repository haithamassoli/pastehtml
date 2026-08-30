// Scoped credentials for automation. Generation, hashing, verification, scope
// checks, expiry and revocation live in `lib/apiKeys.ts` and `lib/auth.ts`,
// where the REST API already reaches them; this file is the account's own view
// of its keys — create, list, revoke — plus the usage stamp.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { scopeValidator } from "./schema";
import { requireCurrentUser, requireOwner } from "./lib/auth";
import { generateApiKey } from "./lib/apiKeys";
import { sha256Hex } from "./lib/tokens";
import { validateFolderName, validateScopes } from "./lib/validation";

/** Coarse enough that a busy key writes its row once a minute, not per call. */
const TOUCH_INTERVAL_MS = 60_000;

export const create = mutation({
  args: {
    name: v.string(),
    scopes: v.array(scopeValidator),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    keyId: v.id("apiKeys"),
    /** Returned exactly once. Only the digest is stored. */
    key: v.string(),
    keyPrefix: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const { key, keyPrefix } = generateApiKey();
    const keyId = await ctx.db.insert("apiKeys", {
      ownerId: user.id,
      // A key name is a short label, exactly like a folder name.
      name: validateFolderName(args.name),
      keyPrefix,
      keyHash: await sha256Hex(key),
      scopes: validateScopes(args.scopes),
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
    return { keyId, key, keyPrefix };
  },
});

export const list = query({
  args: {},
  // The returns validator is the guarantee, not a formality: `keyHash` has no
  // place in this shape, so it cannot be leaked by a careless spread later.
  returns: v.array(
    v.object({
      _id: v.id("apiKeys"),
      name: v.string(),
      keyPrefix: v.string(),
      scopes: v.array(scopeValidator),
      createdAt: v.number(),
      lastUsedAt: v.optional(v.number()),
      // Expiry is returned raw rather than as a computed "expired" flag: a
      // subscribed query that read the clock would go stale the moment it
      // resolved, and the page can compare a timestamp perfectly well.
      expiresAt: v.optional(v.number()),
      revokedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.id))
      .order("desc")
      .take(100);
    return keys.map((key) => ({
      _id: key._id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      revokedAt: key.revokedAt,
    }));
  },
});

/**
 * Kills a key. `verifyApiKey` refuses a revoked row, so the next request with
 * it fails no matter which entry point it arrives at.
 */
export const revoke = mutation({
  args: { keyId: v.id("apiKeys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const key = await ctx.db.get("apiKeys", args.keyId);
    requireOwner(user, key);
    // Revoking twice is not an error — the caller wanted it dead and it is —
    // but the first timestamp stands, because that is when access stopped.
    if (key.revokedAt === undefined)
      await ctx.db.patch("apiKeys", args.keyId, { revokedAt: Date.now() });
    return null;
  },
});

/**
 * Records that a key was presented. Public and unauthenticated by design: the
 * caller has to already hold the secret, and the reply is `null` either way, so
 * a guesser learns nothing about whether the key exists.
 */
export const touch = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const keyHash = await sha256Hex(args.key);
    const record = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
      .unique();
    // A revoked key still being presented is a stale script, not usage. The
    // interval check also keeps a hot key from writing its row on every request
    // and colliding with itself.
    if (
      record &&
      record.revokedAt === undefined &&
      Date.now() - (record.lastUsedAt ?? 0) >= TOUCH_INTERVAL_MS
    )
      await ctx.db.patch("apiKeys", record._id, { lastUsedAt: Date.now() });
    return null;
  },
});
