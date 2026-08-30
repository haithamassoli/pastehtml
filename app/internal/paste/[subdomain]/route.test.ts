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

const { GET, POST } = await import("./route");

const PASTE = {
  token: "abc123def456",
  visibility: "public" as const,
  locked: false,
  contentType: "text/html; charset=utf-8",
  contentLength: 16,
  sha256: "digest",
  url: "https://storage.test/file",
};

const params = {
  params: Promise.resolve({ subdomain: "abc123def456" }),
} as never;

const get = (headers: Record<string, string> = {}) =>
  GET(
    new Request("http://abc123def456.localhost/", { headers }) as never,
    params,
  );

const post = (password: string, headers: Record<string, string> = {}) => {
  const body = new FormData();
  body.set("password", password);
  return POST(
    new Request("http://abc123def456.localhost/", {
      method: "POST",
      body,
      headers,
    }) as never,
    params,
  );
};

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
    await get({
      referer: "https://news.example.com/thread?user=ada",
      "x-vercel-ip-country": "PT",
      "user-agent":
        "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
    });

    expect(after).toHaveBeenCalledOnce();
    expect(mutation).not.toHaveBeenCalled();
    after.mock.calls[0][0]();
    expect(mutation).toHaveBeenCalledWith(expect.anything(), {
      token: "abc123def456",
      referrer: "https://news.example.com/thread?user=ada",
      country: "PT",
      // A bucket, never the string it came from.
      userAgentFamily: "chrome",
    });
  });

  it("serves a bot without counting it as a view", async () => {
    const response = await get({ "user-agent": "Googlebot/2.1" });

    expect(response.status).toBe(200);
    expect(after).not.toHaveBeenCalled();
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

  it("challenges for a locked paste instead of serving it", async () => {
    query.mockResolvedValue({
      ...PASTE,
      visibility: "protected",
      locked: true,
      url: null,
    });

    const response = await get();
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toContain('name="password"');
    // The challenge page is ours; nothing from the paste may load into it.
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "default-src 'none'",
    );
    // A locked paste is not counted as a view.
    expect(after).not.toHaveBeenCalled();
  });

  it("serves a protected paste once the unlock cookie is valid", async () => {
    query.mockResolvedValue({ ...PASTE, visibility: "protected" });

    const response = await get({ cookie: "ph_unlock=session-secret" });

    expect(response.status).toBe(200);
    // The cookie is what the query is asked to validate — never trusted here.
    expect(query).toHaveBeenCalledWith(expect.anything(), {
      subdomain: "abc123def456",
      unlockToken: "session-secret",
    });
  });

  it("502s when storage is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    expect((await get()).status).toBe(502);
  });
});

describe("unlock", () => {
  it("sets a host-only, script-unreadable cookie and redirects", async () => {
    mutation.mockResolvedValue({
      ok: true,
      unlockToken: "granted",
      expiresAt: Date.now() + 60_000,
    });

    const response = await post("correct horse");
    const cookie = response.headers.get("Set-Cookie")!;

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/");
    expect(cookie).toContain("ph_unlock=granted");
    expect(cookie).toContain("HttpOnly");
    // No Domain attribute: the browser scopes it to this paste's host alone.
    expect(cookie).not.toContain("Domain=");
  });

  it("passes the caller's address along for throttling", async () => {
    mutation.mockResolvedValue({
      ok: true,
      unlockToken: "g",
      expiresAt: Date.now(),
    });

    await post("pw", { "x-forwarded-for": "203.0.113.7, 10.0.0.1" });

    expect(mutation).toHaveBeenCalledWith(expect.anything(), {
      subdomain: "abc123def456",
      password: "pw",
      client: "203.0.113.7",
    });
  });

  it("re-challenges on a wrong password without setting a cookie", async () => {
    mutation.mockResolvedValue({ ok: false, reason: "invalid" });

    const response = await post("wrong");

    expect(response.status).toBe(401);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(await response.text()).toContain("Incorrect password.");
  });

  it("accepts its own challenge page's origin and refuses any other", async () => {
    mutation.mockResolvedValue({
      ok: true,
      unlockToken: "granted",
      expiresAt: Date.now() + 60_000,
    });

    const ours = await post("correct horse", {
      origin: "http://abc123def456.localhost",
    });
    expect(ours.status).toBe(303);

    // `null` is what a sandboxed or `no-referrer` page sends. It names nobody,
    // so it is refused — which is also why the challenge page must not carry
    // `Referrer-Policy: no-referrer`: Chrome would then send `null` for our own
    // form and lock every visitor out. The header below is the guard on that.
    for (const origin of ["null", "http://evil.example"]) {
      const theirs = await post("correct horse", { origin });
      expect(theirs.status, origin).toBe(401);
      expect(theirs.headers.get("Set-Cookie"), origin).toBeNull();
    }
  });

  it("does not let the challenge page suppress its own Origin", async () => {
    mutation.mockResolvedValue({ ok: false, reason: "invalid" });

    const response = await post("wrong");

    expect(response.headers.get("Referrer-Policy")).not.toBe("no-referrer");
  });

  it("answers a throttled attempt with 429", async () => {
    mutation.mockResolvedValue({ ok: false, reason: "throttled" });

    const response = await post("wrong");

    expect(response.status).toBe(429);
    expect(await response.text()).toContain("Too many attempts.");
  });
});
