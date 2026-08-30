import { config } from "./config";

/**
 * Every URL a paste has. `publicUrl` is the wildcard host that serves the
 * stored HTML verbatim; the rest live on the app origin — `pageUrl` is the
 * metadata page, `rawUrl` the original bytes as source text, `renderUrl` the
 * sandboxed preview.
 *
 * The create-paste response contract returns `publicUrl` and `rawUrl`; every
 * surface that publishes a paste — the home page, the REST API, MCP — uses this.
 */
export function pasteUrls(token: string): {
  publicUrl: string;
  pageUrl: string;
  rawUrl: string;
  renderUrl: string;
} {
  const { protocol, host } = new URL(config.appUrl);
  const pageUrl = `${protocol}//${host}/p/${token}`;
  return {
    publicUrl: `${protocol}//${token}.${host}`,
    pageUrl,
    rawUrl: `${pageUrl}/raw`,
    renderUrl: `${pageUrl}/render`,
  };
}
