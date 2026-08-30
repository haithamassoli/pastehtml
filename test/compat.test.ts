import { beforeEach, describe, expect, it, vi } from "vitest";
import { legacyFixtures, sha256 } from "./fixtures/legacy/fixtures";

// Byte-for-byte compatibility for the legacy corpus, through the two surfaces a
// migrated URL lands on: the raw endpoint on the app origin and the wildcard
// runtime. Storage is mocked, so this runs in CI with no credentials and pins
// the serving layer; `e2e/compat.spec.ts` makes the same comparison against a
// real Convex deployment, a real upload and a real browser.
//
// The old Rails app is not runnable from this repo, so "compare old behavior"
// is verified as: what the corpus went in as is what comes back out — no
// re-encoding, no BOM stripping, no line-ending translation, no truncation.
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
vi.mock("next/server", () => ({ after }));

const { GET: raw } = await import("@/app/p/[token]/raw/route");
const { GET: runtime } = await import("@/app/internal/paste/[subdomain]/route");

const TOKEN = "k3n8pq2vd41x";

/**
 * What Convex reports for a stored object, given the bytes it holds. Length and
 * digest come from storage rather than from the uploader, which is what makes
 * the `Content-Length` below an independent check on the body.
 */
const stored = (bytes: Buffer, contentType = "text/html; charset=utf-8") => ({
  token: TOKEN,
  filename: "index.html",
  visibility: "public" as const,
  locked: false,
  disabled: false,
  contentType,
  contentLength: bytes.byteLength,
  sha256: sha256(bytes),
  url: "https://storage.test/file",
});

/**
 * Both handlers take a request and a params promise; their generated context
 * types differ only in the route they belong to, hence the `never`s.
 */
type Handler = (request: never, ctx: never) => Promise<Response>;

/** Serves `bytes` through one route and hands back the response. */
function serve(
  route: Handler,
  bytes: Buffer,
  token = TOKEN,
  contentType?: string,
) {
  query.mockResolvedValue({ ...stored(bytes, contentType), token });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array(bytes), { status: 200 })),
  );
  return route(
    new Request(`http://localhost:3000/${token}`) as never,
    {
      params: Promise.resolve({ token, subdomain: token }),
    } as never,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("legacy fixtures round-trip unchanged", () => {
  // The fixture files are the assertion, so a formatter or an editor quietly
  // "fixing" one would hollow out every test below without failing any of them.
  it("still contains the byte sequences it was built for", () => {
    const named = (name: string) =>
      legacyFixtures.find((fixture) => fixture.name === name)!.bytes;

    const whitespace = named("whitespace.html");
    expect(whitespace.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(whitespace.includes("\r\n")).toBe(true);
    // A lone CR, which a line-ending normaliser would turn into CRLF or LF.
    expect(/\r(?!\n)/.test(whitespace.toString("latin1"))).toBe(true);
    expect(whitespace.includes("\t")).toBe(true);
    expect(whitespace.subarray(-1).toString()).not.toBe("\n");

    // Multi-byte, so byte length and character length differ — anything that
    // measured the wrong one would send a short or long Content-Length.
    const unicode = named("unicode.html");
    expect(unicode.byteLength).toBeGreaterThan(unicode.toString("utf8").length);
    expect(unicode.toString("utf8")).toContain("🎉");

    expect(named("malformed.html").toString("utf8")).toContain("&safe=off");
    expect(named("large.html").byteLength).toBeGreaterThan(4.9 * 1024 * 1024);
    expect(named("large.html").byteLength).toBeLessThan(5 * 1024 * 1024);
  });

  for (const fixture of legacyFixtures) {
    describe(`${fixture.name} — ${fixture.why}`, () => {
      it("comes back from the raw endpoint byte for byte", async () => {
        const response = await serve(raw, fixture.bytes);
        const body = Buffer.from(await response.arrayBuffer());

        expect(response.status).toBe(200);
        expect(body.equals(fixture.bytes)).toBe(true);
        expect(body.byteLength).toBe(fixture.bytes.byteLength);
        expect(sha256(body)).toBe(sha256(fixture.bytes));
        expect(response.headers.get("Content-Length")).toBe(
          String(fixture.bytes.byteLength),
        );
        expect(response.headers.get("ETag")).toBe(`"${sha256(fixture.bytes)}"`);
        // Raw deliberately re-labels the content type — user HTML must never be
        // parsed on the app origin — but relabelling is all it does.
        expect(response.headers.get("Content-Type")).toBe(
          "text/plain; charset=utf-8",
        );
      });

      it("comes back from the wildcard runtime byte for byte, under its own content type", async () => {
        const response = await serve(
          runtime,
          fixture.bytes,
          TOKEN,
          "text/html; charset=iso-8859-1",
        );
        const body = Buffer.from(await response.arrayBuffer());

        expect(response.status).toBe(200);
        expect(body.equals(fixture.bytes)).toBe(true);
        expect(sha256(body)).toBe(sha256(fixture.bytes));
        // Whatever was stored is what is sent, charset and all: a paste that
        // was served as latin-1 for a decade keeps rendering the same way.
        expect(response.headers.get("Content-Type")).toBe(
          "text/html; charset=iso-8859-1",
        );
      });
    });
  }
});

describe("tokens carried over from the old app", () => {
  // A migration keeps the old token so existing links keep working, and those
  // tokens are not shaped like the ones `generatePasteToken` mints — they are
  // shorter, longer, mixed case, or a slug with a hyphen. Nothing on the way to
  // Convex may second-guess that shape.
  const legacyTokens = ["abc", "legacy1234", "my-legacy-page", "0".repeat(40)];

  for (const token of legacyTokens) {
    it(`serves "${token}" on every surface and passes it to Convex unchanged`, async () => {
      const bytes = Buffer.from("<h1>an old page</h1>");

      for (const route of [raw, runtime]) {
        const response = await serve(route, bytes, token);
        expect(response.status).toBe(200);
        expect(Buffer.from(await response.arrayBuffer()).equals(bytes)).toBe(
          true,
        );
        expect(query.mock.lastCall?.[1]).toMatchObject({ subdomain: token });
      }
    });
  }
});
