// Application-side auth. Clerk answers "who is calling?" for server components
// and route handlers; Convex answers "may they touch this?" from the identity in
// the JWT it verifies itself. Ownership is therefore never decided here — a
// guard in this file would be advisory, and a caller could skip it.
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { AppError } from "./errors";
import { env } from "./env";

/** The signed-in caller, as Clerk sees them on this request. */
export type CurrentUser = {
  /** Clerk's user id. Not the Convex `ownerId` — that is `tokenIdentifier`. */
  userId: string;
  sessionId: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId, sessionId } = await auth();
  return userId ? { userId, sessionId } : null;
}

/**
 * The caller, or an `AppError` — which carries the 401 and the stable error
 * code, so a route handler can answer with `error.toResponse()`.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED", "Sign in required.");
  return user;
}

/**
 * A Convex client that calls as the signed-in user, by forwarding Clerk's
 * "convex" JWT — the same template the browser client uses. Without the token
 * Convex sees an anonymous caller, so every authenticated read or write from
 * the server must go through here.
 */
export async function authedConvex(): Promise<ConvexHttpClient> {
  const { getToken } = await auth();
  const client = new ConvexHttpClient(env.CONVEX_URL);
  const token = await getToken({ template: "convex" });
  if (token) client.setAuth(token);
  return client;
}

export type OwnedPaste = FunctionReturnType<typeof api.pastes.getOwned>;

/**
 * Ownership guard for server components and route handlers. The check runs
 * inside Convex against the identity in the forwarded token, so this cannot be
 * fooled by a caller-supplied id; a stranger gets FORBIDDEN, a visitor 401.
 */
export async function requireOwnedPaste(token: string): Promise<OwnedPaste> {
  await requireCurrentUser();
  const convex = await authedConvex();
  return await convex.query(api.pastes.getOwned, { token });
}
