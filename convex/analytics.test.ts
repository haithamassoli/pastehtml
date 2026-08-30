// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { RETENTION_MS } from "./analytics";
import type { Id } from "./_generated/dataModel";
import { codeOf, createPaste, users } from "../test/convex-helpers";

const modules = import.meta.glob("./**/*.ts");

const DAY_MS = 24 * 60 * 60 * 1000;

function setup() {
  const t = convexTest(schema, modules);
  return { t, ...users(t) };
}

/** A view at an arbitrary past instant, which `recordView` cannot express. */
const backdate = (
  t: ReturnType<typeof setup>["t"],
  pasteId: Id<"pastes">,
  timestamp: number,
  fields: { country?: string; referrer?: string } = {},
) =>
  t.run((ctx) =>
    ctx.db.insert("pasteViews", { pasteId, timestamp, ...fields }),
  );

describe("collection", () => {
  it("increments the total and writes one row per view", async () => {
    const { t, alice } = setup();
    const { pasteId, token } = await createPaste(alice);

    await t.mutation(api.pastes.recordView, {
      token,
      referrer: "https://news.example.com/thread?reader=ada",
      country: "pt",
      userAgentFamily: "firefox",
    });

    const stats = await alice.query(api.analytics.forPaste, { token });
    expect(stats.total).toBe(1);
    expect(stats.last24h).toBe(1);
    expect(stats.referrers).toEqual([{ value: "news.example.com", views: 1 }]);
    expect(stats.countries).toEqual([{ value: "PT", views: 1 }]);
    expect(stats.browsers).toEqual([{ value: "firefox", views: 1 }]);

    // The path and query of the referring URL are dropped, never stored.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("pasteViews").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].pasteId).toBe(pasteId);
      expect(rows[0].referrer).toBe("news.example.com");
    });
  });

  it("drops a country that is not a two-letter code", async () => {
    const { t, alice } = setup();
    const { token } = await createPaste(alice);

    await t.mutation(api.pastes.recordView, { token, country: "Portugal" });

    expect(
      (await alice.query(api.analytics.forPaste, { token })).countries,
    ).toEqual([]);
  });
});

describe("analytics.forPaste", () => {
  it("buckets views by UTC day and zero-fills the rest of the window", async () => {
    const { t, alice } = setup();
    const { pasteId, token } = await createPaste(alice);
    const now = Date.now();

    await t.mutation(api.pastes.recordView, { token });
    await t.mutation(api.pastes.recordView, { token });
    await backdate(t, pasteId, now - 3 * DAY_MS);
    // Older than the charted window: counted in the total, not in the chart.
    await backdate(t, pasteId, now - 40 * DAY_MS);

    const stats = await alice.query(api.analytics.forPaste, { token });

    expect(stats.byDay).toHaveLength(stats.windowDays);
    expect(stats.byDay.at(-1)).toEqual({
      date: new Date(now).toISOString().slice(0, 10),
      views: 2,
    });
    expect(stats.byDay.at(-4)!.views).toBe(1);
    expect(stats.byDay.reduce((sum, day) => sum + day.views, 0)).toBe(3);
    expect(stats.last7d).toBe(3);
    expect(stats.last24h).toBe(2);
    expect(stats.truncated).toBe(false);
    // Only `recordView` moves the counter, so the backdated rows are not in it.
    expect(stats.total).toBe(2);
  });

  it("counts only its own paste", async () => {
    const { t, alice } = setup();
    const mine = await createPaste(alice);
    const other = await createPaste(alice);

    await t.mutation(api.pastes.recordView, { token: other.token });

    expect(
      (await alice.query(api.analytics.forPaste, { token: mine.token })).total,
    ).toBe(0);
  });

  it("refuses a stranger and a signed-out caller", async () => {
    const { t, alice, bob } = setup();
    const { token } = await createPaste(alice);

    expect(await codeOf(bob.query(api.analytics.forPaste, { token }))).toBe(
      "FORBIDDEN",
    );
    expect(await codeOf(t.query(api.analytics.forPaste, { token }))).toBe(
      "UNAUTHORIZED",
    );
  });

  it("refuses an anonymous paste, which has no owner to authorize", async () => {
    const { t, alice } = setup();
    const { token } = await createPaste(t);

    expect(await codeOf(alice.query(api.analytics.forPaste, { token }))).toBe(
      "FORBIDDEN",
    );
  });
});

describe("analytics.sweep", () => {
  it("drops rows past the retention window and keeps the total", async () => {
    const { t, alice } = setup();
    const { pasteId, token } = await createPaste(alice);
    const now = Date.now();

    await t.mutation(api.pastes.recordView, { token });
    await backdate(t, pasteId, now - RETENTION_MS - DAY_MS);

    await t.mutation(internal.analytics.sweep, {});

    await t.run(async (ctx) => {
      const rows = await ctx.db.query("pasteViews").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].timestamp).toBeGreaterThan(now - DAY_MS);
    });
    // The lifetime counter is never rewound by retention.
    expect((await alice.query(api.analytics.forPaste, { token })).total).toBe(
      1,
    );
  });
});
