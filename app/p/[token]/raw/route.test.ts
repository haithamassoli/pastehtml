import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = query;
    mutation = vi.fn();
  },
}));

const { GET } = await import("./route");

// Bytes chosen to break anything that re-encodes: multi-byte UTF-8, a BOM, a
// lone CR, a tab and a trailing newline.
const SOURCE = "﻿<h1>héllo — ünïcode</h1>\r\n\t<p>ok</p>\n";
const BYTES = new TextEncoder().encode(SOURCE);

const PASTE = {
  token: "abc123def456",
  filename: "index.html",
  visibility: "public" as const,
  contentType: "text/html; charset=utf-8",
  contentLength: BYTES.byteLength,
  sha256: "digest",
  url: "https://storage.test/file",
};

const get = (headers: Record<string, string> = {}) =>
  GET(
    new Request("http://localhost:3000/p/abc123def456/raw", {
      headers,
    }) as never,
    {
      params: Promise.resolve({ token: "abc123def456" }),
    } as never,
  );

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue(PASTE);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(BYTES, { status: 200 })),
  );
});

describe("raw endpoint", () => {
  it("returns the stored bytes unchanged", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
    expect(response.headers.get("Content-Length")).toBe(
      String(BYTES.byteLength),
    );
  });

  it("hands the content over as source text, never as executable HTML", async () => {
    const response = await get();

    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("names the file after the upload, encoded for the header", async () => {
    query.mockResolvedValue({ ...PASTE, filename: 'my "page" ünïcode.html' });

    expect((await get()).headers.get("Content-Disposition")).toBe(
      "inline; filename*=UTF-8''my%20%22page%22%20%C3%BCn%C3%AFcode.html",
    );
  });

  it("revalidates on every request and answers If-None-Match with 304", async () => {
    const response = await get();
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(response.headers.get("ETag")).toBe('"digest"');

    const conditional = await get({ "if-none-match": '"digest"' });
    expect(conditional.status).toBe(304);
    expect(conditional.body).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("404s an unknown token", async () => {
    query.mockResolvedValue(null);

    const response = await get();
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("withholds a protected paste", async () => {
    query.mockResolvedValue({ ...PASTE, visibility: "protected" });

    expect((await get()).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("502s when storage is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    expect((await get()).status).toBe(502);
  });
});
