// Reading side of paste analytics. Collection is `pastes.recordView`, called
// from the wildcard runtime after the response is already on the wire; nothing
// in this file is ever on a public request path.
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { requireCurrentUser, requireOwner } from "./lib/auth";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long an individual view row lives. 90 days is long enough to see a
 * season and short enough that we are not sitting on a year of anyone's
 * browsing. `pastes.viewsCount` is never swept, so the lifetime total survives
 * the rows it was counted from.
 */
export const RETENTION_MS = 90 * DAY_MS;

/** Days of history the dashboard charts. */
const WINDOW_DAYS = 30;

/**
 * ponytail: the breakdown is the window's rows bucketed in JavaScript, so a
 * paste with more views than this in 30 days gets a breakdown of its most
 * recent ones only — flagged as `truncated`, and the headline total stays
 * exact because it comes off the counter, not from here. @convex-dev/aggregate
 * is the upgrade when a paste is popular enough for that to matter.
 */
const MAX_ROWS = 2000;

const SWEEP_BATCH = 500;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The commonest values of one column, biggest first. */
function top(
  rows: readonly Doc<"pasteViews">[],
  pick: (row: Doc<"pasteViews">) => string | undefined,
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = pick(row);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value, views]) => ({ value, views }));
}

/**
 * Everything the paste detail page charts, in one subscription. Owner-only:
 * `requireOwner` rejects a stranger's token here rather than anywhere upstream,
 * so no serving surface has to decide who may read what.
 */
export const forPaste = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const paste = await ctx.db
      .query("pastes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    requireOwner(user, paste);

    const now = Date.now();
    // Epoch milliseconds align to UTC midnight, so flooring is the day bucket.
    const since = (Math.floor(now / DAY_MS) - WINDOW_DAYS + 1) * DAY_MS;
    const rows = await ctx.db
      .query("pasteViews")
      .withIndex("by_paste_and_timestamp", (q) =>
        q.eq("pasteId", paste._id).gte("timestamp", since),
      )
      .order("desc")
      .take(MAX_ROWS);

    // Zero-filled, so the chart gets a bar per day instead of gaps.
    const byDay = Array.from({ length: WINDOW_DAYS }, (_, day) => ({
      date: isoDay(since + day * DAY_MS),
      views: 0,
    }));
    const dayIndex = new Map(byDay.map((day, at) => [day.date, at]));
    for (const row of rows) {
      const at = dayIndex.get(isoDay(row.timestamp));
      if (at !== undefined) byDay[at].views++;
    }

    return {
      total: paste.viewsCount,
      last24h: rows.filter((row) => row.timestamp > now - DAY_MS).length,
      last7d: rows.filter((row) => row.timestamp > now - 7 * DAY_MS).length,
      windowDays: WINDOW_DAYS,
      retentionDays: RETENTION_MS / DAY_MS,
      byDay,
      referrers: top(rows, (row) => row.referrer),
      countries: top(rows, (row) => row.country),
      browsers: top(rows, (row) => row.userAgentFamily),
      truncated: rows.length === MAX_ROWS,
    };
  },
});

/**
 * Retention. Batched through the index so a run reads only expired rows, and
 * chained through the scheduler because a mutation is one transaction.
 */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;
    const expired = await ctx.db
      .query("pasteViews")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .take(SWEEP_BATCH);

    for (const row of expired) await ctx.db.delete("pasteViews", row._id);

    if (expired.length === SWEEP_BATCH)
      await ctx.scheduler.runAfter(0, internal.analytics.sweep, {});
    return null;
  },
});
