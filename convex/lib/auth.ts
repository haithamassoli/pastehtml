import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { fail } from "./validation";
import { sha256Hex, timingSafeEqual } from "./tokens";

/**
 * A signed-in user. `id` is Clerk's `tokenIdentifier` — the canonical stable
 * identity key — and is what every `ownerId` column stores.
 */
export type CurrentUser = {
  id: string;
  email?: string;
  name?: string;
};

export async function getCurrentUser(
  ctx: QueryCtx,
): Promise<CurrentUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return {
    id: identity.tokenIdentifier,
    email: identity.email,
    name: identity.name,
  };
}

export async function requireCurrentUser(ctx: QueryCtx): Promise<CurrentUser> {
  const user = await getCurrentUser(ctx);
  if (!user) fail("UNAUTHORIZED", "Sign in required.");
  return user;
}

/** Owner-based access control for any document carrying an `ownerId`. */
export function requireOwner<T extends { ownerId?: string }>(
  user: CurrentUser,
  doc: T | null,
): asserts doc is T {
  if (!doc || doc.ownerId !== user.id) fail("FORBIDDEN", "Not your resource.");
}

/**
 * The anonymous management secret. Only its SHA-256 is stored, and the
 * comparison is constant-time, so a wrong guess leaks nothing about the hash.
 */
export async function requireUpdateToken(
  paste: Doc<"pastes">,
  updateToken?: string,
): Promise<void> {
  if (!updateToken || !paste.updateTokenHash)
    fail("UNAUTHORIZED", "An update token is required for this paste.");
  if (!timingSafeEqual(await sha256Hex(updateToken), paste.updateTokenHash))
    fail("FORBIDDEN", "Invalid update token.");
}

/**
 * Authorizes a mutation on a paste. Owned pastes require the matching signed-in
 * user; anonymous pastes require the raw update token issued at creation.
 */
export async function authorizePasteWrite(
  ctx: QueryCtx,
  paste: Doc<"pastes">,
  updateToken?: string,
): Promise<void> {
  if (paste.ownerId) {
    requireOwner(await requireCurrentUser(ctx), paste);
    return;
  }
  await requireUpdateToken(paste, updateToken);
}
