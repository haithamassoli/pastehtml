// Fixed-window request throttling for the public REST API.
//
// ponytail: hand-rolled counter, mirroring `unlockAttempts` — one row per
// (bucket, client), rewritten in place rather than appended to. Two known
// ceilings. It admits a small over-count under concurrent requests for the same
// client, and a window boundary lets a burst of 2× `limit` through; swap in
// @convex-dev/rate-limiter when either matters. And enforcement is advisory:
// `pastes.create` is itself a public Convex mutation, so this throttles the
// documented API surface, not the backend. Milestone 15 owns the global pass.
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

/** Server-side limits. Never accepted from the caller, who would raise them. */
const BUCKETS = {
  "api:read": { limit: 240, windowMs: 60_000 },
  "api:write": { limit: 60, windowMs: 60_000 },
} as const;

export const bucketValidator = v.union(
  v.literal("api:read"),
  v.literal("api:write"),
);

const SWEEP_BATCH = 200;

/**
 * Charges one request to `client` in `bucket`. Public because anonymous API
 * callers have no credential to present; `client` is supplied by our own route
 * handler, the same trust model as `pastes.unlock`.
 */
export const consume = mutation({
  args: { bucket: bucketValidator, client: v.string() },
  returns: v.object({
    ok: v.boolean(),
    limit: v.number(),
    remaining: v.number(),
    resetAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const { limit, windowMs } = BUCKETS[args.bucket];
    const now = Date.now();
    const key = `${args.bucket}:${args.client.slice(0, 100)}`;

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const live = existing && existing.resetAt > now ? existing : null;

    const count = (live?.count ?? 0) + 1;
    const resetAt = live?.resetAt ?? now + windowMs;
    const record = { key, count, resetAt };
    if (existing) await ctx.db.replace("rateLimits", existing._id, record);
    else await ctx.db.insert("rateLimits", record);

    return {
      ok: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  },
});

/** Drops windows that have long since reset, so the table stays bounded. */
export const sweep = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoff = Date.now();
    const page = await ctx.db
      .query("rateLimits")
      .paginate({ cursor: args.cursor ?? null, numItems: SWEEP_BATCH });

    for (const row of page.page)
      if (row.resetAt <= cutoff) await ctx.db.delete("rateLimits", row._id);

    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.rateLimit.sweep, {
        cursor: page.continueCursor,
      });
    return null;
  },
});
