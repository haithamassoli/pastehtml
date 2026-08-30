// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { MAX_UPLOAD_BYTES } from "./lib/validation";
import { codeOf, createPaste, storeHtml, users } from "../test/convex-helpers";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  return { t, ...users(t) };
}

describe("pastes.create", () => {
  it("issues an update token to anonymous authors only once", async () => {
    const t = convexTest(schema, modules);

    const result = await createPaste(t);

    expect(result.token).toHaveLength(12);
    expect(result.updateToken).toHaveLength(32);

    // The raw token is never readable afterwards, only its hash is stored.
    const paste = await t.query(api.pastes.getByToken, { token: result.token });
    expect(paste).not.toBeNull();
    expect(paste).not.toHaveProperty("updateTokenHash");
    expect(paste).not.toHaveProperty("passwordHash");
    expect(paste).not.toHaveProperty("ownerId");
    expect(paste!.isOwned).toBe(false);
    expect(paste!.viewsCount).toBe(0);
    expect(paste!.visibility).toBe("public");
  });

  it("owns the paste when signed in and issues no update token", async () => {
    const { alice } = setup();

    const result = await createPaste(alice, {
      contentType: "text/html; charset=utf-8",
      title: "  My demo  ",
    });

    expect(result.updateToken).toBeUndefined();
    const owned = await alice.query(api.pastes.getOwned, {
      token: result.token,
    });
    expect(owned.title).toBe("My demo");
    expect(owned.isOwned).toBe(true);
  });

  it("rejects invalid uploads with stable error codes", async () => {
    const t = convexTest(schema, modules);

    expect(await codeOf(createPaste(t, {}, ""))).toBe("VALIDATION");
    expect(await codeOf(createPaste(t, { contentType: "image/png" }))).toBe(
      "UNSUPPORTED_MEDIA_TYPE",
    );
    expect(
      await codeOf(createPaste(t, {}, "x".repeat(MAX_UPLOAD_BYTES + 1))),
    ).toBe("PAYLOAD_TOO_LARGE");
    expect(await codeOf(createPaste(t, { filename: "a/b.html" }))).toBe(
      "VALIDATION",
    );
  });

  it("allocates unique tokens across many pastes", async () => {
    const t = convexTest(schema, modules);
    const tokens = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const { token } = await createPaste(t);
      tokens.add(token);
    }
    expect(tokens.size).toBe(25);
  });

  it("refuses an upload that already backs another paste", async () => {
    const t = convexTest(schema, modules);
    const storageId = await storeHtml(t);

    await createPaste(t, { storageId });
    expect(await codeOf(createPaste(t, { storageId }))).toBe("CONFLICT");
  });

  it("refuses a storage id that does not exist", async () => {
    const t = convexTest(schema, modules);
    const storageId = await storeHtml(t);
    await t.run((ctx) => ctx.storage.delete(storageId));

    expect(await codeOf(createPaste(t, { storageId }))).toBe("NOT_FOUND");
  });
});

describe("custom subdomains", () => {
  it("normalizes, rejects reserved names, and enforces uniqueness", async () => {
    const t = convexTest(schema, modules);

    const created = await createPaste(t, { customSubdomain: "My-Demo" });
    const found = await t.query(api.pastes.getByCustomSubdomain, {
      subdomain: "my-demo",
    });
    expect(found?.token).toBe(created.token);

    expect(await codeOf(createPaste(t, { customSubdomain: "www" }))).toBe(
      "CONFLICT",
    );
    expect(await codeOf(createPaste(t, { customSubdomain: "my-demo" }))).toBe(
      "CONFLICT",
    );
    expect(await codeOf(createPaste(t, { customSubdomain: "-nope" }))).toBe(
      "VALIDATION",
    );
  });

  it("lets a paste keep its own subdomain on update", async () => {
    const t = convexTest(schema, modules);
    const { token, updateToken } = await createPaste(t, {
      customSubdomain: "keeper",
    });

    await t.mutation(api.pastes.update, {
      token,
      updateToken,
      customSubdomain: "keeper",
      title: "Renamed",
    });
    expect(
      (await t.query(api.pastes.getByToken, { token }))?.customSubdomain,
    ).toBe("keeper");
  });
});

describe("anonymous update-token authorization", () => {
  it("accepts the issued token and refuses anything else", async () => {
    const t = convexTest(schema, modules);
    const { token, updateToken } = await createPaste(t);

    await t.mutation(api.pastes.update, {
      token,
      updateToken,
      title: "Updated",
    });
    expect((await t.query(api.pastes.getByToken, { token }))?.title).toBe(
      "Updated",
    );

    expect(
      await codeOf(t.mutation(api.pastes.update, { token, title: "No token" })),
    ).toBe("UNAUTHORIZED");
    expect(
      await codeOf(
        t.mutation(api.pastes.update, {
          token,
          updateToken: "z".repeat(32),
          title: "Wrong token",
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("authorizes anonymous deletion and drops the stored file", async () => {
    const t = convexTest(schema, modules);
    const storageId = await storeHtml(t);
    const { token, updateToken } = await createPaste(t, { storageId });

    expect(await codeOf(t.mutation(api.pastes.remove, { token }))).toBe(
      "UNAUTHORIZED",
    );

    await t.mutation(api.pastes.remove, { token, updateToken });
    expect(await t.query(api.pastes.getByToken, { token })).toBeNull();
    await t.run(async (ctx) => {
      expect(await ctx.db.system.get("_storage", storageId)).toBeNull();
    });
  });
});

describe("owner authorization", () => {
  it("keeps one user out of another user's paste", async () => {
    const { t, alice, bob } = setup();
    const { token } = await createPaste(alice);

    expect(
      await codeOf(bob.mutation(api.pastes.update, { token, title: "Mine" })),
    ).toBe("FORBIDDEN");
    expect(await codeOf(bob.mutation(api.pastes.remove, { token }))).toBe(
      "FORBIDDEN",
    );
    expect(await codeOf(bob.query(api.pastes.getOwned, { token }))).toBe(
      "FORBIDDEN",
    );

    // An update token cannot be used to hijack an owned paste.
    expect(
      await codeOf(
        t.mutation(api.pastes.update, {
          token,
          updateToken: "z".repeat(32),
          title: "Hijack",
        }),
      ),
    ).toBe("UNAUTHORIZED");

    await alice.mutation(api.pastes.update, { token, title: "Mine" });
    expect((await alice.query(api.pastes.getOwned, { token })).title).toBe(
      "Mine",
    );
  });

  it("lists only the caller's own pastes and requires sign-in", async () => {
    const { t, alice, bob } = setup();
    await createPaste(alice);
    await createPaste(alice);
    await createPaste(bob);

    expect(await alice.query(api.pastes.listByOwner, {})).toHaveLength(2);
    expect(await bob.query(api.pastes.listByOwner, {})).toHaveLength(1);
    expect(await codeOf(t.query(api.pastes.listByOwner, {}))).toBe(
      "UNAUTHORIZED",
    );
  });
});

describe("content replacement", () => {
  it("swaps the storage id and deletes only the superseded file", async () => {
    const t = convexTest(schema, modules);
    const original = await storeHtml(t, "<p>v1</p>");
    const { token, updateToken } = await createPaste(t, {
      storageId: original,
    });

    const replacement = await storeHtml(t, "<p>version two</p>");
    await t.mutation(api.pastes.replaceContent, {
      token,
      updateToken,
      storageId: replacement,
      contentType: "text/html",
    });

    const paste = await t.query(api.pastes.getByToken, { token });
    expect(paste?.contentLength).toBe("<p>version two</p>".length);
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query("pastes")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      expect(stored?.storageId).toBe(replacement);
      expect(await ctx.db.system.get("_storage", original)).toBeNull();
      expect(await ctx.db.system.get("_storage", replacement)).not.toBeNull();
    });
  });

  it("leaves the paste untouched when the replacement is rejected", async () => {
    const t = convexTest(schema, modules);
    const original = await storeHtml(t, "<p>v1</p>");
    const { token, updateToken } = await createPaste(t, {
      storageId: original,
    });
    const replacement = await storeHtml(t, "<p>v2</p>");

    expect(
      await codeOf(
        t.mutation(api.pastes.replaceContent, {
          token,
          updateToken,
          storageId: replacement,
          contentType: "image/png",
        }),
      ),
    ).toBe("UNSUPPORTED_MEDIA_TYPE");

    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query("pastes")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      expect(stored?.storageId).toBe(original);
      expect(await ctx.db.system.get("_storage", original)).not.toBeNull();
    });
  });
});

describe("views and internal deletion", () => {
  it("increments the counter and records one row per view", async () => {
    const t = convexTest(schema, modules);
    const { token } = await createPaste(t);

    await t.mutation(api.pastes.recordView, { token, referrer: "example.com" });
    await t.mutation(api.pastes.recordView, { token });
    // A view of a deleted or unknown paste is a silent no-op, never an error.
    await t.mutation(api.pastes.recordView, { token: "doesnotexist" });

    expect((await t.query(api.pastes.getByToken, { token }))?.viewsCount).toBe(
      2,
    );
    await t.run(async (ctx) => {
      expect(await ctx.db.query("pasteViews").collect()).toHaveLength(2);
    });
  });

  it("hard-deletes without any caller authorization", async () => {
    const { t, alice } = setup();
    const { pasteId, token } = await createPaste(alice);

    await t.mutation(internal.pastes.hardDelete, { pasteId });
    expect(await t.query(api.pastes.getByToken, { token })).toBeNull();
    // Deleting an already-deleted paste is idempotent.
    await t.mutation(internal.pastes.hardDelete, { pasteId });
  });
});

describe("pastes.resolveForRuntime", () => {
  it("resolves a paste by its token and hands back a storage URL", async () => {
    const t = convexTest(schema, modules);
    const { token } = await createPaste(t, {}, "<h1>runtime</h1>");

    const resolved = await t.query(api.pastes.resolveForRuntime, {
      subdomain: token,
    });

    expect(resolved).not.toBeNull();
    expect(resolved!.token).toBe(token);
    expect(resolved!.visibility).toBe("public");
    expect(resolved!.contentType).toBe("text/html");
    expect(resolved!.contentLength).toBe("<h1>runtime</h1>".length);
    expect(resolved!.sha256).not.toBe("");
    expect(resolved!.url).toBeTruthy();
  });

  it("resolves a paste by its custom subdomain, case-insensitively", async () => {
    const t = convexTest(schema, modules);
    const { token } = await createPaste(t, { customSubdomain: "My-Demo" });

    const resolved = await t.query(api.pastes.resolveForRuntime, {
      subdomain: "my-demo",
    });

    expect(resolved!.token).toBe(token);
  });

  it("returns null for an unknown subdomain", async () => {
    const t = convexTest(schema, modules);

    expect(
      await t.query(api.pastes.resolveForRuntime, { subdomain: "nope" }),
    ).toBeNull();
  });

  it("returns null once the paste is deleted", async () => {
    const t = convexTest(schema, modules);
    const { token, updateToken } = await createPaste(t);
    await t.mutation(api.pastes.remove, { token, updateToken });

    expect(
      await t.query(api.pastes.resolveForRuntime, { subdomain: token }),
    ).toBeNull();
  });

  it("exposes no secrets or owner identity to the runtime", async () => {
    const { alice } = setup();
    const { token } = await createPaste(alice);

    const resolved = await alice.query(api.pastes.resolveForRuntime, {
      subdomain: token,
    });

    expect(Object.keys(resolved!).sort()).toEqual([
      "contentLength",
      "contentType",
      "filename",
      "sha256",
      "token",
      "url",
      "visibility",
    ]);
  });

  it("reports a fresh digest after the content is replaced", async () => {
    const t = convexTest(schema, modules);
    const { token, updateToken } = await createPaste(t, {}, "<h1>before</h1>");
    const before = await t.query(api.pastes.resolveForRuntime, {
      subdomain: token,
    });

    await t.mutation(api.pastes.replaceContent, {
      token,
      updateToken,
      storageId: await storeHtml(t, "<h1>after</h1>"),
      contentType: "text/html",
    });
    const after = await t.query(api.pastes.resolveForRuntime, {
      subdomain: token,
    });

    expect(after!.sha256).not.toBe(before!.sha256);
    expect(after!.contentLength).toBe("<h1>after</h1>".length);
  });
});
