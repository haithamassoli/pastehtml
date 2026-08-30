import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireCurrentUser, requireOwner } from "./lib/auth";
import { validateFolderName } from "./lib/validation";

const DETACH_BATCH = 200;

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("folders"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("folders", {
      ownerId: user.id,
      name: validateFolderName(args.name),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { folderId: v.id("folders"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    requireOwner(user, await ctx.db.get("folders", args.folderId));
    await ctx.db.patch("folders", args.folderId, {
      name: validateFolderName(args.name),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    return await ctx.db
      .query("folders")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.id))
      .order("desc")
      .take(Math.min(args.limit ?? 100, 500));
  },
});

export const get = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const folder = await ctx.db.get("folders", args.folderId);
    requireOwner(user, folder);
    return folder;
  },
});

/**
 * Deleting a folder never deletes its pastes — they are detached in the
 * background and stay reachable at their public URLs.
 */
export const remove = mutation({
  args: { folderId: v.id("folders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const folder = await ctx.db.get("folders", args.folderId);
    requireOwner(user, folder);
    await ctx.db.delete("folders", args.folderId);
    await ctx.scheduler.runAfter(0, internal.folders.detachPastes, {
      folderId: args.folderId,
    });
    return null;
  },
});

/** Batched so a folder with thousands of pastes stays within one transaction. */
export const detachPastes = internalMutation({
  args: { folderId: v.id("folders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("pastes")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .take(DETACH_BATCH);
    const now = Date.now();
    for (const paste of batch) {
      await ctx.db.patch("pastes", paste._id, {
        folderId: undefined,
        updatedAt: now,
      });
    }
    if (batch.length === DETACH_BATCH) {
      await ctx.scheduler.runAfter(0, internal.folders.detachPastes, args);
    }
    return null;
  },
});

// Moving a paste in or out of a folder is `pastes.update({ token, folderId })`
// (`folderId: null` removes it) — one code path, one ownership check.
