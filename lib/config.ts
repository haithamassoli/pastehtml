import { env } from "./env";

// Centralized app configuration. Values that never change live here as
// literals; anything environment-derived comes through `env`.
export const config = {
  appName: "pastehtml.dev",
  appUrl: env.APP_URL,
  // Root domain used to distinguish the app from wildcard paste subdomains.
  rootDomain: new URL(env.APP_URL).host,
  // Max HTML upload size. Tune in Milestone 2.
  maxUploadBytes: 5 * 1024 * 1024,
  paste: {
    tokenLength: 12,
  },
} as const;
