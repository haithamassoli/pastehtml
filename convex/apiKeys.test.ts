// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { API_KEY_PREFIX } from "./lib/apiKeys";
import type { Scope } from "./schema";
import { codeOf, createPaste, storeHtml, users } from "../test/convex-helpers";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  return { t, ...users(t) };
}

type Actor = ReturnType<ReturnType<typeof setup>["t"]["withIdentity"]>;

const ALL: Scope[] = [
  "pastes:read",
  "pastes:write",
  "pastes:delete",
  "folders:read",
  "folders:write",
];

async function keyFor(actor: Actor, scopes: Scope[] = ALL, expiresAt?: number) {
  const created = await actor.mutation(api.apiKeys.create, {
    name: "ci",
    scopes,
    expiresAt,
  });
  return created;
}

describe("apiKeys.create", () => {
  it("returns the raw secret once and stores only its digest", async () => {
    const { t, alice } = setup();
    const { key, keyPrefix, keyId } = await keyFor(alice);

    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key).toHaveLength(API_KEY_PREFIX.length + 40);
    expect(key.startsWith(keyPrefix)).toBe(true);

    const stored = await t.run((ctx) => ctx.db.get("apiKeys", keyId));
    expect(stored!.keyHash).not.toBe(key);
    expect(stored!.keyHash).toHaveLength(64);
    // The digest is of the whole key, so the stored row never contains it.
    expect(JSON.stringify(stored)).not.toContain(key);
  });

  it("requires a signed-in user and at least one known scope", async () => {
    const { t, alice } = setup();
    expect(
      await codeOf(t.mutation(api.apiKeys.create, { name: "x", scopes: ALL })),
    ).toBe("UNAUTHORIZED");
    expect(
      await codeOf(
        alice.mutation(api.apiKeys.create, { name: "x", scopes: [] }),
      ),
    ).toBe("VALIDATION");
  });
});

describe("API-key authentication", () => {
  it("publishes as the key's owner, not anonymously", async () => {
    const { t, alice } = setup();
    const { key } = await keyFor(alice);

    // `t` itself is signed out: the key is the only credential in play.
    const created = await createPaste(t, { apiKey: key });
    // Owned pastes get no update token — the key is the management credential.
    expect(created.updateToken).toBeUndefined();

    const owned = await alice.query(api.pastes.getOwned, {
      token: created.token,
    });
    expect(owned.isOwned).toBe(true);
  });

  it("rejects an unknown key rather than falling back to anonymous", async () => {
    const { t } = setup();
    expect(
      await codeOf(createPaste(t, { apiKey: `${API_KEY_PREFIX}nope` })),
    ).toBe("UNAUTHORIZED");
  });

  it("rejects a revoked key", async () => {
    const { t, alice } = setup();
    const { key, keyId } = await keyFor(alice);

    // Usable until it is revoked, and useless the moment it is.
    await createPaste(t, { apiKey: key });
    await alice.mutation(api.apiKeys.revoke, { keyId });

    expect(await codeOf(createPaste(t, { apiKey: key }))).toBe("UNAUTHORIZED");
  });

  it("rejects an expired key", async () => {
    const { t, alice } = setup();
    const { key } = await keyFor(alice, ALL, Date.now() + 60_000);

    // Usable now…
    await createPaste(t, { apiKey: key });

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 120_000);
      expect(await codeOf(createPaste(t, { apiKey: key }))).toBe(
        "UNAUTHORIZED",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("enforces scopes on read, write and delete", async () => {
    const { t, alice } = setup();
    const readOnly = await keyFor(alice, ["pastes:read"]);
    const writeOnly = await keyFor(alice, ["pastes:write"]);

    // A read-only key cannot publish…
    expect(await codeOf(createPaste(t, { apiKey: readOnly.key }))).toBe(
      "FORBIDDEN",
    );

    const paste = await createPaste(t, { apiKey: writeOnly.key });

    // …and a write key cannot read the owner view or delete.
    expect(
      await codeOf(
        t.query(api.pastes.getOwned, {
          token: paste.token,
          apiKey: writeOnly.key,
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await codeOf(
        t.mutation(api.pastes.remove, {
          token: paste.token,
          apiKey: writeOnly.key,
        }),
      ),
    ).toBe("FORBIDDEN");

    // The read key may look, and cannot write.
    expect(
      (
        await t.query(api.pastes.getOwned, {
          token: paste.token,
          apiKey: readOnly.key,
        })
      ).token,
    ).toBe(paste.token);
    expect(
      await codeOf(
        t.mutation(api.pastes.update, {
          token: paste.token,
          apiKey: readOnly.key,
          title: "nope",
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("lists the key owner's pastes, and only with the read scope", async () => {
    const { t, alice } = setup();
    const readOnly = await keyFor(alice, ["pastes:read"]);
    const writeOnly = await keyFor(alice, ["pastes:write"]);
    const paste = await createPaste(alice);

    expect(
      (await t.query(api.pastes.listByOwner, { apiKey: readOnly.key })).map(
        (p) => p.token,
      ),
    ).toEqual([paste.token]);
    expect(
      await codeOf(t.query(api.pastes.listByOwner, { apiKey: writeOnly.key })),
    ).toBe("FORBIDDEN");
  });

  it("cannot reach another account's paste", async () => {
    const { t, alice, bob } = setup();
    const bobsKey = await keyFor(bob);
    const alicesPaste = await createPaste(alice);

    for (const call of [
      t.query(api.pastes.getOwned, {
        token: alicesPaste.token,
        apiKey: bobsKey.key,
      }),
      t.mutation(api.pastes.update, {
        token: alicesPaste.token,
        apiKey: bobsKey.key,
        title: "mine now",
      }),
      t.mutation(api.pastes.remove, {
        token: alicesPaste.token,
        apiKey: bobsKey.key,
      }),
    ])
      expect(await codeOf(call)).toBe("FORBIDDEN");
  });

  it("cannot manage an anonymous paste, which needs its update token", async () => {
    const { t, alice } = setup();
    const { key } = await keyFor(alice);
    const anonymous = await createPaste(t);

    // A key belongs to an account; a paste that belongs to nobody is reachable
    // only with the secret handed out when it was published.
    expect(
      await codeOf(
        t.mutation(api.pastes.update, {
          token: anonymous.token,
          apiKey: key,
          title: "mine now",
        }),
      ),
    ).toBe("UNAUTHORIZED");

    await t.mutation(api.pastes.update, {
      token: anonymous.token,
      updateToken: anonymous.updateToken,
      title: "fine",
    });
  });

  it("replaces content and sets a password with a scoped key", async () => {
    const { t, alice } = setup();
    const { key } = await keyFor(alice, ["pastes:read", "pastes:write"]);
    const paste = await createPaste(t, { apiKey: key });

    await t.mutation(api.pastes.replaceContent, {
      token: paste.token,
      apiKey: key,
      storageId: await storeHtml(t, "<p>v2</p>"),
      contentType: "text/html",
    });
    await t.mutation(api.pastes.setPassword, {
      token: paste.token,
      apiKey: key,
      password: "correct horse battery",
    });

    const owned = await t.query(api.pastes.getOwned, {
      token: paste.token,
      apiKey: key,
    });
    expect(owned.hasPassword).toBe(true);
    expect(owned.visibility).toBe("protected");
    expect(owned.contentLength).toBe("<p>v2</p>".length);
  });
});

describe("apiKeys.list", () => {
  it("returns an account's own keys and never the digest", async () => {
    const { alice, bob } = setup();
    const { key, keyPrefix } = await keyFor(alice, ["pastes:read"]);
    await keyFor(bob);

    const listed = await alice.query(api.apiKeys.list, {});
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      name: "ci",
      keyPrefix,
      scopes: ["pastes:read"],
    });
    // A fresh key is alive, unused and unexpiring.
    expect(listed[0].lastUsedAt).toBeUndefined();
    expect(listed[0].expiresAt).toBeUndefined();
    expect(listed[0].revokedAt).toBeUndefined();
    // Neither the secret nor anything derived from it is in the payload.
    const serialized = JSON.stringify(listed);
    expect(serialized).not.toContain(key);
    expect(serialized).not.toContain("keyHash");
  });

  it("reports revocation and expiry so the page can label a dead key", async () => {
    const { alice } = setup();
    const expiresAt = Date.now() + 60_000;
    await keyFor(alice, ALL, expiresAt);
    const { keyId } = await keyFor(alice);
    await alice.mutation(api.apiKeys.revoke, { keyId });

    const listed = await alice.query(api.apiKeys.list, {});
    expect(listed.find((k) => k._id === keyId)!.revokedAt).toBeTypeOf("number");
    expect(listed.find((k) => k.expiresAt !== undefined)!.expiresAt).toBe(
      expiresAt,
    );
  });

  it("requires a signed-in user", async () => {
    const { t } = setup();
    expect(await codeOf(t.query(api.apiKeys.list, {}))).toBe("UNAUTHORIZED");
  });
});

describe("apiKeys.revoke", () => {
  it("cannot be aimed at another account's key", async () => {
    const { alice, bob } = setup();
    const { keyId } = await keyFor(alice);

    expect(await codeOf(bob.mutation(api.apiKeys.revoke, { keyId }))).toBe(
      "FORBIDDEN",
    );
    expect(
      (await alice.query(api.apiKeys.list, {}))[0].revokedAt,
    ).toBeUndefined();
  });

  it("is idempotent and keeps the first timestamp", async () => {
    const { alice } = setup();
    const { keyId } = await keyFor(alice);

    await alice.mutation(api.apiKeys.revoke, { keyId });
    const first = (await alice.query(api.apiKeys.list, {}))[0].revokedAt;
    await alice.mutation(api.apiKeys.revoke, { keyId });

    expect((await alice.query(api.apiKeys.list, {}))[0].revokedAt).toBe(first);
  });
});

describe("apiKeys.touch", () => {
  it("stamps lastUsedAt, then leaves the row alone for a minute", async () => {
    const { t, alice } = setup();
    const { key } = await keyFor(alice);
    const lastUsed = async () =>
      (await alice.query(api.apiKeys.list, {}))[0].lastUsedAt;

    await t.mutation(api.apiKeys.touch, { key });
    const first = await lastUsed();
    expect(first).toBeTypeOf("number");

    // A second call in the same minute is deliberately a no-op, so a hot key
    // does not rewrite its row on every request.
    await t.mutation(api.apiKeys.touch, { key });
    expect(await lastUsed()).toBe(first);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 120_000);
      await t.mutation(api.apiKeys.touch, { key });
      expect(await lastUsed()).toBeGreaterThan(first!);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores an unknown or revoked key without saying so", async () => {
    const { t, alice } = setup();
    const { key, keyId } = await keyFor(alice);
    await alice.mutation(api.apiKeys.revoke, { keyId });

    await t.mutation(api.apiKeys.touch, { key: `${API_KEY_PREFIX}nope` });
    await t.mutation(api.apiKeys.touch, { key });

    expect(
      (await alice.query(api.apiKeys.list, {}))[0].lastUsedAt,
    ).toBeUndefined();
  });
});
