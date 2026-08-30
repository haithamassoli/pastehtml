import { MAX_UPLOAD_BYTES } from "@/convex/lib/validation";
import { env } from "./env";

// Centralized app configuration. Values that never change live here as
// literals; anything environment-derived comes through `env`.
export const config = {
  appName: "pastehtml",
  appUrl: env.APP_URL,
  // Root domain used to distinguish the app from wildcard paste subdomains.
  rootDomain: new URL(env.APP_URL).host,
  // Single source of truth lives with the Convex validators.
  maxUploadBytes: MAX_UPLOAD_BYTES,
  paste: {
    tokenLength: 12,
  },
} as const;
