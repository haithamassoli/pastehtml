import { expect, test } from "@playwright/test";

// The wildcard runtime end to end. Chromium resolves any `*.localhost` name to
// the loopback address, so the real host routing runs without touching DNS.
// Requires a running Convex dev deployment (`npx convex dev`).
const HTML = "<h1>served from a wildcard subdomain</h1>";

/** Appended to anything served as HTML — see `lib/paste-http.ts`. */
const FONT_LINK =
  '<link rel="stylesheet" href="http://localhost:3000/fonts/thmanyah.css">';

test("serves a published paste from its own subdomain", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "wildcard.html",
    mimeType: "text/html",
    buffer: Buffer.from(HTML),
  });

  const publicUrl = (await page
    .getByRole("link", { name: /^http/ })
    .first()
    .textContent())!;
  expect(publicUrl).toMatch(/^http:\/\/[a-z0-9]+\.localhost:3000$/);

  await page.goto(publicUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "served from a wildcard subdomain",
  );

  // What the uploaded HTML can actually reach: nothing. Clerk never runs on a
  // paste host, and its cookies are host-only on the app host, so scripts in
  // the paste see an empty jar.
  expect(await page.evaluate(() => document.cookie)).toBe("");

  const response = await request.get(publicUrl);
  expect(response.headers()["content-type"]).toContain("text/html");
  expect(response.headers()["set-cookie"]).toBeUndefined();
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await response.text()).toBe(`${HTML}${FONT_LINK}`);

  // Conditional requests are answered without re-reading storage.
  const revalidated = await request.get(publicUrl, {
    headers: { "If-None-Match": response.headers()["etag"] },
  });
  expect(revalidated.status()).toBe(304);
});

test("returns 404 for an unknown subdomain", async ({ request }) => {
  const response = await request.get("http://nosuchpaste00.localhost:3000/", {
    failOnStatusCode: false,
  });
  expect(response.status()).toBe(404);
});

test("does not expose the internal runtime route on the app host", async ({
  request,
}) => {
  const response = await request.get(
    "http://localhost:3000/internal/paste/anything",
    { failOnStatusCode: false },
  );
  expect(response.status()).toBe(404);
});
