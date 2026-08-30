import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  authorizePasteWrite,
  getCurrentUser,
  requireCurrentUser,
  requireOwner,
  requireUpdateToken,
} from "./lib/auth";
import {
  generatePasteToken,
  generateUnlockToken,
  generateUpdateToken,
  sha256Hex,
} from "./lib/tokens";
import { hashPassword, validatePassword, verifyPassword } from "./lib/password";
import { describeUpload, deleteFile, requireUnreferenced } from "./storage";
import {
  fail,
  validateCustomSubdomain,
  validateDescription,
  validateFilename,
  validateTitle,
} from "./lib/validation";

/**
 * Everything safe to expose publicly. Secrets (`passwordHash`,
 * `updateTokenHash`) and the owner identity never leave the backend.
 */
function publicPaste(paste: Doc<"pastes">) {
  return {
    _id: paste._id,
    token: paste.token,
    filename: paste.filename,
    title: paste.title,
    description: paste.description,
    customSubdomain: paste.customSubdomain,
    contentType: paste.contentType,
    contentLength: paste.contentLength,
    visibility: paste.visibility,
    viewsCount: paste.viewsCount,
    isOwned: paste.ownerId !== undefined,
    createdAt: paste.createdAt,
    updatedAt: paste.updatedAt,
  };
}

/** Owner-only view: adds fields the dashboard needs, still no secrets. */
function ownerPaste(paste: Doc<"pastes">) {
  return {
    ...publicPaste(paste),
    folderId: paste.folderId,
    storageId: paste.storageId,
    // Whether a password is set — never the hash itself.
    hasPassword: paste.passwordHash !== undefined,
  };
}

async function byToken(ctx: QueryCtx, token: string) {
  return await ctx.db
    .query("pastes")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

async function requireByToken(ctx: QueryCtx, token: string) {
  const paste = await byToken(ctx, token);
  if (!paste) fail("NOT_FOUND", "Paste not found.");
  return paste;
}

/** Retries on the (vanishingly unlikely) collision rather than trusting luck. */
async function uniqueToken(ctx: QueryCtx): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generatePasteToken();
    if (!(await byToken(ctx, token))) return token;
  }
  fail("INTERNAL", "Could not allocate a paste token.");
}

async function claimSubdomain(
  ctx: QueryCtx,
  subdomain: string,
  self?: Id<"pastes">,
): Promise<string> {
  const value = validateCustomSubdomain(subdomain);
  const existing = await ctx.db
    .query("pastes")
    .withIndex("by_custom_subdomain", (q) => q.eq("customSubdomain", value))
    .unique();
  if (existing && existing._id !== self)
    fail("CONFLICT", `"${value}" is already taken.`);
  return value;
}

async function requireOwnFolder(
  ctx: QueryCtx,
  folderId: Id<"folders">,
  ownerId: string | undefined,
) {
  if (!ownerId) fail("FORBIDDEN", "Anonymous pastes cannot use folders.");
  const folder = await ctx.db.get("folders", folderId);
  if (!folder || folder.ownerId !== ownerId)
    fail("NOT_FOUND", "Folder not found.");
}

export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    customSubdomain: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
  },
  returns: v.object({
    pasteId: v.id("pastes"),
    token: v.string(),
    // Returned exactly once, and only for anonymous pastes.
    updateToken: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const now = Date.now();

    if (args.folderId) await requireOwnFolder(ctx, args.folderId, user?.id);
    await requireUnreferenced(ctx, args.storageId);
    const upload = await describeUpload(ctx, args.storageId, args.contentType);

    const updateToken = user ? undefined : generateUpdateToken();
    const pasteId = await ctx.db.insert("pastes", {
      token: await uniqueToken(ctx),
      ownerId: user?.id,
      folderId: args.folderId,
      storageId: args.storageId,
      filename: validateFilename(args.filename),
      title: args.title === undefined ? undefined : validateTitle(args.title),
      description:
        args.description === undefined
          ? undefined
          : validateDescription(args.description),
      customSubdomain: args.customSubdomain
        ? await claimSubdomain(ctx, args.customSubdomain)
        : undefined,
      contentType: upload.contentType,
      contentLength: upload.contentLength,
      updateTokenHash: updateToken ? await sha256Hex(updateToken) : undefined,
      visibility: "public",
      viewsCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const paste = (await ctx.db.get("pastes", pasteId))!;
    return { pasteId, token: paste.token, updateToken };
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const paste = await byToken(ctx, args.token);
    if (!paste) return null;
    const user = await getCurrentUser(ctx);
    return {
      ...publicPaste(paste),
      // Whether *this* caller owns it, so a public page can decide whether to
      // offer management controls. Derived from the caller's own identity, so
      // an unauthenticated read always gets `false`.
      isViewerOwner: user !== null && paste.ownerId === user.id,
    };
  },
});

export const getByCustomSubdomain = query({
  args: { subdomain: v.string() },
  handler: async (ctx, args) => {
    const paste = await ctx.db
      .query("pastes")
      .withIndex("by_custom_subdomain", (q) =>
        q.eq("customSubdomain", args.subdomain.toLowerCase()),
      )
      .unique();
    return paste ? publicPaste(paste) : null;
  },
});

export const listByOwner = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const pastes = await ctx.db
      .query("pastes")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.id))
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));
    return pastes.map(ownerPaste);
  },
});

export const listByFolder = query({
  args: { folderId: v.id("folders"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await requireOwnFolder(ctx, args.folderId, user.id);
    const pastes = await ctx.db
      .query("pastes")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));
    return pastes.map(ownerPaste);
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    updateToken: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    filename: v.optional(v.string()),
    customSubdomain: v.optional(v.union(v.string(), v.null())),
    // `null` removes the paste from its folder.
    folderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requireByToken(ctx, args.token);
    await authorizePasteWrite(ctx, paste, args.updateToken);

    const patch: Partial<Doc<"pastes">> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = validateTitle(args.title);
    if (args.description !== undefined)
      patch.description = validateDescription(args.description);
    if (args.filename !== undefined)
      patch.filename = validateFilename(args.filename);
    if (args.customSubdomain !== undefined)
      patch.customSubdomain =
        args.customSubdomain === null
          ? undefined
          : await claimSubdomain(ctx, args.customSubdomain, paste._id);
    if (args.folderId !== undefined) {
      if (args.folderId !== null)
        await requireOwnFolder(ctx, args.folderId, paste.ownerId);
      patch.folderId = args.folderId ?? undefined;
    }

    await ctx.db.patch("pastes", paste._id, patch);
    return null;
  },
});

/**
 * Points a paste at newly uploaded content. The old storage object is dropped
 * only after the new id is committed, so a failed replacement never orphans the
 * paste (Milestone 2 wires the upload side of this).
 */
export const replaceContent = mutation({
  args: {
    token: v.string(),
    updateToken: v.optional(v.string()),
    storageId: v.id("_storage"),
    contentType: v.string(),
    filename: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requireByToken(ctx, args.token);
    await authorizePasteWrite(ctx, paste, args.updateToken);
    await requireUnreferenced(ctx, args.storageId, paste._id);
    const upload = await describeUpload(ctx, args.storageId, args.contentType);

    // The new id is committed before the old file is dropped, so a rejected
    // replacement always leaves the paste pointing at intact content.
    const previous = paste.storageId;
    await ctx.db.patch("pastes", paste._id, {
      storageId: args.storageId,
      contentType: upload.contentType,
      contentLength: upload.contentLength,
      ...(args.filename === undefined
        ? {}
        : { filename: validateFilename(args.filename) }),
      updatedAt: Date.now(),
    });
    if (previous !== args.storageId) await deleteFile(ctx, previous);
    return null;
  },
});

/**
 * Transfers an anonymous paste into the signed-in user's account. The browser
 * still holds the update token it was issued at publish time, so this is the
 * bridge between anonymous publishing and the dashboard.
 *
 * The token is retired by the claim: exactly one account can ever take a paste,
 * and afterwards only the owner can manage it.
 */
export const claim = mutation({
  args: { token: v.string(), updateToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const paste = await requireByToken(ctx, args.token);
    // Owned already — by this user or by someone else. Either way the update
    // token no longer exists, so there is nothing left to claim.
    if (paste.ownerId)
      fail("CONFLICT", "This paste already belongs to an account.");
    await requireUpdateToken(paste, args.updateToken);

    await ctx.db.patch("pastes", paste._id, {
      ownerId: user.id,
      // Retiring the secret is what makes the claim one-shot.
      updateTokenHash: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { token: v.string(), updateToken: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requireByToken(ctx, args.token);
    await authorizePasteWrite(ctx, paste, args.updateToken);
    await hardDeletePaste(ctx, paste);
    return null;
  },
});

/** Administrative / cleanup path — no caller authorization, internal only. */
export const hardDelete = internalMutation({
  args: { pasteId: v.id("pastes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await ctx.db.get("pastes", args.pasteId);
    if (paste) await hardDeletePaste(ctx, paste);
    return null;
  },
});

async function hardDeletePaste(ctx: MutationCtx, paste: Doc<"pastes">) {
  await ctx.db.delete("pastes", paste._id);
  await deleteFile(ctx, paste.storageId);
  // ponytail: analytics rows are left behind. Add a scheduled batch sweep if
  // orphaned pasteViews ever show up in storage usage.
}

/**
 * Records a view. Public because the wildcard runtime calls it for anonymous
 * visitors; it is scheduled, never awaited, so HTML delivery never blocks.
 */
export const recordView = mutation({
  args: {
    token: v.string(),
    country: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgentFamily: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await byToken(ctx, args.token);
    if (!paste) return null;
    await ctx.db.patch("pastes", paste._id, {
      viewsCount: paste.viewsCount + 1,
    });
    await ctx.db.insert("pasteViews", {
      pasteId: paste._id,
      timestamp: Date.now(),
      country: args.country,
      referrer: args.referrer,
      userAgentFamily: args.userAgentFamily,
    });
    return null;
  },
});

/** Owner-only detail view, used by the dashboard. */
export const getOwned = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const paste = await requireByToken(ctx, args.token);
    requireOwner(user, paste);
    return ownerPaste(paste);
  },
});

/**
 * Everything a serving surface needs to hand over a paste, in one round trip:
 * a signed storage URL plus the headers to send with it. Used by the wildcard
 * runtime and by the `/p/[token]` raw and preview endpoints. Lookup is by
 * custom subdomain first, then by public token — both indexed.
 *
 * A protected paste with no valid unlock session comes back `locked`, with no
 * URL and no digest: the content is withheld here, not at the serving layer.
 */
export const resolveForRuntime = query({
  args: { subdomain: v.string(), unlockToken: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      token: v.string(),
      // The uploaded name, for the raw endpoint's `Content-Disposition`.
      filename: v.string(),
      visibility: v.union(v.literal("public"), v.literal("protected")),
      // Password protected, and this caller has not unlocked it.
      locked: v.boolean(),
      contentType: v.string(),
      contentLength: v.number(),
      // Convex's stored digest, used verbatim as the ETag.
      sha256: v.string(),
      // `null` if the stored object has gone missing, or the paste is locked.
      url: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const subdomain = args.subdomain.trim().toLowerCase();
    const paste =
      (await ctx.db
        .query("pastes")
        .withIndex("by_custom_subdomain", (q) =>
          q.eq("customSubdomain", subdomain),
        )
        .unique()) ?? (await byToken(ctx, subdomain));
    if (!paste) return null;

    const locked =
      paste.visibility === "protected" &&
      !(await hasValidUnlock(ctx, paste._id, args.unlockToken));

    const metadata = locked
      ? null
      : await ctx.db.system.get("_storage", paste.storageId);
    return {
      token: paste.token,
      filename: paste.filename,
      visibility: paste.visibility,
      locked,
      contentType: paste.contentType,
      contentLength: paste.contentLength,
      sha256: metadata?.sha256 ?? "",
      url: metadata ? await ctx.storage.getUrl(paste.storageId) : null,
    };
  },
});

// --- Password protection -----------------------------------------------------

/** How long an unlock lasts before the visitor is challenged again. */
export const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000;

// ponytail: throttling is per (paste, client-IP). It stops the practical
// online attack without letting one attacker lock a shared paste out for
// everyone; an attacker with a pool of addresses still gets
// MAX_UNLOCK_ATTEMPTS per address, which Milestone 15's global rate limiting
// is where to fix.
export const MAX_UNLOCK_ATTEMPTS = 10;
export const UNLOCK_WINDOW_MS = 15 * 60 * 1000;

/** True when `unlockToken` names a live session for exactly this paste. */
async function hasValidUnlock(
  ctx: QueryCtx,
  pasteId: Id<"pastes">,
  unlockToken: string | undefined,
): Promise<boolean> {
  if (!unlockToken) return false;
  const sessionHash = await sha256Hex(unlockToken);
  const session = await ctx.db
    .query("pasteUnlocks")
    .withIndex("by_session_hash", (q) => q.eq("sessionHash", sessionHash))
    .unique();
  // The session names its paste, so a cookie carried to another paste — or
  // replayed after the password changed — unlocks nothing.
  return (
    session !== null &&
    session.pasteId === pasteId &&
    session.expiresAt > Date.now()
  );
}

/** Drops every unlock session for a paste. Used on password change and removal. */
async function revokeUnlocks(ctx: MutationCtx, pasteId: Id<"pastes">) {
  const sessions = await ctx.db
    .query("pasteUnlocks")
    .withIndex("by_paste", (q) => q.eq("pasteId", pasteId))
    .collect();
  for (const session of sessions)
    await ctx.db.delete("pasteUnlocks", session._id);
}

/**
 * Enables password protection, or replaces the existing password. Either way
 * every outstanding unlock session is revoked, so a changed password takes
 * effect for visitors immediately.
 */
export const setPassword = mutation({
  args: {
    token: v.string(),
    updateToken: v.optional(v.string()),
    password: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requireByToken(ctx, args.token);
    await authorizePasteWrite(ctx, paste, args.updateToken);

    await ctx.db.patch("pastes", paste._id, {
      passwordHash: await hashPassword(validatePassword(args.password)),
      visibility: "protected",
      updatedAt: Date.now(),
    });
    await revokeUnlocks(ctx, paste._id);
    return null;
  },
});

/** Removes password protection and makes the paste public again. */
export const removePassword = mutation({
  args: { token: v.string(), updateToken: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requireByToken(ctx, args.token);
    await authorizePasteWrite(ctx, paste, args.updateToken);

    await ctx.db.patch("pastes", paste._id, {
      passwordHash: undefined,
      visibility: "public",
      updatedAt: Date.now(),
    });
    await revokeUnlocks(ctx, paste._id);
    return null;
  },
});

/**
 * Verifies a password and issues an unlock session. Public, because the visitor
 * being challenged is by definition not signed in.
 *
 * A rejection is *returned*, not thrown: a Convex mutation is a transaction, so
 * throwing would roll back the very attempt counter that throttles the attack.
 * Every rejection also looks the same — unknown paste, unprotected paste, wrong
 * password — so the answer never confirms that a subdomain exists or that a
 * guess was close.
 */
export const unlock = mutation({
  args: {
    subdomain: v.string(),
    password: v.string(),
    /** Client identifier for throttling. The runtime passes the caller's IP. */
    client: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      unlockToken: v.string(),
      expiresAt: v.number(),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(v.literal("invalid"), v.literal("throttled")),
    }),
  ),
  handler: async (ctx, args) => {
    const invalid = { ok: false, reason: "invalid" } as const;
    const subdomain = args.subdomain.trim().toLowerCase();
    const paste =
      (await ctx.db
        .query("pastes")
        .withIndex("by_custom_subdomain", (q) =>
          q.eq("customSubdomain", subdomain),
        )
        .unique()) ?? (await byToken(ctx, subdomain));
    if (!paste?.passwordHash) return invalid;

    const now = Date.now();
    const client = args.client.slice(0, 64);
    const attempts = await ctx.db
      .query("unlockAttempts")
      .withIndex("by_paste_and_client", (q) =>
        q.eq("pasteId", paste._id).eq("client", client),
      )
      .unique();
    const live = attempts && attempts.resetAt > now ? attempts : null;

    if (live && live.count >= MAX_UNLOCK_ATTEMPTS) {
      // Safe to log: the paste and the source, never the attempted password.
      console.warn(
        `unlock throttled paste=${paste._id} client=${client} count=${live.count}`,
      );
      return { ok: false, reason: "throttled" } as const;
    }

    if (!(await verifyPassword(args.password, paste.passwordHash))) {
      const record = {
        pasteId: paste._id,
        client,
        count: (live?.count ?? 0) + 1,
        resetAt: live?.resetAt ?? now + UNLOCK_WINDOW_MS,
      };
      if (attempts)
        await ctx.db.replace("unlockAttempts", attempts._id, record);
      else await ctx.db.insert("unlockAttempts", record);
      return invalid;
    }

    if (attempts) await ctx.db.delete("unlockAttempts", attempts._id);

    // Self-cleaning: expired sessions for this paste go on the way past, so
    // the table never needs a sweep of its own.
    for (const session of await ctx.db
      .query("pasteUnlocks")
      .withIndex("by_paste", (q) => q.eq("pasteId", paste._id))
      .collect())
      if (session.expiresAt <= now)
        await ctx.db.delete("pasteUnlocks", session._id);

    const unlockToken = generateUnlockToken();
    const expiresAt = now + UNLOCK_TTL_MS;
    await ctx.db.insert("pasteUnlocks", {
      pasteId: paste._id,
      sessionHash: await sha256Hex(unlockToken),
      expiresAt,
    });
    return { ok: true, unlockToken, expiresAt } as const;
  },
});
