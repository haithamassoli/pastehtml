// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { ORPHAN_GRACE_MS } from "./storage";
import { codeOf, createPaste, storeHtml } from "../test/convex-helpers";

const modules = import.meta.glob("./**/*.ts");

/** Number of files still in Convex File Storage. */
function fileCount(t: ReturnType<typeof convexTest>) {
  return t.run(
    async (ctx) => (await ctx.db.system.query("_storage").collect()).length,
  );
}

describe("generateUploadUrl", () => {
  it("hands anonymous callers a URL to upload directly to Convex", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(api.storage.generateUploadUrl, {})).toContain(
      "/api/storage/upload",
    );
  });
});

describe("size and type come from storage, not the caller", () => {
  it("records the real byte length of the uploaded file", async () => {
    const t = convexTest(schema, modules);
    const html = "<h1>a slightly longer document</h1>";

    const { token } = await createPaste(t, {}, html);

    const paste = await t.query(api.pastes.getByToken, { token });
    expect(paste?.contentLength).toBe(html.length);
  });

  it("rejects an oversized upload no matter what the caller claims", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(
        new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "text/html" }),
      ),
    );

    expect(await codeOf(createPaste(t, { storageId }))).toBe(
      "PAYLOAD_TOO_LARGE",
    );
  });
});

describe("sweepOrphans", () => {
  afterEach(() => vi.useRealTimers());

  it("deletes abandoned uploads and keeps referenced ones", async () => {
    const t = convexTest(schema, modules);
    const orphan = await storeHtml(t, "<p>never attached</p>");
    await createPaste(t);
    expect(await fileCount(t)).toBe(2);

    // Nothing is old enough yet, so the first sweep is a no-op.
    await t.mutation(internal.storage.sweepOrphans, {});
    expect(await fileCount(t)).toBe(2);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + ORPHAN_GRACE_MS + 1);
    await t.mutation(internal.storage.sweepOrphans, {});

    expect(await fileCount(t)).toBe(1);
    await t.run(async (ctx) => {
      expect(await ctx.db.system.get("_storage", orphan)).toBeNull();
    });
  });

  it("continues through more orphans than fit in one batch", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < 120; i++) await storeHtml(t, `<p>${i}</p>`);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + ORPHAN_GRACE_MS + 1);
    await t.mutation(internal.storage.sweepOrphans, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await fileCount(t)).toBe(0);
  });
});
