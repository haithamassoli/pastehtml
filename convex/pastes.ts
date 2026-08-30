import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { userAgentFamilyValidator } from "./schema";
import {
  authorizePasteWrite,
  getCurrentUser,
  requireCurrentUser,
  requireOwner,
  requireScope,
  requireUpdateToken,
} from "./lib/auth";
import {
  generatePasteToken,
  generateUnlockToken,
  generateUpdateToken,
  sha256Hex,
} from "./lib/tokens";
import { hashPassword, validatePassword, verifyPassword } from "./lib/password";
import { enforce } from "./rateLimit";
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
    // Present only on a paste taken down for abuse, so the owner is not left
    // guessing why their URL stopped answering.
    disabledAt: paste.disabledAt,
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

/**
 * Validates a requested subdomain and proves it is still free.
 *
 * This is where the assignment race is won: a Convex mutation is one
 * serializable transaction, so the availability read below and the write that
 * follows it commit together or not at all, and OCC aborts and retries any
 * mutation whose reads were invalidated by a commit in between. Two callers
 * racing for the same name therefore cannot both see it free — the loser
 * re-runs, reads the winner's row and fails with `CONFLICT`. No reservation
 * row and no lock, as long as this read stays inside the mutation that writes.
 */
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

/**
 * Who a mutation on an existing paste is charged to. An owned paste is charged
 * to its account; an anonymous one to itself, because its update token is the
 * only thing holding it and there is no identity behind it to name. Both keep
 * the budget local, so no one caller can spend another's.
 */
const writeClient = (paste: Doc<"pastes">) =>
  paste.ownerId ? `user:${paste.ownerId}` : `paste:${paste._id}`;

/**
 * The credentials any surface may present alongside a paste mutation. The
 * browser sends neither and is identified by its Clerk session; the REST API
 * forwards whichever the request carried.
 */
const credentialArgs = {
  updateToken: v.optional(v.string()),
  apiKey: v.optional(v.string()),
};

export const create = mutation({
  args: {
    ...credentialArgs,
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
    const user = await getCurrentUser(ctx, { apiKey: args.apiKey });
    if (user) requireScope(user, "pastes:write");
    // The unbypassable limit: the browser reaches this mutation directly, so
    // the REST limiter never sees it. An account is charged to itself; every
    // anonymous author shares one global budget, because a Convex mutation
    // cannot see a client address and a caller-supplied one would be a lie.
    await enforce(ctx, "paste:create", user ? `user:${user.id}` : "anon");
    const now = Date.now();

    // Filing into a folder edits folder membership, so it needs the folder
    // scope on top of the paste one — the same rule `update` applies below.
    if (args.folderId) {
      if (user) requireScope(user, "folders:write");
      await requireOwnFolder(ctx, args.folderId, user?.id);
    }
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

/**
 * Availability for the dashboard's live indicator. A rejection comes back as a
 * value rather than a throw, because half a typed name is not an error worth
 * an error boundary. `token` is the paste doing the asking, so its own current
 * subdomain reads as available — the same no-op re-assign `update` allows.
 *
 * Advisory only: the answer can be stale by the time the owner submits, and
 * `update` re-checks inside the transaction that actually writes.
 */
export const checkSubdomain = query({
  args: { subdomain: v.string(), token: v.optional(v.string()) },
  returns: v.object({ available: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const self = args.token ? await byToken(ctx, args.token) : null;
    try {
      await claimSubdomain(ctx, args.subdomain, self?._id);
      return { available: true };
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      return {
        available: false,
        reason: (error.data as { message: string }).message,
      };
    }
  },
});

export const listByOwner = query({
  args: { limit: v.optional(v.number()), apiKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, { apiKey: args.apiKey });
    requireScope(user, "pastes:read");
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
    ...credentialArgs,
    token: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    filename: v.optional(v.string()),
    // Assign, change and remove are all this one field: a value claims it,
    // `null` gives it up. Authorized by `authorizePasteWrite` below, so an
    // anonymous paste's update-token holder may claim a name too — the token is
    // that paste's only credential, and refusing them would just push vanity
    // names behind a sign-up.
    // ponytail: which means anonymous squatting is possible. Milestone 15's
    // abuse pass is where to meter it, not here.
    customSubdomain: v.optional(v.union(v.string(), v.null())),
    // `null` removes the paste from its folder.
    folderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requireByToken(ctx, args.token);
    const user = await authorizePasteWrite(ctx, paste, args);
    await enforce(ctx, "paste:write", writeClient(paste));

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
      // What is being edited here is folder membership, so a key scoped to
      // pastes alone cannot refile its owner's pastes.
      if (user) requireScope(user, "folders:write");
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
    ...credentialArgs,
    token: v.string(),
    storageId: v.id("_storage"),
    contentType: v.string(),
    filename: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requireByToken(ctx, args.token);
    await authorizePasteWrite(ctx, paste, args);
    await enforce(ctx, "paste:write", writeClient(paste));
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
  args: { ...credentialArgs, token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requireByToken(ctx, args.token);
    await authorizePasteWrite(ctx, paste, args, "pastes:delete");
    await enforce(ctx, "paste:write", writeClient(paste));
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
/**
 * The referring site, never the referring page. A full Referer URL carries a
 * path and a query string that can name the visitor or what they searched for;
 * the host answers the only question the dashboard asks of it.
 */
function referrerHost(referrer?: string): string | undefined {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).host || undefined;
  } catch {
    // Already a bare host, or junk. Bounded either way.
    return referrer.slice(0, 100).trim() || undefined;
  }
}

export const recordView = mutation({
  args: {
    token: v.string(),
    // ISO 3166-1 alpha-2, from the edge. Nothing narrower is asked for, and
    // the address it was derived from never reaches here.
    country: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgentFamily: v.optional(userAgentFamilyValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await byToken(ctx, args.token);
    if (!paste) return null;
    const country = args.country?.trim().toUpperCase();
    await ctx.db.patch("pastes", paste._id, {
      viewsCount: paste.viewsCount + 1,
    });
    await ctx.db.insert("pasteViews", {
      pasteId: paste._id,
      timestamp: Date.now(),
      // Normalized here rather than at the caller: this is a public mutation,
      // so the serving route is not the only thing that can reach it.
      country: country && /^[A-Z]{2}$/.test(country) ? country : undefined,
      referrer: referrerHost(args.referrer),
      userAgentFamily: args.userAgentFamily,
    });
    return null;
  },
});

/** Owner-only detail view, used by the dashboard. */
export const getOwned = query({
  args: { token: v.string(), apiKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, { apiKey: args.apiKey });
    const paste = await requireByToken(ctx, args.token);
    requireOwner(user, paste);
    requireScope(user, "pastes:read");
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
 * A paste disabled for abuse comes back the same way — and because the URL is
 * withheld rather than the row hidden, every surface that serves stored bytes
 * stops without each one needing to know about the flag.
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
      // Taken down by `admin.disable`. No password will open it.
      disabled: v.boolean(),
      contentType: v.string(),
      contentLength: v.number(),
      // Convex's stored digest, used verbatim as the ETag.
      sha256: v.string(),
      // `null` if the stored object has gone missing, or the paste is locked
      // or disabled.
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

    const disabled = paste.disabledAt !== undefined;
    const locked =
      paste.visibility === "protected" &&
      !(await hasValidUnlock(ctx, paste._id, args.unlockToken));

    const metadata =
      locked || disabled
        ? null
        : await ctx.db.system.get("_storage", paste.storageId);
    return {
      token: paste.token,
      filename: paste.filename,
      visibility: paste.visibility,
      locked,
      disabled,
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

// Two caps, because one is not enough. `unlock` is a public Convex mutation and
// `client` is a string the caller picks — the browser bundle carries the Convex
// URL, so an attacker calling the backend directly invents a fresh identifier
// per guess and the per-client cap never trips. An edge-supplied identifier is
// not a security boundary; the per-paste cap is the one that binds, because it
// counts failures against the paste itself whatever the caller calls itself.
//
// ponytail: the per-client cap stays, and stays first, because it gives an
// honest visitor a budget of their own rather than a share of a pool an
// attacker is draining. The trade-off in the per-paste cap is availability: a
// paste under attack is closed to everyone, correct password included, until
// the window resets — 100 wrong guesses in 15 minutes is far more than a shared
// link's honest typo rate, and 15 minutes is the whole of the outage.
export const MAX_UNLOCK_ATTEMPTS = 10;
export const MAX_UNLOCK_ATTEMPTS_PER_PASTE = 100;
export const UNLOCK_WINDOW_MS = 15 * 60 * 1000;

/**
 * The client column for the per-paste cap. A caller who sends this literally
 * only charges their own guesses twice, which is not a trade anyone wants.
 */
const ANY_CLIENT = "*";

const attemptRow = (ctx: QueryCtx, pasteId: Id<"pastes">, client: string) =>
  ctx.db
    .query("unlockAttempts")
    .withIndex("by_paste_and_client", (q) =>
      q.eq("pasteId", pasteId).eq("client", client),
    )
    .unique();

/** Failures in the window that is currently open; 0 once it has reset. */
async function failureCount(
  ctx: QueryCtx,
  pasteId: Id<"pastes">,
  client: string,
  now: number,
): Promise<number> {
  const row = await attemptRow(ctx, pasteId, client);
  return row && row.resetAt > now ? row.count : 0;
}

/** Adds one failure, opening a new window if the last has already reset. */
async function recordFailure(
  ctx: MutationCtx,
  pasteId: Id<"pastes">,
  client: string,
  now: number,
): Promise<void> {
  const existing = await attemptRow(ctx, pasteId, client);
  const live = existing && existing.resetAt > now ? existing : null;
  const record = {
    pasteId,
    client,
    count: (live?.count ?? 0) + 1,
    resetAt: live?.resetAt ?? now + UNLOCK_WINDOW_MS,
  };
  if (existing) await ctx.db.replace("unlockAttempts", existing._id, record);
  else await ctx.db.insert("unlockAttempts", record);
}

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
  args: { ...credentialArgs, token: v.string(), password: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requireByToken(ctx, args.token);
    await authorizePasteWrite(ctx, paste, args);
    await enforce(ctx, "paste:write", writeClient(paste));

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
  args: { ...credentialArgs, token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requireByToken(ctx, args.token);
    await authorizePasteWrite(ctx, paste, args);
    await enforce(ctx, "paste:write", writeClient(paste));

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
    const mine = await failureCount(ctx, paste._id, client, now);
    const anyone = await failureCount(ctx, paste._id, ANY_CLIENT, now);

    if (
      mine >= MAX_UNLOCK_ATTEMPTS ||
      anyone >= MAX_UNLOCK_ATTEMPTS_PER_PASTE
    ) {
      // Safe to log: the paste and the source, never the attempted password.
      console.warn(
        `unlock throttled paste=${paste._id} client=${client} mine=${mine} anyone=${anyone}`,
      );
      return { ok: false, reason: "throttled" } as const;
    }

    if (!(await verifyPassword(args.password, paste.passwordHash))) {
      await recordFailure(ctx, paste._id, client, now);
      await recordFailure(ctx, paste._id, ANY_CLIENT, now);
      return invalid;
    }

    // Only this client's budget is returned. The per-paste window is left to
    // expire on its own: past its cap nothing can succeed, so a success can
    // never be what clears it, and treating one correct password as proof that
    // the flood is over would just hand the attacker the reset.
    const attempts = await attemptRow(ctx, paste._id, client);
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

/**
 * Drops attempt windows that have already reset. `rateLimits` has the same
 * cron, and for the same reason: the per-paste cap counts a caller-supplied
 * `client`, so a guesser inventing a fresh one per attempt grows this table
 * without bound. Batched like the other sweeps.
 */
export const sweepUnlockAttempts = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoff = Date.now();
    const page = await ctx.db
      .query("unlockAttempts")
      .paginate({ cursor: args.cursor ?? null, numItems: 200 });

    for (const row of page.page)
      if (row.resetAt <= cutoff) await ctx.db.delete("unlockAttempts", row._id);

    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.pastes.sweepUnlockAttempts, {
        cursor: page.continueCursor,
      });
    return null;
  },
});
