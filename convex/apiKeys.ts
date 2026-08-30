// Scoped credentials for automation. Milestone 11 adds listing, revocation and
// the settings UI; this file is only what the REST API needs to exist.
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { scopeValidator } from "./schema";
import { requireCurrentUser } from "./lib/auth";
import { generateApiKey } from "./lib/apiKeys";
import { sha256Hex } from "./lib/tokens";
import { validateFolderName, validateScopes } from "./lib/validation";

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
