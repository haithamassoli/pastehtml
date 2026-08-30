import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { Scope } from "../schema";
import { fail } from "./validation";
import { sha256Hex, timingSafeEqual } from "./tokens";
import { verifyApiKey } from "./apiKeys";

/**
 * A caller acting as an account. `id` is Clerk's `tokenIdentifier` — the
 * canonical stable identity key — and is what every `ownerId` column stores.
 *
 * `scopes` is present only when the caller proved themselves with an API key;
 * a browser session is unscoped and may do anything its owner may do.
 */
export type CurrentUser = {
  id: string;
  email?: string;
  name?: string;
  scopes?: readonly Scope[];
};

/**
 * The secrets a non-browser caller may present. Both are raw values compared
 * against stored digests; neither is ever an identifier the caller picks.
 */
export type Credentials = {
  /** Anonymous management secret, issued once when the paste was published. */
  updateToken?: string;
  /** `ph_…` API key, for scripts and automation. */
  apiKey?: string;
};

/**
 * The caller, from whichever credential they presented. An API key wins over a
 * session token when both are somehow present, because the key is the one the
 * request explicitly named — and a bad key is rejected outright rather than
 * quietly downgraded to anonymous.
 */
export async function getCurrentUser(
  ctx: QueryCtx,
  credentials: Credentials = {},
): Promise<CurrentUser | null> {
  if (credentials.apiKey !== undefined) {
    const key = await verifyApiKey(ctx, credentials.apiKey);
    return { id: key.ownerId, scopes: key.scopes };
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return {
    id: identity.tokenIdentifier,
    email: identity.email,
    name: identity.name,
  };
}

export async function requireCurrentUser(
  ctx: QueryCtx,
  credentials: Credentials = {},
): Promise<CurrentUser> {
  const user = await getCurrentUser(ctx, credentials);
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
 * Scope enforcement, inside Convex rather than at the API edge, so a key can
 * never do more by taking a different route in. A session caller has no scope
 * list and is unrestricted.
 */
export function requireScope(user: CurrentUser, scope: Scope): void {
  if (user.scopes && !user.scopes.includes(scope))
    fail("FORBIDDEN", `This API key is missing the "${scope}" scope.`);
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
 * Authorizes a mutation on a paste. Owned pastes require the matching account —
 * a signed-in session or one of its API keys, carrying `scope`; anonymous
 * pastes require the raw update token issued at creation. An API key belongs to
 * an account, so it can never manage a paste that belongs to nobody.
 *
 * Returns the authorized caller, or `null` for the anonymous-token case, so a
 * handler that needs a second scope check (moving a paste between folders) has
 * the identity without verifying the same credential twice.
 */
export async function authorizePasteWrite(
  ctx: QueryCtx,
  paste: Doc<"pastes">,
  credentials: Credentials = {},
  scope: Scope = "pastes:write",
): Promise<CurrentUser | null> {
  if (paste.ownerId) {
    const user = await requireCurrentUser(ctx, credentials);
    requireOwner(user, paste);
    requireScope(user, scope);
    return user;
  }
  await requireUpdateToken(paste, credentials.updateToken);
  return null;
}
