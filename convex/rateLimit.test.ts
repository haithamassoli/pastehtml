// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  MAX_UNLOCK_ATTEMPTS,
  MAX_UNLOCK_ATTEMPTS_PER_PASTE,
  UNLOCK_WINDOW_MS,
} from "./pastes";
import { codeOf, createPaste, users } from "../test/convex-helpers";

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

// The layer that matters: `enforce`, charged inside the mutations themselves.
// The browser calls `pastes.create` directly, so nothing an edge limiter does
// covers publishing — these are the limits that cannot be routed around.
describe("rateLimit.enforce", () => {
  const CREATE_LIMIT = 30;

  it("caps anonymous creation on one shared budget", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < CREATE_LIMIT; i++) await createPaste(t);

    expect(await codeOf(createPaste(t))).toBe("RATE_LIMITED");
    // A rejection rolls its own increment back, but the window stays spent —
    // the counter reached the limit through creates that committed.
    expect(await codeOf(createPaste(t))).toBe("RATE_LIMITED");

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 11_000);
      await createPaste(t);
    } finally {
      vi.useRealTimers();
    }
  });

  it("charges an account to itself, not to the anonymous pool", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    for (let i = 0; i < CREATE_LIMIT; i++) await createPaste(t);

    // Anonymous publishing is a global bucket, so it is a denial-of-service
    // surface. A signed-in author must not be caught by someone else's flood.
    expect(await codeOf(createPaste(t))).toBe("RATE_LIMITED");
    await createPaste(alice);
  });

  it("charges writes to the paste being written, not globally", async () => {
    const t = convexTest(schema, modules);
    const first = await createPaste(t);
    const second = await createPaste(t);
    const patch = (
      paste: { token: string; updateToken?: string },
      title: string,
    ) =>
      t.mutation(api.pastes.update, {
        token: paste.token,
        updateToken: paste.updateToken,
        title,
      });

    for (let i = 0; i < 30; i++) await patch(first, `title ${i}`);

    expect(await codeOf(patch(first, "once more"))).toBe("RATE_LIMITED");
    await patch(second, "unaffected");
  });
});

// The password throttle is the same lesson as the one above: `pastes.unlock` is
// public and `client` is a string the caller picks, so the per-client cap alone
// is a suggestion. The per-paste cap is what actually binds.
describe("unlock throttling", () => {
  const PASSWORD = "correct horse battery";

  async function protectedPaste() {
    const t = convexTest(schema, modules);
    const { token, updateToken } = await createPaste(t);
    await t.mutation(api.pastes.setPassword, {
      token,
      updateToken,
      password: PASSWORD,
    });
    const guess = (password: string, client: string) =>
      t.mutation(api.pastes.unlock, { subdomain: token, password, client });
    return { t, token, guess };
  }

  it("caps a paste under attack however the caller labels itself", async () => {
    const { guess } = await protectedPaste();

    // A fresh identifier per guess walks straight past the per-client cap.
    for (let i = 0; i < MAX_UNLOCK_ATTEMPTS_PER_PASTE; i++)
      expect(await guess(`guess ${i}`, `attacker-${i}`)).toEqual({
        ok: false,
        reason: "invalid",
      });

    expect(await guess("one more", "attacker-fresh")).toEqual({
      ok: false,
      reason: "throttled",
    });
    // And past the cap the right password is refused too, which is the cost of
    // the cap binding at all: the paste is shut for 15 minutes, not forever.
    expect(await guess(PASSWORD, "an-honest-visitor")).toEqual({
      ok: false,
      reason: "throttled",
    });
  });

  it("still gives one client its own smaller budget", async () => {
    const { guess } = await protectedPaste();

    for (let i = 0; i < MAX_UNLOCK_ATTEMPTS; i++)
      expect(await guess("wrong", "1.2.3.4")).toEqual({
        ok: false,
        reason: "invalid",
      });

    expect(await guess(PASSWORD, "1.2.3.4")).toEqual({
      ok: false,
      reason: "throttled",
    });
    // The per-paste cap is nowhere near spent, so a second visitor is fine.
    expect(await guess(PASSWORD, "5.6.7.8")).toMatchObject({ ok: true });
  });

  it("sweeps attempt windows that have reset", async () => {
    const { t, guess } = await protectedPaste();
    await guess("wrong", "1.2.3.4");
    const rows = () => t.run((ctx) => ctx.db.query("unlockAttempts").collect());

    // One row for the client, one for the paste.
    await t.mutation(internal.pastes.sweepUnlockAttempts, {});
    expect(await rows()).toHaveLength(2);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + UNLOCK_WINDOW_MS + 1_000);
      await t.mutation(internal.pastes.sweepUnlockAttempts, {});
    } finally {
      vi.useRealTimers();
    }
    // Without this cron a guesser minting a fresh `client` per attempt grows
    // the table for good.
    expect(await rows()).toHaveLength(0);
  });
});
