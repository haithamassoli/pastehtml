// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { codeOf, storeHtml, users } from "../test/convex-helpers";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  return { t, ...users(t) };
}

const HTML = {
  filename: "index.html",
  contentType: "text/html",
  contentLength: 11,
};

describe("folder ownership", () => {
  it("creates, renames, and lists only the caller's folders", async () => {
    const { t, alice, bob } = setup();

    const folderId = await alice.mutation(api.folders.create, {
      name: "  Demos  ",
    });
    await bob.mutation(api.folders.create, { name: "Bob's" });

    const aliceFolders = await alice.query(api.folders.list, {});
    expect(aliceFolders).toHaveLength(1);
    expect(aliceFolders[0].name).toBe("Demos");

    await alice.mutation(api.folders.rename, { folderId, name: "Renamed" });
    expect((await alice.query(api.folders.get, { folderId })).name).toBe(
      "Renamed",
    );

    expect(await codeOf(t.query(api.folders.list, {}))).toBe("UNAUTHORIZED");
    expect(await codeOf(t.mutation(api.folders.create, { name: "x" }))).toBe(
      "UNAUTHORIZED",
    );
    expect(await codeOf(bob.query(api.folders.get, { folderId }))).toBe(
      "FORBIDDEN",
    );
    expect(
      await codeOf(bob.mutation(api.folders.rename, { folderId, name: "x" })),
    ).toBe("FORBIDDEN");
    expect(await codeOf(bob.mutation(api.folders.remove, { folderId }))).toBe(
      "FORBIDDEN",
    );
  });

  it("rejects empty folder names", async () => {
    const { alice } = setup();
    expect(
      await codeOf(alice.mutation(api.folders.create, { name: " " })),
    ).toBe("VALIDATION");
  });
});

describe("paste ↔ folder assignment", () => {
  it("moves a paste in and back out of a folder", async () => {
    const { t, alice } = setup();
    const storageId = await storeHtml(t);
    const folderId = await alice.mutation(api.folders.create, { name: "Work" });
    const { token } = await alice.mutation(api.pastes.create, {
      storageId,
      ...HTML,
    });

    await alice.mutation(api.pastes.update, { token, folderId });
    expect(
      await alice.query(api.pastes.listByFolder, { folderId }),
    ).toHaveLength(1);

    await alice.mutation(api.pastes.update, { token, folderId: null });
    expect(
      await alice.query(api.pastes.listByFolder, { folderId }),
    ).toHaveLength(0);
    // The paste itself survives leaving the folder.
    expect(await t.query(api.pastes.getByToken, { token })).not.toBeNull();
  });

  it("accepts a folder at creation time", async () => {
    const { t, alice } = setup();
    const storageId = await storeHtml(t);
    const folderId = await alice.mutation(api.folders.create, { name: "Work" });

    await alice.mutation(api.pastes.create, { storageId, folderId, ...HTML });
    expect(
      await alice.query(api.pastes.listByFolder, { folderId }),
    ).toHaveLength(1);
  });

  it("prevents cross-account folder assignment", async () => {
    const { t, alice, bob } = setup();
    const storageId = await storeHtml(t);
    const aliceFolder = await alice.mutation(api.folders.create, {
      name: "Alice",
    });
    const { token } = await bob.mutation(api.pastes.create, {
      storageId,
      ...HTML,
    });

    expect(
      await codeOf(
        bob.mutation(api.pastes.update, { token, folderId: aliceFolder }),
      ),
    ).toBe("NOT_FOUND");
    expect(
      await codeOf(
        bob.mutation(api.pastes.create, {
          storageId,
          folderId: aliceFolder,
          ...HTML,
        }),
      ),
    ).toBe("NOT_FOUND");
    expect(
      await codeOf(
        bob.query(api.pastes.listByFolder, { folderId: aliceFolder }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("refuses to file an anonymous paste", async () => {
    const { t, alice } = setup();
    const storageId = await storeHtml(t);
    const folderId = await alice.mutation(api.folders.create, { name: "Work" });

    expect(
      await codeOf(
        t.mutation(api.pastes.create, { storageId, folderId, ...HTML }),
      ),
    ).toBe("FORBIDDEN");
  });
});

describe("folders.remove", () => {
  // The detach runs as a scheduled function, so the test drives the clock.
  afterEach(() => vi.useRealTimers());

  it("keeps the contained pastes and detaches them", async () => {
    const { t, alice } = setup();
    const storageId = await storeHtml(t);
    const folderId = await alice.mutation(api.folders.create, { name: "Work" });

    const tokens: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { token } = await alice.mutation(api.pastes.create, {
        storageId,
        folderId,
        ...HTML,
      });
      tokens.push(token);
    }

    vi.useFakeTimers();
    await alice.mutation(api.folders.remove, { folderId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await alice.query(api.folders.list, {})).toHaveLength(0);
    const owned = await alice.query(api.pastes.listByOwner, {});
    expect(owned).toHaveLength(3);
    expect(owned.every((paste) => paste.folderId === undefined)).toBe(true);
    for (const token of tokens) {
      expect(await t.query(api.pastes.getByToken, { token })).not.toBeNull();
    }
  });
});
