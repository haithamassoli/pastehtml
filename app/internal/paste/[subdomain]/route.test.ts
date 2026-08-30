import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, mutation, after } = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  after: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = query;
    mutation = mutation;
  },
}));
// The real `after` needs a request scope; the spy proves the call is deferred.
vi.mock("next/server", () => ({ after }));

const { GET } = await import("./route");

const PASTE = {
  token: "abc123def456",
  visibility: "public" as const,
  contentType: "text/html; charset=utf-8",
  contentLength: 16,
  sha256: "digest",
  url: "https://storage.test/file",
};

const get = (headers: Record<string, string> = {}) =>
  GET(
    new Request("http://abc123def456.localhost/", { headers }) as never,
    {
      params: Promise.resolve({ subdomain: "abc123def456" }),
    } as never,
  );

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue(PASTE);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("<h1>runtime</h1>", { status: 200 })),
  );
});

describe("paste runtime", () => {
  it("serves the stored HTML verbatim with its own content type", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>runtime</h1>");
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("ETag")).toBe('"digest"');
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("never sets a cookie on the paste origin", async () => {
    const response = await get();
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("defers the view recording so it cannot block delivery", async () => {
    await get();

    expect(after).toHaveBeenCalledOnce();
    expect(mutation).not.toHaveBeenCalled();
    after.mock.calls[0][0]();
    expect(mutation).toHaveBeenCalledWith(expect.anything(), {
      token: "abc123def456",
      referrer: undefined,
    });
  });

  it("answers a conditional request with 304 and no body", async () => {
    const response = await get({ "if-none-match": 'W/"digest", "other"' });

    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still fetches when the ETag does not match", async () => {
    const response = await get({ "if-none-match": '"stale"' });

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("404s an unknown subdomain", async () => {
    query.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(after).not.toHaveBeenCalled();
  });

  it("404s when the stored object has gone missing", async () => {
    query.mockResolvedValue({ ...PASTE, url: null });

    expect((await get()).status).toBe(404);
  });

  it("withholds a protected paste until Milestone 9 unlocks it", async () => {
    query.mockResolvedValue({ ...PASTE, visibility: "protected" });

    const response = await get();

    expect(response.status).toBe(401);
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
