// Shared helpers for convex-test suites. Lives outside `convex/` so the Convex
// bundler never tries to deploy it as a backend module.
import type { TestConvex } from "convex-test";
import type { ConvexError } from "convex/values";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";
import type schema from "@/convex/schema";

type T = TestConvex<typeof schema>;
/** `t` itself or one of its signed-in identities. */
type Actor = ReturnType<T["withIdentity"]>;

/**
 * Resolves to the stable error code a Convex function rejected with, and
 * throws if it unexpectedly succeeded.
 */
export async function codeOf(
  promise: Promise<unknown>,
): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return (error as ConvexError<{ code: string }>).data?.code;
  }
  throw new Error("expected a rejection");
}

export function storeHtml(t: Actor, html = "<h1>hello</h1>") {
  return t.run((ctx) =>
    ctx.storage.store(new Blob([html], { type: "text/html" })),
  );
}

/**
 * Creates a paste over a freshly stored upload. Each call uploads its own file
 * because a storage id may only ever back a single paste.
 */
export async function createPaste(
  t: Actor,
  args: Partial<FunctionArgs<typeof api.pastes.create>> = {},
  html = "<h1>hello</h1>",
) {
  return await t.mutation(api.pastes.create, {
    storageId: await storeHtml(t, html),
    filename: "index.html",
    contentType: "text/html",
    ...args,
  });
}

/** Two distinct signed-in Clerk identities. */
export function users(t: T) {
  const issuer = "https://clerk.test";
  return {
    alice: t.withIdentity({ subject: "user_alice", issuer }),
    bob: t.withIdentity({ subject: "user_bob", issuer }),
  };
}
