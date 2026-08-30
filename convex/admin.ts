// Moderation and abuse handling.
//
// The whole workflow is `npx convex run` against the internal functions below,
// authenticated by the deployment credentials the operator already holds. There
// is no moderation UI and no admin role, because a one-person product has
// exactly one moderator and a console is a login page, a role check and a
// permission model to get wrong. Give this a UI the day someone else moderates.
//
//   npx convex run admin:pending                                  # open reports
//   npx convex run admin:inspect '{"token":"abc123def456"}'       # investigate
//   npx convex run admin:disable '{"token":"abc123def456","reason":"phishing"}'
//   npx convex run admin:enable  '{"token":"abc123def456"}'
//   npx convex run admin:purge   '{"token":"abc123def456"}'       # delete for good
//   npx convex run admin:resolve '{"reportId":"...","resolution":"disabled"}'
//
// Disabling is the reversible action and the one to reach for first: the row
// and its stored bytes survive, so a mistake costs nothing and a real takedown
// still has the evidence behind it. `purge` is the irreversible one.
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { fail } from "./lib/validation";
import { enforce } from "./rateLimit";

const MAX_REASON_LENGTH = 1000;

/** Lookup by public token or custom subdomain — whichever the reporter had. */
async function findPaste(ctx: QueryCtx, token: string) {
  const value = token.trim().toLowerCase();
  return (
    (await ctx.db
      .query("pastes")
      .withIndex("by_custom_subdomain", (q) => q.eq("customSubdomain", value))
      .unique()) ??
    (await ctx.db
      .query("pastes")
      .withIndex("by_token", (q) => q.eq("token", token.trim()))
      .unique())
  );
}

async function requirePaste(ctx: QueryCtx, token: string) {
  const paste = await findPaste(ctx, token);
  if (!paste) fail("NOT_FOUND", "Paste not found.");
  return paste;
}

/**
 * Public intake, behind `POST /api/v1/abuse`. Unauthenticated on purpose — a
 * report is a favour, and putting a sign-up in front of one means never hearing
 * about the phishing page. Charged per reported paste so a single target cannot
 * be report-bombed, on top of the per-address limit the REST edge applies.
 *
 * Nothing about the reporter is stored: see the `abuseReports` table comment.
 */
export const report = mutation({
  args: { token: v.string(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requirePaste(ctx, args.token);
    await enforce(ctx, "abuse:report", `paste:${paste._id}`);

    const reason = args.reason.trim();
    if (!reason) fail("VALIDATION", "A reason is required.");

    await ctx.db.insert("abuseReports", {
      // The paste's canonical token, not what the reporter typed, so reports
      // about the same paste group whichever name it was reached by.
      token: paste.token,
      reason: reason.slice(0, MAX_REASON_LENGTH),
      createdAt: Date.now(),
    });
    return null;
  },
});

/** The moderation queue: reports nobody has closed yet, newest first. */
export const pending = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // The table only grows by hand-written reports, so a bounded scan of the
    // newest rows is cheaper than an index on a field with two values.
    const rows = await ctx.db
      .query("abuseReports")
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));
    return rows.filter((row) => row.resolvedAt === undefined);
  },
});

/** Closes one report. The note is for whoever reads the table next. */
export const resolve = internalMutation({
  args: { reportId: v.id("abuseReports"), resolution: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("abuseReports", args.reportId, {
      resolvedAt: Date.now(),
      resolution: args.resolution.slice(0, MAX_REASON_LENGTH),
    });
    return null;
  },
});

/**
 * Everything held about a paste that is useful for deciding whether it is
 * abusive, and nothing that is not: there is no publisher address anywhere in
 * the system to return, by design (`pasteViews` stores no visitor either).
 * `ownerId` is Clerk's `tokenIdentifier`, which is what an account is looked up
 * by in Clerk's own dashboard.
 */
export const inspect = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const paste = await requirePaste(ctx, args.token);
    const storage = await ctx.db.system.get("_storage", paste.storageId);
    const reports = await ctx.db
      .query("abuseReports")
      .withIndex("by_token", (q) => q.eq("token", paste.token))
      .collect();

    return {
      token: paste.token,
      customSubdomain: paste.customSubdomain,
      // Absent means anonymous: the update token is the only thing holding it.
      ownerId: paste.ownerId,
      filename: paste.filename,
      title: paste.title,
      contentType: paste.contentType,
      contentLength: paste.contentLength,
      // Identifies the exact bytes, so the same payload can be recognised
      // across pastes without storing a copy of it here.
      sha256: storage?.sha256,
      visibility: paste.visibility,
      viewsCount: paste.viewsCount,
      createdAt: paste.createdAt,
      updatedAt: paste.updatedAt,
      disabledAt: paste.disabledAt,
      disabledReason: paste.disabledReason,
      reports: reports.map(({ createdAt, reason, resolvedAt }) => ({
        createdAt,
        reason,
        resolvedAt,
      })),
    };
  },
});

/**
 * Takes a paste down. `resolveForRuntime` then withholds the storage URL, so
 * the wildcard origin answers `410 Gone` and the raw and preview endpoints stop
 * with it — one flag, every surface, no serving-layer change.
 */
export const disable = internalMutation({
  args: { token: v.string(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requirePaste(ctx, args.token);
    await ctx.db.patch("pastes", paste._id, {
      disabledAt: Date.now(),
      disabledReason: args.reason.slice(0, MAX_REASON_LENGTH),
    });
    return null;
  },
});

/** Undoes `disable`, for the report that turned out to be wrong. */
export const enable = internalMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requirePaste(ctx, args.token);
    await ctx.db.patch("pastes", paste._id, {
      disabledAt: undefined,
      disabledReason: undefined,
    });
    return null;
  },
});

/**
 * Administrative delete: the paste row and its stored bytes, with no caller
 * authorization and no update token. Irreversible — `disable` first unless the
 * content itself is the thing that must not exist.
 */
export const purge = internalMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paste = await requirePaste(ctx, args.token);
    await ctx.runMutation(internal.pastes.hardDelete, { pasteId: paste._id });
    return null;
  },
});
