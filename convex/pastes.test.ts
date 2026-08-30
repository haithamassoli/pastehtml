// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { codeOf, storeHtml, users } from "../test/convex-helpers";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  return { t, ...users(t) };
}

describe("pastes.create", () => {
  it("issues an update token to anonymous authors only once", async () => {
    const t = convexTest(schema, modules);
    const storageId = await storeHtml(t);

    const result = await t.mutation(api.pastes.create, {
      storageId,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 11,
    });

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
    const { t, alice } = setup();
    const storageId = await storeHtml(t);

    const result = await alice.mutation(api.pastes.create, {
      storageId,
      filename: "index.html",
      contentType: "text/html; charset=utf-8",
      contentLength: 11,
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
    const storageId = await storeHtml(t);
    const base = {
      storageId,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 11,
    };

    expect(
      await codeOf(
        t.mutation(api.pastes.create, { ...base, contentLength: 0 }),
      ),
    ).toBe("VALIDATION");
    expect(
      await codeOf(
        t.mutation(api.pastes.create, { ...base, contentType: "image/png" }),
      ),
    ).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(
      await codeOf(
        t.mutation(api.pastes.create, {
          ...base,
          contentLength: 5 * 1024 * 1024 + 1,
        }),
      ),
    ).toBe("PAYLOAD_TOO_LARGE");
    expect(
      await codeOf(
        t.mutation(api.pastes.create, { ...base, filename: "a/b.html" }),
      ),
    ).toBe("VALIDATION");
  });

  it("allocates unique tokens across many pastes", async () => {
    const t = convexTest(schema, modules);
    const storageId = await storeHtml(t);
    const tokens = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const { token } = await t.mutation(api.pastes.create, {
        storageId,
        filename: "index.html",
        contentType: "text/html",
        contentLength: 11,
      });
      tokens.add(token);
    }
    expect(tokens.size).toBe(25);
  });
});

describe("custom subdomains", () => {
  it("normalizes, rejects reserved names, and enforces uniqueness", async () => {
    const t = convexTest(schema, modules);
    const storageId = await storeHtml(t);
    const base = {
      storageId,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 11,
    };

    const created = await t.mutation(api.pastes.create, {
      ...base,
      customSubdomain: "My-Demo",
    });
    const found = await t.query(api.pastes.getByCustomSubdomain, {
      subdomain: "my-demo",
    });
    expect(found?.token).toBe(created.token);

    expect(
      await codeOf(
        t.mutation(api.pastes.create, { ...base, customSubdomain: "www" }),
      ),
    ).toBe("CONFLICT");
    expect(
      await codeOf(
        t.mutation(api.pastes.create, { ...base, customSubdomain: "my-demo" }),
      ),
    ).toBe("CONFLICT");
    expect(
      await codeOf(
        t.mutation(api.pastes.create, { ...base, customSubdomain: "-nope" }),
      ),
    ).toBe("VALIDATION");
  });

  it("lets a paste keep its own subdomain on update", async () => {
    const t = convexTest(schema, modules);
    const storageId = await storeHtml(t);
    const { token, updateToken } = await t.mutation(api.pastes.create, {
      storageId,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 11,
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
    const storageId = await storeHtml(t);
    const { token, updateToken } = await t.mutation(api.pastes.create, {
      storageId,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 11,
    });

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
    const { token, updateToken } = await t.mutation(api.pastes.create, {
      storageId,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 11,
    });

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
    const storageId = await storeHtml(t);
    const { token } = await alice.mutation(api.pastes.create, {
      storageId,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 11,
    });

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
    const storageId = await storeHtml(t);
    const paste = {
      storageId,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 11,
    };
    await alice.mutation(api.pastes.create, paste);
    await alice.mutation(api.pastes.create, paste);
    await bob.mutation(api.pastes.create, paste);

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
    const { token, updateToken } = await t.mutation(api.pastes.create, {
      storageId: original,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 9,
    });

    const replacement = await storeHtml(t, "<p>version two</p>");
    await t.mutation(api.pastes.replaceContent, {
      token,
      updateToken,
      storageId: replacement,
      contentType: "text/html",
      contentLength: 18,
    });

    const paste = await t.query(api.pastes.getByToken, { token });
    expect(paste?.contentLength).toBe(18);
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
    const { token, updateToken } = await t.mutation(api.pastes.create, {
      storageId: original,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 9,
    });
    const replacement = await storeHtml(t, "<p>v2</p>");

    expect(
      await codeOf(
        t.mutation(api.pastes.replaceContent, {
          token,
          updateToken,
          storageId: replacement,
          contentType: "image/png",
          contentLength: 9,
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
    const storageId = await storeHtml(t);
    const { token } = await t.mutation(api.pastes.create, {
      storageId,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 11,
    });

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
    const storageId = await storeHtml(t);
    const { pasteId, token } = await alice.mutation(api.pastes.create, {
      storageId,
      filename: "index.html",
      contentType: "text/html",
      contentLength: 11,
    });

    await t.mutation(internal.pastes.hardDelete, { pasteId });
    expect(await t.query(api.pastes.getByToken, { token })).toBeNull();
    // Deleting an already-deleted paste is idempotent.
    await t.mutation(internal.pastes.hardDelete, { pasteId });
  });
});
