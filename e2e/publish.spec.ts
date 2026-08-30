import { expect, test } from "@playwright/test";

// Anonymous publishing end to end: browser → Convex File Storage → paste.
// Requires a running Convex dev deployment (`npx convex dev`).
test("publishes an HTML file without an account", async ({ page }) => {
  await page.goto("/");

  await page.setInputFiles('input[type="file"]', {
    name: "demo.html",
    mimeType: "text/html",
    buffer: Buffer.from("<h1>hello from playwright</h1>"),
  });

  await expect(page.getByRole("heading", { name: "Published" })).toBeVisible();
  await expect(page.getByText(/^http.*\/p\/.*\/raw$/)).toBeVisible();
  await expect(page.getByText("Update token")).toBeVisible();

  await page.getByRole("button", { name: "Publish another" }).click();
  await expect(
    page.getByRole("heading", { name: "Publish HTML, get a URL" }),
  ).toBeVisible();
});

test("shows a structured error for an oversized upload", async ({ page }) => {
  await page.goto("/");

  await page.setInputFiles('input[type="file"]', {
    name: "big.html",
    mimeType: "text/html",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, "x"),
  });

  // Next's route announcer is also role="alert", so match the message itself.
  await expect(page.getByText(/must be at most \d+ bytes/)).toBeVisible();
});

test("publishes an HTML file dropped onto the page", async ({ page }) => {
  await page.goto("/");

  // The drop handler reads `event.dataTransfer.files`, which `setInputFiles`
  // never touches, so this path is only covered by a real drop event.
  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["<h1>dropped in</h1>"], "dropped.html", { type: "text/html" }),
    );
    return transfer;
  });
  await page
    .locator('label:has-text("Drop an HTML file here")')
    .dispatchEvent("drop", { dataTransfer });

  await expect(page.getByRole("heading", { name: "Published" })).toBeVisible();

  // Dropped, not picked: what went live is the file the drop event carried.
  const publicUrl = (await page
    .getByRole("link", { name: /^http/ })
    .first()
    .textContent())!;
  await page.goto(publicUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "dropped in",
  );
});
