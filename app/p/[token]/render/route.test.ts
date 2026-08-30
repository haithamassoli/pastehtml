import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = query;
    mutation = vi.fn();
  },
}));

const { GET } = await import("./route");

const HTML = "<script>document.title='ran'</script><form></form>";

const PASTE = {
  token: "abc123def456",
  filename: "index.html",
  visibility: "public" as const,
  contentType: "text/html; charset=utf-8",
  contentLength: HTML.length,
  sha256: "digest",
  url: "https://storage.test/file",
};

const get = (headers: Record<string, string> = {}) =>
  GET(
    new Request("http://localhost:3000/p/abc123def456/render", {
      headers,
    }) as never,
    { params: Promise.resolve({ token: "abc123def456" }) } as never,
  );

const sandbox = (response: Response) =>
  (response.headers.get("Content-Security-Policy") ?? "").split(/\s+/);

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue(PASTE);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(HTML, { status: 200 })),
  );
});

describe("preview endpoint", () => {
  it("renders the paste as HTML", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(HTML);
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8",
    );
  });

  it("sandboxes the document into an opaque origin", async () => {
    const directive = sandbox(await get());

    expect(directive[0]).toBe("sandbox");
    // The one capability that must never be granted: with it, scripts in the
    // preview would run with the app's origin, cookies and API access.
    expect(directive).not.toContain("allow-same-origin");
  });

  it("still allows what a preview legitimately needs", async () => {
    const directive = sandbox(await get());

    expect(directive).toContain("allow-scripts");
    expect(directive).toContain("allow-forms");
    expect(directive).toContain("allow-modals");
  });

  it("caches and revalidates like the runtime", async () => {
    const response = await get();
    expect(response.headers.get("ETag")).toBe('"digest"');
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");

    expect((await get({ "if-none-match": '"digest"' })).status).toBe(304);
  });

  it("404s an unknown token and withholds a protected paste", async () => {
    query.mockResolvedValue(null);
    expect((await get()).status).toBe(404);

    query.mockResolvedValue({ ...PASTE, visibility: "protected" });
    expect((await get()).status).toBe(401);
  });
});
