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
