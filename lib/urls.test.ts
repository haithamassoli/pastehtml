import { describe, expect, it } from "vitest";
import { pasteUrls } from "./urls";
import { config } from "./config";

describe("pasteUrls", () => {
  it("puts the content on its own wildcard host and everything else on the app", () => {
    const { host, protocol } = new URL(config.appUrl);

    expect(pasteUrls("abc123")).toEqual({
      publicUrl: `${protocol}//abc123.${host}`,
      pageUrl: `${protocol}//${host}/p/abc123`,
      rawUrl: `${protocol}//${host}/p/abc123/raw`,
      renderUrl: `${protocol}//${host}/p/abc123/render`,
    });
  });
});
