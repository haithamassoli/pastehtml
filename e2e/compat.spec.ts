import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  legacyFixtures,
  sha256,
  type LegacyFixture,
} from "../test/fixtures/legacy/fixtures";

// The compatibility suite against a real deployment: every fixture in the
// legacy corpus is published for real, then read back from both surfaces a
// migrated URL lands on — the wildcard origin that serves a paste, and the raw
// endpoint on the app origin — and compared byte for byte.
//
// The old Rails app cannot be run from this repo, so nothing here diffs against
// a live legacy response. What it does prove is the property such a diff was
// for: what went in is what comes out. No re-encoding, no BOM stripping, no
// line-ending translation, no truncation, and the content type is kept.
//
// `test/compat.test.ts` makes the same comparison with storage mocked, so the
// serving layer stays covered in CI where there is no deployment to talk to.
//
// Needs a running Convex dev deployment (`npx convex dev`).

type Published = {
  token: string;
  publicUrl: string;
  rawUrl: string;
  updateToken: string;
};

/** Publishes a fixture through the REST API, bytes untouched. */
async function publish(
  request: APIRequestContext,
  fixture: LegacyFixture,
): Promise<Published> {
  const created = await request.post(
    `/api/v1/pastes?filename=${encodeURIComponent(fixture.name)}`,
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      data: fixture.bytes,
    },
  );
  expect(created.status(), await created.text()).toBe(201);
  return (await created.json()).data;
}

for (const fixture of legacyFixtures) {
  test(`${fixture.name} survives a round trip — ${fixture.why}`, async ({
    request,
  }) => {
    const paste = await publish(request, fixture);

    for (const url of [paste.publicUrl, paste.rawUrl]) {
      const response = await request.get(url);
      const body = await response.body();

      expect(response.status(), url).toBe(200);
      // The assertion the whole milestone is about.
      expect(
        body.equals(fixture.bytes),
        `${url} returned different bytes`,
      ).toBe(true);
      expect(body.byteLength, url).toBe(fixture.bytes.byteLength);
      expect(response.headers()["content-length"], url).toBe(
        String(fixture.bytes.byteLength),
      );
      expect(sha256(body), url).toBe(sha256(fixture.bytes));
      // Convex's own digest of the stored object, handed out as the ETag: an
      // independent witness that storage holds these bytes and not a copy.
      expect(response.headers()["etag"], url).toBe(
        `"${sha256(fixture.bytes)}"`,
      );
    }

    // The paste's own origin serves it as what it was uploaded as; the app
    // origin deliberately relabels it, because HTML must never be parsed there.
    const served = await request.get(paste.publicUrl);
    expect(served.headers()["content-type"]).toBe("text/html; charset=utf-8");
    const raw = await request.get(paste.rawUrl);
    expect(raw.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  });
}

test("a browser renders the legacy pages the way it always did", async ({
  page,
  request,
}) => {
  const byName = (name: string) =>
    legacyFixtures.find((fixture) => fixture.name === name)!;

  // Inline CSS still styles the page, from the <style> block and from the
  // style attribute both.
  const css = await publish(request, byName("inline-css.html"));
  await page.goto(css.publicUrl);
  await expect(page.locator(".box")).toHaveCSS(
    "border-top-color",
    "rgb(204, 0, 0)",
  );
  await expect(page.locator("h1")).toHaveCSS("margin-top", "0px");

  // Inline JavaScript still runs: an onload handler, and a document.write that
  // executes while the parser is still going.
  const js = await publish(request, byName("inline-js.html"));
  await page.goto(js.publicUrl);
  await expect(page.locator("#out")).toHaveText("hello, world <0,2,4,6,8>");
  await expect(page.locator("#written")).toBeVisible();

  // Multi-byte text arrives as text, not as mojibake, and RTL is laid out RTL.
  const unicode = await publish(request, byName("unicode.html"));
  await page.goto(unicode.publicUrl);
  await expect(page.locator("h1")).toHaveText("Multi-byte everything");
  await expect(page.locator('[lang="ja"]')).toHaveText(
    "日本語のテキストと、ひらがな、カタカナ。",
  );
  await expect(page.locator('[lang="ar"]')).toHaveCSS("direction", "rtl");

  // Malformed markup is still fixed up by the browser exactly as it always was:
  // the unclosed table cells become a 2×2 table, and the bare ampersand in the
  // href survives into the link.
  const malformed = await publish(request, byName("malformed.html"));
  await page.goto(malformed.publicUrl);
  await expect(page.locator("table td")).toHaveCount(4);
  await expect(page.locator("ul li")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "search" })).toHaveAttribute(
    "href",
    "/search?q=cats&safe=off",
  );
  await expect(page.locator("h1")).toHaveText("Tom & Jerry & friends");
});

test("a URL carried over from the old app keeps working after an update", async ({
  request,
}) => {
  // What a migration promises: the token is the URL, and replacing the content
  // behind it never changes the address. Nothing may rewrite it on the way.
  const fixture = legacyFixtures[0];
  const paste = await publish(request, fixture);

  const replacement = Buffer.from("﻿<h1>replaced — 🎉</h1>\r\n", "utf8");
  const patched = await request.patch(`/api/v1/pastes/${paste.token}`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Update-Token": paste.updateToken,
    },
    data: replacement,
  });
  expect(patched.status()).toBe(200);

  for (const url of [paste.publicUrl, paste.rawUrl]) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    expect((await response.body()).equals(replacement), url).toBe(true);
  }
});
