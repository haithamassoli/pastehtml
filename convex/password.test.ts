// @vitest-environment edge-runtime
// Password protection end to end inside Convex: enabling, unlocking, session
// scope and expiry, replacement, removal, authorization and throttling.
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import {
  MAX_UNLOCK_ATTEMPTS,
  MAX_UNLOCK_SESSIONS,
  UNLOCK_TTL_MS,
} from "./pastes";
import { codeOf, createPaste, users } from "../test/convex-helpers";

const modules = import.meta.glob("./**/*.ts");

const PASSWORD = "correct horse battery";

/** An owned, password-protected paste. Returns its public token. */
async function protectedPaste(t: ReturnType<typeof users>["alice"]) {
  const { token } = await createPaste(t);
  await t.mutation(api.pastes.setPassword, { token, password: PASSWORD });
  return token;
}

const resolve = (
  t: ReturnType<typeof convexTest>,
  subdomain: string,
  unlockToken?: string,
) => t.query(api.pastes.resolveForRuntime, { subdomain, unlockToken });

/** The session secret from a successful unlock; fails loudly on a rejection. */
function granted(result: Awaited<ReturnType<typeof unlock>>): string {
  if (!result.ok) throw new Error(`unlock rejected: ${result.reason}`);
  return result.unlockToken;
}

const unlock = (
  t: ReturnType<typeof convexTest>,
  subdomain: string,
  password: string,
  client = "203.0.113.7",
) => t.mutation(api.pastes.unlock, { subdomain, password, client });

describe("setPassword", () => {
  it("protects the paste and never exposes the hash", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);

    const owned = await alice.query(api.pastes.getOwned, { token });
    expect(owned.visibility).toBe("protected");
    expect(owned.hasPassword).toBe(true);
    expect(owned).not.toHaveProperty("passwordHash");

    const publicView = await t.query(api.pastes.getByToken, { token });
    expect(publicView!.visibility).toBe("protected");
    expect(publicView).not.toHaveProperty("passwordHash");
  });

  it("withholds the content URL until the paste is unlocked", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);

    const locked = (await resolve(t, token))!;
    expect(locked.locked).toBe(true);
    expect(locked.url).toBeNull();
    // Nothing that could serve the bytes leaks either.
    expect(locked.sha256).toBe("");

    const unlockToken = granted(await unlock(t, token, PASSWORD));
    const opened = (await resolve(t, token, unlockToken))!;
    expect(opened.locked).toBe(false);
    expect(opened.url).toEqual(expect.any(String));
  });

  it("rejects a too-short password", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const { token } = await createPaste(alice);

    expect(
      await codeOf(
        alice.mutation(api.pastes.setPassword, { token, password: "short" }),
      ),
    ).toBe("VALIDATION");
    expect((await t.query(api.pastes.getByToken, { token }))!.visibility).toBe(
      "public",
    );
  });
});

describe("unlock", () => {
  it("accepts the correct password", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);

    const result = await unlock(t, token, PASSWORD);
    expect(result).toMatchObject({ ok: true, expiresAt: expect.any(Number) });
    expect(granted(result)).toHaveLength(32);
  });

  it("refuses the wrong password", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);

    expect(await unlock(t, token, "wrong password")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("answers an unknown or unprotected paste exactly like a wrong password", async () => {
    const t = convexTest(schema, modules);
    const { token } = await createPaste(t);

    // No paste at all, and a real but unprotected paste: identical answers, so
    // the caller learns nothing about which case it hit.
    const rejected = { ok: false, reason: "invalid" };
    expect(await unlock(t, "nosuchpaste00", PASSWORD)).toEqual(rejected);
    expect(await unlock(t, token, PASSWORD)).toEqual(rejected);
  });

  it("scopes an unlock to one paste", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const mine = await protectedPaste(alice);
    const other = await protectedPaste(alice);

    const unlockToken = granted(await unlock(t, mine, PASSWORD));

    expect((await resolve(t, mine, unlockToken))!.locked).toBe(false);
    // Same password, same owner — still locked, because the session names a paste.
    expect((await resolve(t, other, unlockToken))!.locked).toBe(true);
  });

  it("stops honouring a session once it expires", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);
    const unlockToken = granted(await unlock(t, token, PASSWORD));

    expect((await resolve(t, token, unlockToken))!.locked).toBe(false);

    // Age the session past its TTL rather than waiting 12 hours for it.
    await t.run(async (ctx) => {
      for (const session of await ctx.db.query("pasteUnlocks").collect())
        await ctx.db.patch("pasteUnlocks", session._id, {
          expiresAt: Date.now() - UNLOCK_TTL_MS,
        });
    });

    expect((await resolve(t, token, unlockToken))!.locked).toBe(true);
  });

  it("ignores a forged or absent session token", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);

    expect((await resolve(t, token, "not-a-real-session"))!.locked).toBe(true);
    expect((await resolve(t, token))!.locked).toBe(true);
  });
});

describe("throttling", () => {
  it("locks a client out after repeated failures, then keeps refusing", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);

    for (let i = 0; i < MAX_UNLOCK_ATTEMPTS; i++)
      expect(await unlock(t, token, "wrong")).toMatchObject({
        reason: "invalid",
      });

    // Past the cap the correct password is refused too — no free guess.
    const throttled = { ok: false, reason: "throttled" };
    expect(await unlock(t, token, "wrong")).toEqual(throttled);
    expect(await unlock(t, token, PASSWORD)).toEqual(throttled);
  });

  it("throttles per client, so one attacker cannot lock everyone out", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);

    for (let i = 0; i < MAX_UNLOCK_ATTEMPTS; i++)
      await unlock(t, token, "wrong", "198.51.100.1");

    expect(await unlock(t, token, PASSWORD, "198.51.100.1")).toMatchObject({
      reason: "throttled",
    });
    // A different visitor is unaffected.
    expect(await unlock(t, token, PASSWORD, "203.0.113.9")).toMatchObject({
      ok: true,
    });
  });

  it("clears the attempt budget on a successful unlock", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);

    for (let i = 0; i < MAX_UNLOCK_ATTEMPTS - 1; i++)
      await unlock(t, token, "wrong");
    expect(await unlock(t, token, PASSWORD)).toMatchObject({ ok: true });

    // The budget reset, so the next wrong guess is not the one over the line.
    expect(await unlock(t, token, "wrong")).toMatchObject({
      reason: "invalid",
    });
  });
});

describe("replacement and removal", () => {
  it("revokes existing sessions when the password changes", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);
    const unlockToken = granted(await unlock(t, token, PASSWORD));

    await alice.mutation(api.pastes.setPassword, {
      token,
      password: "a different password",
    });

    expect((await resolve(t, token, unlockToken))!.locked).toBe(true);
    expect(await unlock(t, token, PASSWORD)).toMatchObject({
      reason: "invalid",
    });
    expect(await unlock(t, token, "a different password")).toMatchObject({
      ok: true,
    });
  });

  it("makes the paste public again on removal", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);

    await alice.mutation(api.pastes.removePassword, { token });

    const owned = await alice.query(api.pastes.getOwned, { token });
    expect(owned.visibility).toBe("public");
    expect(owned.hasPassword).toBe(false);
    expect((await resolve(t, token))!.locked).toBe(false);
    // Nothing left to unlock.
    expect(await unlock(t, token, PASSWORD)).toMatchObject({
      reason: "invalid",
    });
    expect(
      await t.run((ctx) => ctx.db.query("pasteUnlocks").collect()),
    ).toHaveLength(0);
  });
});

describe("authorization", () => {
  it("lets only the owner set or remove a password", async () => {
    const t = convexTest(schema, modules);
    const { alice, bob } = users(t);
    const token = await protectedPaste(alice);

    expect(
      await codeOf(
        bob.mutation(api.pastes.setPassword, { token, password: PASSWORD }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await codeOf(bob.mutation(api.pastes.removePassword, { token })),
    ).toBe("FORBIDDEN");
    expect(await codeOf(t.mutation(api.pastes.removePassword, { token }))).toBe(
      "UNAUTHORIZED",
    );
  });

  it("lets an anonymous author protect their paste with the update token", async () => {
    const t = convexTest(schema, modules);
    const { token, updateToken } = await createPaste(t);

    expect(
      await codeOf(
        t.mutation(api.pastes.setPassword, { token, password: PASSWORD }),
      ),
    ).toBe("UNAUTHORIZED");
    expect(
      await codeOf(
        t.mutation(api.pastes.setPassword, {
          token,
          updateToken: "wrong",
          password: PASSWORD,
        }),
      ),
    ).toBe("FORBIDDEN");

    await t.mutation(api.pastes.setPassword, {
      token,
      updateToken,
      password: PASSWORD,
    });
    expect((await resolve(t, token))!.locked).toBe(true);

    await t.mutation(api.pastes.removePassword, { token, updateToken });
    expect((await resolve(t, token))!.locked).toBe(false);
  });
});

describe("unlock session table", () => {
  it("holds one paste to MAX_UNLOCK_SESSIONS, evicting the oldest", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const token = await protectedPaste(alice);

    // Seeded directly rather than through `unlock`: the point is what happens
    // once the table is already full, and a thousand real password
    // verifications would buy nothing but a slow test.
    const { pasteId, oldest } = await t.run(async (ctx) => {
      const paste = await ctx.db
        .query("pastes")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      const now = Date.now();
      let oldest = null;
      for (let i = 0; i < MAX_UNLOCK_SESSIONS; i++) {
        const id = await ctx.db.insert("pasteUnlocks", {
          pasteId: paste!._id,
          sessionHash: `seeded-${i}`,
          // Live, and ordered: the first seeded row is the first evicted.
          expiresAt: now + UNLOCK_TTL_MS - MAX_UNLOCK_SESSIONS + i,
        });
        if (i === 0) oldest = id;
      }
      return { pasteId: paste!._id, oldest: oldest! };
    });

    const unlockToken = granted(await unlock(t, token, PASSWORD));

    const sessions = await t.run((ctx) =>
      ctx.db
        .query("pasteUnlocks")
        .withIndex("by_paste", (q) => q.eq("pasteId", pasteId))
        .collect(),
    );
    expect(sessions).toHaveLength(MAX_UNLOCK_SESSIONS);
    expect(sessions.map((s) => s._id)).not.toContain(oldest);
    // The visitor who just unlocked is the one who must still be inside.
    expect((await resolve(t, token, unlockToken))!.locked).toBe(false);

    // The owner keeps control: revocation still runs over a bounded table.
    await alice.mutation(api.pastes.removePassword, { token });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("pasteUnlocks")
          .withIndex("by_paste", (q) => q.eq("pasteId", pasteId))
          .collect(),
      ),
    ).toHaveLength(0);
  });
});
