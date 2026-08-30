// Fixed-window throttling, in two layers.
//
// The edge layer is `consume` below, charged once per request by `lib/api.ts`
// for every REST and MCP call, and answered with `RateLimit-*` headers.
//
// The Convex layer is `enforce`, charged inside the mutations themselves. It
// exists because the edge layer is advisory: the browser publishes by calling
// the public `pastes.create` mutation directly (`lib/upload.ts`), so a REST
// limiter never sees the front door. Only what is charged in here cannot be
// routed around.
//
// ponytail: hand-rolled counter, mirroring `unlockAttempts` — one row per
// (bucket, client), rewritten in place rather than appended to. Three known
// ceilings. It admits a small over-count under concurrent requests for the same
// client; a window boundary lets a burst of 2× `limit` through; and every
// anonymous creation charges the same row, so that bucket serializes under OCC
// contention rather than scaling. @convex-dev/rate-limiter shards counters for
// exactly that reason — swap it in when any of the three costs something.
import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { fail } from "./lib/validation";

/** Server-side limits. Never accepted from the caller, who would raise them. */
const BUCKETS = {
  "api:read": { limit: 240, windowMs: 60_000 },
  "api:write": { limit: 60, windowMs: 60_000 },
  // Charged in Convex, so no surface can skip them. Short windows on purpose:
  // the anonymous creation bucket is global (a Convex mutation cannot see a
  // client address), so a saturated window is a denial of service against
  // everyone publishing anonymously. Ten seconds bounds how long that lasts
  // while keeping the same sustained ceiling a per-minute window would.
  "paste:create": { limit: 30, windowMs: 10_000 },
  "paste:write": { limit: 30, windowMs: 10_000 },
  "abuse:report": { limit: 5, windowMs: 60_000 },
} as const;

export type Bucket = keyof typeof BUCKETS;

/**
 * The buckets `consume` will charge. Deliberately not every bucket: the
 * mutation is public, so anything nameable here can be drained by a stranger,
 * and the `paste:*` budgets are shared.
 */
export const bucketValidator = v.union(
  v.literal("api:read"),
  v.literal("api:write"),
);

const SWEEP_BATCH = 200;

type Charge = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

/** Counts one operation against `(bucket, client)` and reports the window. */
async function charge(
  ctx: MutationCtx,
  bucket: Bucket,
  client: string,
): Promise<Charge> {
  const { limit, windowMs } = BUCKETS[bucket];
  const now = Date.now();
  const key = `${bucket}:${client.slice(0, 100)}`;

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
}

/**
 * Charges one operation and rejects it when the window is spent.
 *
 * Throwing is safe here, unlike in `pastes.unlock`: the rejection rolls back
 * this increment, but the counter only ever reached `limit` through operations
 * that committed, so it stays pinned there until the window resets. The flip
 * side is that an operation which fails for some other reason is never charged
 * — invalid requests are free, and Convex's own platform limits are what absorb
 * a flood of those.
 */
export async function enforce(
  ctx: MutationCtx,
  bucket: Bucket,
  client: string,
): Promise<void> {
  const { ok } = await charge(ctx, bucket, client);
  if (!ok) fail("RATE_LIMITED", "Too many requests. Slow down.");
}

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
  handler: async (ctx, args) => await charge(ctx, args.bucket, args.client),
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
