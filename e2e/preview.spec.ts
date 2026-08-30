import { expect, test } from "@playwright/test";

// The raw and preview endpoints end to end, against a really published paste.
// Requires a running Convex dev deployment (`npx convex dev`).

// Bytes chosen to break anything that re-encodes on the way out: multi-byte
// UTF-8, a lone CR, a tab, and a trailing newline.
const HTML = `<!doctype html><meta charset="utf-8"><title>preview</title>\r
\t<h1 id="source">héllo — ünïcode</h1>
<form id="probe" method="get"><input type="hidden" name="submitted" value="1"><button>go</button></form>
<script>
  document.body.insertAdjacentHTML("beforeend", '<p id="ran">scripts ran</p>');
  alert("modal");
</script>
`;

/** Publishes `HTML` from the home page and returns the paste's URLs. */
async function publish(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "preview page.html",
    mimeType: "text/html",
    buffer: Buffer.from(HTML),
  });

  const publicUrl = (await page
    .getByRole("link", { name: /^http/ })
    .first()
    .textContent())!;
  const token = new URL(publicUrl).hostname.split(".")[0];
  const base = `http://localhost:3000/p/${token}`;
  return {
    token,
    publicUrl,
    pageUrl: base,
    rawUrl: `${base}/raw`,
    renderUrl: `${base}/render`,
  };
}

test("raw returns the stored bytes and never executes them", async ({
  page,
  request,
}) => {
  const { rawUrl } = await publish(page);

  const response = await request.get(rawUrl);
  expect(response.status()).toBe(200);
  // Byte-level: what came back is exactly what went up.
  expect(response.body()).resolves.toEqual(Buffer.from(HTML));
  expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-disposition"]).toBe(
    "inline; filename*=UTF-8''preview%20page.html",
  );

  const revalidated = await request.get(rawUrl, {
    headers: { "If-None-Match": response.headers()["etag"] },
  });
  expect(revalidated.status()).toBe(304);

  // Opened in a browser on the app origin, it stays source text: the markup is
  // never parsed, so nothing in it runs with the app's origin.
  await page.goto(rawUrl);
  expect(await page.evaluate(() => document.contentType)).toBe("text/plain");
  expect(await page.locator("#ran").count()).toBe(0);
});

test("preview runs the paste inside a sandbox with no app access", async ({
  page,
}) => {
  const { renderUrl } = await publish(page);

  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  await page.goto(renderUrl);

  // Rendered as HTML, and its own scripts ran.
  await expect(page.locator("#source")).toHaveText("héllo — ünïcode");
  await expect(page.locator("#ran")).toHaveText("scripts ran");
  // `allow-modals`.
  expect(dialogs).toEqual(["modal"]);

  // The sandbox withholds `allow-same-origin`, so the document sits in an
  // opaque origin: no app cookies, no app storage, nothing of the signed-in
  // user's to reach for.
  const reach = await page.evaluate(() => {
    const probe = (fn: () => unknown) => {
      try {
        fn();
        return "allowed";
      } catch (error) {
        return (error as Error).name;
      }
    };
    return {
      origin: window.origin,
      cookies: probe(() => document.cookie),
      storage: probe(() => localStorage.length),
    };
  });
  expect(reach.origin).toBe("null");
  expect(reach.cookies).toBe("SecurityError");
  expect(reach.storage).toBe("SecurityError");

  // `allow-forms`: a form inside the preview still submits.
  await page.getByRole("button", { name: "go" }).click();
  await expect(page).toHaveURL(/\?submitted=1$/);
  await expect(page.locator("#ran")).toHaveText("scripts ran");
});

test("the metadata page links to every URL a paste has", async ({ page }) => {
  const { pageUrl, publicUrl, rawUrl, renderUrl } = await publish(page);

  await page.goto(pageUrl);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "preview page.html",
  );
  for (const url of [publicUrl, rawUrl, renderUrl])
    await expect(page.getByRole("link", { name: url })).toBeVisible();

  // Nothing here belongs to a signed-out visitor.
  await expect(page.getByText("You own this paste")).toHaveCount(0);
});

test("both endpoints 404 an unknown token", async ({ request }) => {
  for (const path of ["/p/nosuchpaste00/raw", "/p/nosuchpaste00/render"]) {
    const response = await request.get(path, { failOnStatusCode: false });
    expect(response.status()).toBe(404);
  }
});
