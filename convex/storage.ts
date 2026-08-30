// Convex File Storage helpers. Uploaded bytes are stored verbatim — nothing in
// this module inspects, rewrites or sanitizes HTML.
import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  fail,
  validateContentLength,
  validateContentType,
} from "./lib/validation";

/** How long an unreferenced upload is kept before the sweep treats it as abandoned. */
export const ORPHAN_GRACE_MS = 60 * 60 * 1000;
const SWEEP_BATCH = 100;

/**
 * Signed URL for a direct browser-to-Convex upload, so HTML never travels
 * through a Vercel function. Public because anonymous publishing is a product
 * requirement; abuse controls are rate limits (Milestone 15), not auth.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

/**
 * Authoritative size and type of an uploaded object, read from storage rather
 * than taken from the caller — a client-declared length would defeat the upload
 * limit entirely. `declaredContentType` is only a fallback for server-side
 * stores that carry no Content-Type.
 */
export async function describeUpload(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
  declaredContentType: string,
) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) fail("NOT_FOUND", "Uploaded file not found.");
  return {
    contentType: validateContentType(
      metadata.contentType ?? declaredContentType,
    ),
    contentLength: validateContentLength(metadata.size),
    sha256: metadata.sha256,
  };
}

/**
 * Refuses a storage id already attached to another paste. Without this, one
 * account could point a paste at another account's file and delete it.
 */
export async function requireUnreferenced(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
  self?: Id<"pastes">,
) {
  const existing = await ctx.db
    .query("pastes")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .first();
  if (existing && existing._id !== self)
    fail("CONFLICT", "That upload is already attached to a paste.");
}

/** Deleting a file that is already gone is a no-op, never an error. */
export async function deleteFile(ctx: MutationCtx, storageId: Id<"_storage">) {
  if (await ctx.db.system.get("_storage", storageId))
    await ctx.storage.delete(storageId);
}

/**
 * Deletes uploads no paste references — abandoned or failed browser uploads,
 * and files left behind by a create that threw after the bytes landed. Runs in
 * bounded batches, rescheduling itself with the pagination cursor.
 */
export const sweepOrphans = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - ORPHAN_GRACE_MS;
    const page = await ctx.db.system
      .query("_storage")
      .paginate({ cursor: args.cursor ?? null, numItems: SWEEP_BATCH });

    for (const file of page.page) {
      if (file._creationTime > cutoff) continue;
      const paste = await ctx.db
        .query("pastes")
        .withIndex("by_storage", (q) => q.eq("storageId", file._id))
        .first();
      if (!paste) await ctx.storage.delete(file._id);
    }

    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.storage.sweepOrphans, {
        cursor: page.continueCursor,
      });
    return null;
  },
});
