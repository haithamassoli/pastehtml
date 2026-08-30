import { describe, expect, it } from "vitest";
import { pasteUrls } from "./urls";
import { config } from "./config";

describe("pasteUrls", () => {
  it("builds the wildcard public URL and the raw URL from the app origin", () => {
    const { host, protocol } = new URL(config.appUrl);

    expect(pasteUrls("abc123")).toEqual({
      publicUrl: `${protocol}//abc123.${host}`,
      rawUrl: `${protocol}//${host}/p/abc123/raw`,
    });
  });
});
