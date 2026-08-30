import { config } from "./config";

/**
 * The create-paste response contract's URL half. Every surface that publishes a
 * paste — the home page, the REST API, MCP — returns these two URLs.
 *
 * `publicUrl` is the wildcard host that serves the stored HTML verbatim;
 * `rawUrl` is the app route that returns the original bytes.
 */
export function pasteUrls(token: string): {
  publicUrl: string;
  rawUrl: string;
} {
  const { protocol, host } = new URL(config.appUrl);
  return {
    publicUrl: `${protocol}//${token}.${host}`,
    rawUrl: `${protocol}//${host}/p/${token}/raw`,
  };
}
