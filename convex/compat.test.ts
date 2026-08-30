// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { createPaste, storeHtml } from "../test/convex-helpers";

const modules = import.meta.glob("./**/*.ts");

// The backend half of the compatibility suite: what File Storage gives back,
// and whether a token carried over from the old Rails app still resolves. The
// serving layer is covered in `test/compat.test.ts`, the whole round trip in
// `e2e/compat.spec.ts`.

const encoder = new TextEncoder();

/** The bytes Convex is holding for a stored object. */
async function readBack(
  t: ReturnType<typeof convexTest>,
  storageId: Id<"_storage">,
): Promise<Uint8Array> {
  // The unwrapping happens inside `run`: a Blob is not a Convex value, an
  // ArrayBuffer is.
  return new Uint8Array(
    await t.run(
      async (ctx) => await (await ctx.storage.get(storageId))!.arrayBuffer(),
    ),
  );
}

describe("stored bytes", () => {
  // A BOM, CRLF endings, a lone CR, a tab and multi-byte text in one string:
  // everything a decode-then-re-encode step would quietly alter.
  const SOURCE = "﻿<!doctype html>\r\n\t<h1>héllo — 🎉 مرحبا</h1>\r<p>ok</p>\n";

  it("come back out of storage exactly as they went in", async () => {
    const t = convexTest(schema, modules);
    const storageId = await storeHtml(t, SOURCE);

    expect(await readBack(t, storageId)).toEqual(encoder.encode(SOURCE));
  });

  it("are measured in bytes, not characters", async () => {
    const t = convexTest(schema, modules);
    const { token } = await createPaste(t, {}, SOURCE);

    // The paste's `contentLength` becomes the `Content-Length` header, so a
    // character count here would truncate every multi-byte page in the archive.
    const paste = await t.query(api.pastes.getByToken, { token });
    expect(paste!.contentLength).toBe(encoder.encode(SOURCE).byteLength);
    expect(paste!.contentLength).toBeGreaterThan(SOURCE.length);
  });
});

describe("tokens carried over from the old app", () => {
  /** Inserts a paste under a token this app would never have minted itself. */
  async function importPaste(
    t: ReturnType<typeof convexTest>,
    token: string,
    customSubdomain?: string,
  ) {
    const storageId = await storeHtml(t, "<h1>an old page</h1>");
    const now = Date.now();
    return await t.run((ctx) =>
      ctx.db.insert("pastes", {
        token,
        storageId,
        customSubdomain,
        filename: "index.html",
        contentType: "text/html",
        contentLength: 20,
        visibility: "public" as const,
        viewsCount: 41,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  // A migrated token keeps whatever shape the old app gave it — shorter,
  // longer, or a slug — and nothing may reject it for not looking generated.
  for (const token of ["abc", "legacy1234", "my-legacy-page", "0".repeat(40)]) {
    it(`resolves "${token}" through every serving surface`, async () => {
      const t = convexTest(schema, modules);
      await importPaste(t, token);

      // `getByToken` backs the metadata page; `resolveForRuntime` backs all
      // three surfaces that hand over bytes — wildcard, raw and preview.
      expect((await t.query(api.pastes.getByToken, { token }))?.token).toBe(
        token,
      );
      const resolved = await t.query(api.pastes.resolveForRuntime, {
        subdomain: token,
      });
      expect(resolved?.token).toBe(token);
      expect(resolved?.url).toBeTruthy();
      expect(resolved?.locked).toBe(false);
    });
  }

  it("keeps a legacy custom subdomain resolving alongside its token", async () => {
    const t = convexTest(schema, modules);
    await importPaste(t, "legacy1234", "old-vanity-name");

    for (const subdomain of ["old-vanity-name", "legacy1234"])
      expect(
        (await t.query(api.pastes.resolveForRuntime, { subdomain }))?.token,
      ).toBe("legacy1234");
  });

  it("carries the old view count forward rather than restarting it", async () => {
    const t = convexTest(schema, modules);
    await importPaste(t, "legacy1234");

    const paste = await t.query(api.pastes.getByToken, { token: "legacy1234" });
    expect(paste!.viewsCount).toBe(41);
  });

  it("matches a token case-insensitively, because a hostname already is", async () => {
    // Documenting the rule a migration has to respect: `resolveForRuntime`
    // lowercases what it is given, since a browser lowercases the host before
    // it ever reaches us. An uppercase token would be reachable only in its
    // lowercase form, so tokens must be imported lowercase.
    const t = convexTest(schema, modules);
    await importPaste(t, "legacy1234");

    expect(
      (await t.query(api.pastes.resolveForRuntime, { subdomain: "LEGACY1234" }))
        ?.token,
    ).toBe("legacy1234");
  });
});
