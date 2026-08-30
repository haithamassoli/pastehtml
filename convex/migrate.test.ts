// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { codeOf, users } from "../test/convex-helpers";
import {
  legacyFailures,
  legacyFolders,
  legacyOwners,
  legacyPastes,
  type LegacyFolder,
  type LegacyPaste,
} from "../test/fixtures/legacy-export";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  return { t, ...users(t) };
}

type T = ReturnType<typeof setup>["t"];

const bytesOf = (html: string) => new TextEncoder().encode(html);

/**
 * The two spellings of one SHA-256. Convex's own type calls the stored digest
 * hex while `convex-test` encodes it base64, so pinning either encoding gives a
 * byte-fidelity check that passes here and fails on staging, or the reverse.
 * The digest is the same either way; `scripts/migrate-validate.mjs` compares
 * the same way, for the same reason.
 */
async function digests(bytes: Uint8Array): Promise<string[]> {
  const buffer = new Uint8Array(
    await crypto.subtle.digest("SHA-256", bytes as BufferSource),
  );
  return [
    Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    btoa(String.fromCharCode(...buffer)),
  ];
}

/**
 * Everything `scripts/migrate-import.mjs` does before it reaches Convex: drop
 * records whose owner cannot be resolved to a Clerk identity, upload the bytes
 * to File Storage, and turn legacy ids into Convex ids. Kept in the test rather
 * than shared with the driver because the driver is plain JS run by an
 * operator, and duplicating twelve lines beats making a backend module import
 * from `scripts/`.
 */
async function importExport(
  t: T,
  options: {
    pastes?: LegacyPaste[];
    folders?: LegacyFolder[];
    owners?: Record<string, string>;
  } = {},
) {
  const {
    pastes = legacyPastes,
    folders = legacyFolders,
    owners = legacyOwners,
  } = options;

  const folderResults = await t.action(internal.migrate.importBatch, {
    folders: folders.flatMap((folder) => {
      const ownerId = owners[folder.legacyOwnerId];
      return ownerId
        ? [
            {
              legacyId: folder.legacyId,
              ownerId,
              name: folder.name,
              createdAt: folder.createdAt,
              updatedAt: folder.updatedAt,
            },
          ]
        : [];
    }),
    pastes: [],
  });

  const folderIds = new Map(
    folderResults
      .filter((result) => result.id)
      .map((result) => [result.legacyId, result.id as Id<"folders">]),
  );
  const storageIds = new Map<string, Id<"_storage">>();

  const records = [];
  for (const paste of pastes) {
    const storageId = await t.run((ctx) =>
      ctx.storage.store(
        new Blob([bytesOf(paste.html)], { type: paste.contentType }),
      ),
    );
    storageIds.set(paste.legacyId, storageId);
    const ownerId = paste.legacyOwnerId
      ? owners[paste.legacyOwnerId]
      : undefined;
    records.push({
      legacyId: paste.legacyId,
      token: paste.token,
      ownerId,
      // A folder the owner did not resolve for has no id to point at.
      folderId:
        ownerId && paste.legacyFolderId
          ? folderIds.get(paste.legacyFolderId)
          : undefined,
      storageId,
      filename: paste.filename,
      title: paste.title,
      description: paste.description,
      customSubdomain: paste.customSubdomain,
      contentType: paste.contentType,
      visibility: paste.visibility,
      password: paste.password,
      updateToken: paste.updateToken,
      viewsCount: paste.viewsCount,
      createdAt: paste.createdAt,
      updatedAt: paste.updatedAt,
    });
  }

  const results = await t.action(internal.migrate.importBatch, {
    folders: [],
    pastes: records,
  });
  return { results, folderIds, storageIds };
}

const inspectOne = async (t: T, token: string) =>
  (await t.query(internal.migrate.inspect, { tokens: [token] }))[0];

async function allTokens(t: T): Promise<string[]> {
  const tokens: string[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: { tokens: string[]; cursor: string | null; isDone: boolean } =
      await t.query(internal.migrate.listTokens, { cursor });
    tokens.push(...page.tokens);
    if (page.isDone) return tokens;
    cursor = page.cursor;
  }
}

describe("migrate.importBatch", () => {
  it("imports every record and preserves tokens, timestamps and metadata", async () => {
    const { t } = setup();

    const { results } = await importExport(t);

    expect(results).toHaveLength(legacyPastes.length);
    expect(results.every((r) => r.status === "imported")).toBe(true);
    expect(await allTokens(t)).toHaveLength(legacyPastes.length);

    const source = legacyPastes[0];
    const paste = await inspectOne(t, source.token);
    expect(paste).toMatchObject({
      token: source.token,
      customSubdomain: "first-demo",
      filename: "index.html",
      title: source.title,
      description: source.description,
      visibility: "public",
      viewsCount: 1204,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    });
    // The original timestamps, not the moment the migration ran.
    expect(paste!.createdAt).toBeLessThan(paste!.updatedAt);
  });

  it("hands ownership to the mapped Clerk identity and nobody else", async () => {
    const { t, alice, bob } = setup();

    await importExport(t);

    const owned = await alice.query(api.pastes.getOwned, {
      token: "aaaa11112222",
    });
    expect(owned.title).toBe("Landing page");
    expect(
      await codeOf(bob.query(api.pastes.getOwned, { token: owned.token })),
    ).toBe("FORBIDDEN");

    // A legacy owner with no Clerk identity lands anonymous rather than lost:
    // the URL keeps working, which is the point of the migration.
    expect((await inspectOne(t, "iiii11112222"))!.ownerId).toBeUndefined();
  });

  it("attaches an owner a later run can resolve, without duplicating", async () => {
    const { t, bob } = setup();
    await importExport(t);

    const { results } = await importExport(t, {
      owners: { ...legacyOwners, "99": "https://clerk.test|user_bob" },
    });

    expect(results.every((r) => r.status === "skipped")).toBe(true);
    expect(await allTokens(t)).toHaveLength(legacyPastes.length);
    const claimed = await bob.query(api.pastes.getOwned, {
      token: "iiii11112222",
    });
    expect(claimed.isOwned).toBe(true);
  });

  it("preserves folder membership and folder ownership", async () => {
    const { t, alice } = setup();

    const { folderIds } = await importExport(t);

    const paste = await inspectOne(t, "bbbb11112222");
    expect(paste!.folderName).toBe("Demos");
    expect(paste!.folderOwnerId).toBe(paste!.ownerId);

    const listed = await alice.query(api.pastes.listByFolder, {
      folderId: folderIds.get("10")!,
    });
    expect(listed.map((p) => p.token)).toEqual(["bbbb11112222"]);
  });

  it("stores HTML byte for byte", async () => {
    const { t } = setup();

    const { storageIds } = await importExport(t);

    // Unicode, inline CSS/JS, and markup no parser would round-trip.
    for (const legacyId of ["1006", "1007", "1008"]) {
      const source = legacyPastes.find((p) => p.legacyId === legacyId)!;
      const expected = bytesOf(source.html);

      // The buffer crosses the boundary, not the Blob: only Convex values may.
      const stored = await t.run(async (ctx) => {
        const blob = await ctx.storage.get(storageIds.get(legacyId)!);
        return await blob!.arrayBuffer();
      });
      expect(Array.from(new Uint8Array(stored))).toEqual(Array.from(expected));

      const paste = await inspectOne(t, source.token);
      expect(paste!.contentLength).toBe(expected.byteLength);
      expect(await digests(expected)).toContain(paste!.sha256);
    }
  });

  it("serves migrated pastes at their old URLs", async () => {
    const { t } = setup();

    await importExport(t);

    for (const subdomain of ["aaaa11112222", "first-demo"]) {
      const resolved = await t.query(api.pastes.resolveForRuntime, {
        subdomain,
      });
      expect(resolved).toMatchObject({
        token: "aaaa11112222",
        locked: false,
        disabled: false,
      });
      expect(resolved!.url).not.toBeNull();
    }
  });

  it("carries an anonymous paste's update token across", async () => {
    const { t } = setup();

    await importExport(t);

    await t.mutation(api.pastes.update, {
      token: "cccc11112222",
      updateToken: "legacyedittoken0000000000000000x",
      title: "still mine",
    });
    expect((await inspectOne(t, "cccc11112222"))!.title).toBe("still mine");

    expect(
      await codeOf(
        t.mutation(api.pastes.update, {
          token: "cccc11112222",
          updateToken: "x".repeat(32),
          title: "not yours",
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("locks a protected paste whose digest could not come with it", async () => {
    const { t, alice } = setup();
    await importExport(t);

    const locked = await t.query(api.pastes.resolveForRuntime, {
      subdomain: "dddd11112222",
    });
    expect(locked).toMatchObject({ visibility: "protected", locked: true });
    expect(locked!.url).toBeNull();

    // No password opens it — not the legacy one, not anything.
    expect(
      await t.mutation(api.pastes.unlock, {
        subdomain: "dddd11112222",
        password: "whatever-it-used-to-be",
        client: "1.2.3.4",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    // The owner's reset is the documented way back in.
    await alice.mutation(api.pastes.setPassword, {
      token: "dddd11112222",
      password: "a-brand-new-one",
    });
    const opened = await t.mutation(api.pastes.unlock, {
      subdomain: "dddd11112222",
      password: "a-brand-new-one",
      client: "1.2.3.4",
    });
    expect(opened.ok).toBe(true);
  });

  it("keeps a recoverable legacy password working", async () => {
    const { t } = setup();
    await importExport(t);

    const opened = await t.mutation(api.pastes.unlock, {
      subdomain: "eeee11112222",
      password: "hunter2!",
      client: "1.2.3.4",
    });
    expect(opened.ok).toBe(true);

    const resolved = await t.query(api.pastes.resolveForRuntime, {
      subdomain: "eeee11112222",
      unlockToken: opened.ok ? opened.unlockToken : undefined,
    });
    expect(resolved!.locked).toBe(false);
    expect(resolved!.url).not.toBeNull();
  });

  it("is idempotent: a second run duplicates nothing", async () => {
    const { t } = setup();
    await importExport(t);

    const { results } = await importExport(t);

    expect(results.every((r) => r.status === "skipped")).toBe(true);
    const tokens = await allTokens(t);
    expect(tokens).toHaveLength(legacyPastes.length);
    expect(new Set(tokens).size).toBe(tokens.length);
    // The re-run's uploads are left unreferenced for `storage.sweepOrphans`;
    // no paste was ever repointed at one.
    expect((await inspectOne(t, "aaaa11112222"))!.viewsCount).toBe(1204);
  });

  it("reports per-record failures without abandoning the batch", async () => {
    const { t } = setup();

    const { results } = await importExport(t, {
      pastes: [...legacyFailures, legacyPastes[0]],
    });

    expect(results.map((r) => r.status)).toEqual([
      "failed",
      "failed",
      "failed",
      "imported",
    ]);
    // Reserved subdomain, a token the wildcard host could never resolve, and
    // timestamps exported in seconds.
    expect(results[0].error).toContain("CONFLICT");
    expect(results[1].error).toContain("not a lowercase DNS label");
    expect(results[2].error).toContain("seconds, not milliseconds");
    expect(await allTokens(t)).toEqual(["aaaa11112222"]);
  });
});

describe("migrate.rollback", () => {
  it("removes imported pastes and their stored bytes", async () => {
    const { t } = setup();
    const { storageIds } = await importExport(t);

    const { deleted } = await t.mutation(internal.migrate.rollback, {
      tokens: legacyPastes.map((paste) => paste.token),
    });

    expect(deleted).toBe(legacyPastes.length);
    expect(await allTokens(t)).toEqual([]);
    expect(
      await t.run((ctx) =>
        ctx.db.system.get("_storage", storageIds.get("1001")!),
      ),
    ).toBeNull();
  });
});
