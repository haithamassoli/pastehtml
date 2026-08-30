import { clerkSetup } from "@clerk/testing/playwright";

/**
 * Fetches a Clerk testing token (which bypasses bot protection) and the
 * Frontend API host, and leaves them in the environment the Playwright workers
 * inherit. Keys are read from `.env.local` by `clerkSetup` itself.
 */
export default async function globalSetup() {
  await clerkSetup();
}
