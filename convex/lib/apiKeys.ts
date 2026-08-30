// API-key credentials for automation. The raw secret is returned exactly once
// at creation and never persisted — only its SHA-256, as with update tokens.
// A key is high-entropy random, so a plain digest is the right primitive here;
// PBKDF2 is for passwords, which are not.
import type { QueryCtx } from "../_generated/server";
import type { Scope } from "../schema";
import { fail } from "./validation";
import { randomString, sha256Hex } from "./tokens";

/** Identifies our keys on sight, so `Authorization: Bearer` can be routed. */
export const API_KEY_PREFIX = "ph_";
const SECRET_LENGTH = 40;
/** Enough of the key to recognise it in a list, far too little to use. */
const DISPLAY_PREFIX_LENGTH = 6;

export function generateApiKey(): { key: string; keyPrefix: string } {
  const key = API_KEY_PREFIX + randomString(SECRET_LENGTH);
  return {
    key,
    keyPrefix: key.slice(0, API_KEY_PREFIX.length + DISPLAY_PREFIX_LENGTH),
  };
}

export const looksLikeApiKey = (value: string) =>
  value.startsWith(API_KEY_PREFIX);

/**
 * The account behind a presented key, or a rejection. Revoked and expired keys
 * are refused here, so no caller can forget the check.
 */
export async function verifyApiKey(
  ctx: QueryCtx,
  key: string,
): Promise<{ ownerId: string; scopes: Scope[] }> {
  const keyHash = await sha256Hex(key);
  const record = await ctx.db
    .query("apiKeys")
    .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
    .unique();

  // One message for every failure: a caller learns their key does not work,
  // never whether it once existed, was revoked, or merely expired.
  // ponytail: wall clock in a query, which the Convex guidelines warn about for
  // cache staleness. Correct here — expiry must be decided server-side, and an
  // API request is not a subscription that could sit on a stale answer.
  if (
    record === null ||
    record.revokedAt !== undefined ||
    (record.expiresAt !== undefined && record.expiresAt <= Date.now())
  )
    fail("UNAUTHORIZED", "Invalid or expired API key.");

  return { ownerId: record.ownerId, scopes: record.scopes };
}
