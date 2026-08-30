// @vitest-environment edge-runtime
// Authorization cases that span two functions or two credentials, and so have
// no home in the per-module suites: the same rejection from every door into an
// owned resource, one scope enforced whichever function reaches an operation,
// and the guessing resistance of the anonymous update token. Anything provable
// inside one module is tested there — see `pastes.test.ts`, `folders.test.ts`,
// `apiKeys.test.ts`, `analytics.test.ts` and `password.test.ts`.
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { ConvexError } from "convex/values";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Scope } from "./schema";
import { MAX_UNLOCK_ATTEMPTS_PER_PASTE } from "./pastes";
import { codeOf, createPaste, storeHtml, users } from "../test/convex-helpers";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  return { t, ...users(t) };
}

/** The whole `{ code, message }` payload, not just the code `codeOf` returns. */
async function rejection(
  promise: Promise<unknown>,
): Promise<{ code?: string; message?: string }> {
  try {
    await promise;
  } catch (error) {
    return (error as ConvexError<{ code: string; message: string }>).data ?? {};
  }
  throw new Error("expected a rejection");
}

const keyFor = (
  actor: ReturnType<typeof users>["alice"],
  scopes: Scope[],
): Promise<{ key: string }> =>
  actor.mutation(api.apiKeys.create, { name: "ci", scopes });

describe("cross-account access", () => {
  it("refuses every owner-only entry point, and says nothing else", async () => {
    const { alice, bob } = setup();
    const folderId = await alice.mutation(api.folders.create, {
      name: "Alice's folder",
    });
    const { keyId } = await alice.mutation(api.apiKeys.create, {
      name: "alice-ci",
      scopes: ["pastes:read"],
    });
    const { token, pasteId } = await createPaste(alice, {
      title: "Alice's private draft",
      folderId,
    });
    const storageId = await storeHtml(bob);

    // Read, update, delete, content replacement, password control, analytics,
    // folder listing, folder management and key revocation — every route bob
    // could take at something of alice's.
    const attempts: [string, () => Promise<unknown>, string][] = [
      [
        "getOwned",
        () => bob.query(api.pastes.getOwned, { token }),
        "FORBIDDEN",
      ],
      [
        "update",
        () => bob.mutation(api.pastes.update, { token, title: "mine" }),
        "FORBIDDEN",
      ],
      ["remove", () => bob.mutation(api.pastes.remove, { token }), "FORBIDDEN"],
      [
        "replaceContent",
        () =>
          bob.mutation(api.pastes.replaceContent, {
            token,
            storageId,
            contentType: "text/html",
          }),
        "FORBIDDEN",
      ],
      [
        "setPassword",
        () =>
          bob.mutation(api.pastes.setPassword, {
            token,
            password: "hunter2222",
          }),
        "FORBIDDEN",
      ],
      [
        "removePassword",
        () => bob.mutation(api.pastes.removePassword, { token }),
        "FORBIDDEN",
      ],
      [
        "analytics",
        () => bob.query(api.analytics.forPaste, { token }),
        "FORBIDDEN",
      ],
      [
        "folders.get",
        () => bob.query(api.folders.get, { folderId }),
        "FORBIDDEN",
      ],
      [
        "folders.rename",
        () => bob.mutation(api.folders.rename, { folderId, name: "x" }),
        "FORBIDDEN",
      ],
      [
        "folders.remove",
        () => bob.mutation(api.folders.remove, { folderId }),
        "FORBIDDEN",
      ],
      [
        "apiKeys.revoke",
        () => bob.mutation(api.apiKeys.revoke, { keyId }),
        "FORBIDDEN",
      ],
      // The folder is the thing bob does not own, so this one reads as absent
      // rather than forbidden — and either way lists nothing.
      [
        "listByFolder",
        () => bob.query(api.pastes.listByFolder, { folderId }),
        "NOT_FOUND",
      ],
    ];

    for (const [name, attempt, code] of attempts) {
      const data = await rejection(attempt());
      expect(data, name).toEqual({ code, message: expect.any(String) });
      // A rejection is the answer to "may I", never a peek at what was behind
      // it: no owner identity, no title, no internal id.
      const serialized = JSON.stringify(data);
      for (const secret of [
        "user_alice",
        "clerk.test",
        "Alice's private draft",
        "Alice's folder",
        pasteId,
        folderId,
        keyId,
        storageId,
      ])
        expect(serialized, name).not.toContain(secret);
    }

    // Nothing bob attempted landed.
    expect(await alice.query(api.pastes.getOwned, { token })).toMatchObject({
      title: "Alice's private draft",
      visibility: "public",
      folderId,
    });
  });
});

describe("API-key scopes", () => {
  it("enforces the same scope whichever function reaches the operation", async () => {
    const { t, alice } = setup();
    const { key } = await keyFor(alice, ["pastes:delete"]);
    const { token } = await createPaste(alice);

    // A key scoped to deletion alone. Every other operation on a paste — read,
    // metadata edit, content replacement, and both halves of password
    // protection — has to refuse it, because the scope is checked inside each
    // function rather than at whichever surface called it.
    const storageId = await storeHtml(t);
    for (const [name, attempt] of [
      ["create", () => createPaste(t, { apiKey: key })],
      ["getOwned", () => t.query(api.pastes.getOwned, { token, apiKey: key })],
      ["listByOwner", () => t.query(api.pastes.listByOwner, { apiKey: key })],
      [
        "update",
        () => t.mutation(api.pastes.update, { token, apiKey: key, title: "x" }),
      ],
      [
        "replaceContent",
        () =>
          t.mutation(api.pastes.replaceContent, {
            token,
            apiKey: key,
            storageId,
            contentType: "text/html",
          }),
      ],
      [
        "setPassword",
        () =>
          t.mutation(api.pastes.setPassword, {
            token,
            apiKey: key,
            password: "hunter2222",
          }),
      ],
      [
        "removePassword",
        () => t.mutation(api.pastes.removePassword, { token, apiKey: key }),
      ],
    ] as [string, () => Promise<unknown>][])
      expect(await codeOf(attempt()), name).toBe("FORBIDDEN");

    // The one thing it may do, so the refusals above are the scope talking and
    // not the key being broken.
    await t.mutation(api.pastes.remove, { token, apiKey: key });
  });

  // Folder membership is a folder operation whichever function reaches it, so
  // `pastes.update({ folderId })` costs `folders:write` on top of the paste
  // scope. Without it a key scoped deliberately to pastes could refile its
  // owner's pastes, which would make the folder scopes decorative.
  it("keeps a paste-only key out of folder membership", async () => {
    const { t, alice } = setup();
    const { key } = await keyFor(alice, ["pastes:write"]);
    const folderId = await alice.mutation(api.folders.create, { name: "Work" });
    const { token } = await createPaste(alice);

    expect(
      await codeOf(
        t.mutation(api.pastes.update, { token, apiKey: key, folderId }),
      ),
    ).toBe("FORBIDDEN");
  });
});

describe("anonymous update tokens", () => {
  it("refuses a wrong, truncated, or another paste's token", async () => {
    const t = convexTest(schema, modules);
    const mine = await createPaste(t);
    const theirs = await createPaste(t);
    const updateToken = mine.updateToken!;

    // A valid secret is still a secret for exactly one paste, and a near miss
    // is a miss: the comparison is over the digest, so a truncated or
    // one-character-off guess tells an attacker nothing about how close it was.
    const guesses = {
      "another paste's live token": theirs.updateToken!,
      truncated: updateToken.slice(0, -1),
      "one character off": updateToken.slice(0, -1) + "0",
      lengthened: updateToken + "0",
      empty: "",
    };
    for (const [why, guess] of Object.entries(guesses))
      expect(
        await codeOf(
          t.mutation(api.pastes.update, {
            token: mine.token,
            updateToken: guess,
            title: why,
          }),
        ),
        why,
        // An empty string is "no credential presented", not a bad one.
      ).toBe(guess === "" ? "UNAUTHORIZED" : "FORBIDDEN");

    // The real one still works, so the refusals above are the check, not luck.
    await t.mutation(api.pastes.update, {
      token: mine.token,
      updateToken,
      title: "ok",
    });
    expect(
      (await t.query(api.pastes.getByToken, { token: mine.token }))!.title,
    ).toBe("ok");
  });

  it("leaves an owned paste unmanageable by any token at all", async () => {
    const { t, alice } = setup();
    const owned = await createPaste(alice);
    // A genuinely valid update token — for a different, anonymous paste. An
    // owned paste has no token credential, so the caller is asked to sign in
    // rather than told the token was wrong.
    const anonymous = await createPaste(t);

    expect(
      await codeOf(
        t.mutation(api.pastes.update, {
          token: owned.token,
          updateToken: anonymous.updateToken,
          title: "hijack",
        }),
      ),
    ).toBe("UNAUTHORIZED");
    expect(
      await codeOf(
        t.mutation(api.pastes.remove, {
          token: owned.token,
          updateToken: anonymous.updateToken,
        }),
      ),
    ).toBe("UNAUTHORIZED");
  });
});

describe("password brute force", () => {
  // The cap itself, its per-client scope, its reset and the no-free-guess rule
  // are covered in `password.test.ts`. What is left is the way around it.
  //
  // `pastes.unlock` is a public Convex mutation and `client` is just an
  // argument, so a caller reaching the deployment directly picks a fresh label
  // per guess. The per-client cap therefore cannot be the one that binds: the
  // per-paste cap is, because it counts every failure against the paste no
  // matter what the caller calls itself.
  it("caps guesses that rotate the client identifier", async () => {
    const t = convexTest(schema, modules);
    const { alice } = users(t);
    const { token } = await createPaste(alice);
    await alice.mutation(api.pastes.setPassword, {
      token,
      password: "correct horse battery",
    });

    for (let attempt = 0; attempt <= MAX_UNLOCK_ATTEMPTS_PER_PASTE; attempt++)
      await t.mutation(api.pastes.unlock, {
        subdomain: token,
        password: "wrong",
        client: `198.51.100.${attempt}`,
      });

    expect(
      await t.mutation(api.pastes.unlock, {
        subdomain: token,
        password: "wrong",
        client: "198.51.100.254",
      }),
    ).toMatchObject({ reason: "throttled" });
  });
});
