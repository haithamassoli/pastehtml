// Environment variable validation. Fails fast at import time if a required
// variable is missing, so misconfiguration surfaces at boot, not mid-request.
// ponytail: hand-rolled check instead of zod — env is developer-controlled and
// the set is small. Add a schema lib only if this grows real shape validation.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// NEXT_PUBLIC_* must be referenced by literal so Next.js can inline them.
export const env = {
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  CONVEX_URL: required(
    "NEXT_PUBLIC_CONVEX_URL",
    process.env.NEXT_PUBLIC_CONVEX_URL,
  ),
  CLERK_PUBLISHABLE_KEY: required(
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  ),
} as const;

// Server-only secrets. Read lazily so client bundles never touch them.
export function serverEnv() {
  return {
    CLERK_SECRET_KEY: required(
      "CLERK_SECRET_KEY",
      process.env.CLERK_SECRET_KEY,
    ),
  } as const;
}
