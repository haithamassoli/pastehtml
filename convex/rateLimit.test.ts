// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const WRITE_LIMIT = 60;

describe("rateLimit.consume", () => {
  it("counts down to the limit, then refuses, per client", async () => {
    const t = convexTest(schema, modules);
    const consume = (client: string) =>
      t.mutation(api.rateLimit.consume, { bucket: "api:write", client });

    let last = await consume("ip:1.2.3.4");
    expect(last).toMatchObject({ ok: true, limit: WRITE_LIMIT, remaining: 59 });

    for (let i = 1; i < WRITE_LIMIT; i++) last = await consume("ip:1.2.3.4");
    expect(last).toMatchObject({ ok: true, remaining: 0 });

    expect(await consume("ip:1.2.3.4")).toMatchObject({
      ok: false,
      remaining: 0,
    });

    // A second client has its own budget.
    expect(await consume("ip:5.6.7.8")).toMatchObject({ ok: true });
  });

  it("keeps buckets independent and reopens after the window", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i <= WRITE_LIMIT; i++)
      await t.mutation(api.rateLimit.consume, {
        bucket: "api:write",
        client: "ip:1.1.1.1",
      });

    // Reads are a different bucket with a wider limit.
    expect(
      await t.mutation(api.rateLimit.consume, {
        bucket: "api:read",
        client: "ip:1.1.1.1",
      }),
    ).toMatchObject({ ok: true, limit: 240 });

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 61_000);
      expect(
        await t.mutation(api.rateLimit.consume, {
          bucket: "api:write",
          client: "ip:1.1.1.1",
        }),
      ).toMatchObject({ ok: true, remaining: WRITE_LIMIT - 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("sweeps windows that have already reset", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.rateLimit.consume, {
      bucket: "api:write",
      client: "ip:9.9.9.9",
    });

    await t.mutation(internal.rateLimit.sweep, {});
    expect(
      await t.run((ctx) => ctx.db.query("rateLimits").collect()),
    ).toHaveLength(1);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 61_000);
      await t.mutation(internal.rateLimit.sweep, {});
    } finally {
      vi.useRealTimers();
    }
    expect(
      await t.run((ctx) => ctx.db.query("rateLimits").collect()),
    ).toHaveLength(0);
  });
});
