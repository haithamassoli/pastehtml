// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { codeOf, createPaste, users } from "../test/convex-helpers";

const modules = import.meta.glob("./**/*.ts");

const setup = () => {
  const t = convexTest(schema, modules);
  return { t, ...users(t) };
};

describe("abuse reports", () => {
  it("records a report against the paste's canonical token", async () => {
    const { t } = setup();
    const { token } = await createPaste(t, { customSubdomain: "my-demo" });

    // Reported by the name it was reached by; stored under the token, so both
    // routes to the same paste land in one pile.
    await t.mutation(api.admin.report, {
      token: "my-demo",
      reason: "  phishing  ",
    });

    const [report] = await t.query(internal.admin.pending, {});
    expect(report).toMatchObject({ token, reason: "phishing" });
    // Nothing identifying the reporter is stored, because nothing is collected.
    expect(Object.keys(report).sort()).toEqual([
      "_creationTime",
      "_id",
      "createdAt",
      "reason",
      "token",
    ]);
  });

  it("refuses an unknown paste and an empty reason", async () => {
    const { t } = setup();
    const { token } = await createPaste(t);

    expect(
      await codeOf(
        t.mutation(api.admin.report, { token: "nosuchtoken", reason: "spam" }),
      ),
    ).toBe("NOT_FOUND");
    expect(
      await codeOf(t.mutation(api.admin.report, { token, reason: "   " })),
    ).toBe("VALIDATION");
  });

  it("throttles reports per reported paste", async () => {
    const { t } = setup();
    const { token } = await createPaste(t);
    const other = await createPaste(t);

    for (let i = 0; i < 5; i++)
      await t.mutation(api.admin.report, { token, reason: `spam ${i}` });

    expect(
      await codeOf(t.mutation(api.admin.report, { token, reason: "again" })),
    ).toBe("RATE_LIMITED");
    // Report-bombing one paste must not close the door on every other.
    await t.mutation(api.admin.report, {
      token: other.token,
      reason: "unrelated",
    });
  });

  it("drops a resolved report out of the queue", async () => {
    const { t } = setup();
    const { token } = await createPaste(t);
    await t.mutation(api.admin.report, { token, reason: "spam" });

    const [report] = await t.query(internal.admin.pending, {});
    await t.mutation(internal.admin.resolve, {
      reportId: report._id,
      resolution: "disabled",
    });

    expect(await t.query(internal.admin.pending, {})).toEqual([]);
  });
});

describe("disabling a paste", () => {
  it("withholds the content from every serving surface, and restores it", async () => {
    const { t } = setup();
    const { token } = await createPaste(t);

    await t.mutation(internal.admin.disable, { token, reason: "phishing" });

    const disabled = await t.query(api.pastes.resolveForRuntime, {
      subdomain: token,
    });
    // The URL is withheld here rather than at the serving layer, so the raw and
    // preview endpoints stop with the wildcard runtime.
    expect(disabled).toMatchObject({ disabled: true, url: null, sha256: "" });

    await t.mutation(internal.admin.enable, { token });
    expect(
      await t.query(api.pastes.resolveForRuntime, { subdomain: token }),
    ).toMatchObject({ disabled: false, url: expect.any(String) });
  });

  it("cannot be opened with the password the author set", async () => {
    const { t } = setup();
    const { token, updateToken } = await createPaste(t);
    await t.mutation(api.pastes.setPassword, {
      token,
      updateToken,
      password: "correct horse battery",
    });
    const unlocked = await t.mutation(api.pastes.unlock, {
      subdomain: token,
      password: "correct horse battery",
      client: "1.2.3.4",
    });
    expect(unlocked.ok).toBe(true);

    await t.mutation(internal.admin.disable, { token, reason: "malware" });

    expect(
      await t.query(api.pastes.resolveForRuntime, {
        subdomain: token,
        unlockToken: unlocked.ok ? unlocked.unlockToken : undefined,
      }),
    ).toMatchObject({ disabled: true, url: null });
  });

  it("tells the owner, and nobody else, that it was disabled", async () => {
    const { t, alice } = setup();
    const { token } = await createPaste(alice);
    await t.mutation(internal.admin.disable, { token, reason: "spam" });

    expect(await alice.query(api.pastes.getOwned, { token })).toMatchObject({
      disabledAt: expect.any(Number),
    });
    // The public view says nothing about why a URL stopped answering.
    const seen = await t.query(api.pastes.getByToken, { token });
    expect(seen).not.toHaveProperty("disabledAt");
  });
});

describe("administrative delete", () => {
  it("removes the paste and its stored bytes without any credential", async () => {
    const { t } = setup();
    const { token } = await createPaste(t);

    await t.mutation(internal.admin.purge, { token });

    expect(
      await t.query(api.pastes.resolveForRuntime, { subdomain: token }),
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.system.query("_storage").collect()),
    ).toHaveLength(0);
  });

  it("refuses a token that names nothing", async () => {
    const { t } = setup();
    expect(
      await codeOf(t.mutation(internal.admin.purge, { token: "nosuchtoken" })),
    ).toBe("NOT_FOUND");
  });
});

describe("admin.inspect", () => {
  it("returns what an investigation needs and no secret", async () => {
    const { t, alice } = setup();
    const { token } = await createPaste(alice);
    await t.mutation(api.admin.report, { token, reason: "phishing" });

    const paste = await t.query(internal.admin.inspect, { token });

    expect(paste).toMatchObject({
      token,
      ownerId: expect.stringContaining("user_alice"),
      contentType: "text/html",
      sha256: expect.any(String),
      reports: [{ reason: "phishing" }],
    });
    // The digest identifies the bytes; the bytes themselves stay in storage,
    // and no credential is ever part of the answer.
    expect(paste).not.toHaveProperty("passwordHash");
    expect(paste).not.toHaveProperty("updateTokenHash");
  });
});
