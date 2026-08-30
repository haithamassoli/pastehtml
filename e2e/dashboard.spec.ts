import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// The authenticated dashboard, end to end: claim a paste into the account, find
// it in the list, edit it on its detail page, and delete it.
//
// Needs a running Convex dev deployment (`npx convex dev`) and the `+clerk_test`
// fixture user — see README "Testing".
const USER = process.env.E2E_CLERK_USER_EMAIL ?? "e2e+clerk_test@example.com";

async function signIn(page: Page) {
  await clerk.loaded({ page });
  await clerk.signIn({ page, emailAddress: USER });
}

/**
 * Publishes anonymously, then signs in and claims the result — the same bridge
 * a real visitor takes, and the only way an account gets a paste until the REST
 * API lands. Publishing before signing in also keeps the fixture deterministic:
 * an anonymous create always issues the update token the claim needs.
 * Returns the paste's public token.
 */
async function publishOwned(page: Page, html: string): Promise<string> {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "dashboard.html",
    mimeType: "text/html",
    buffer: Buffer.from(html),
  });

  const rawUrl = (await page.getByText(/^http.*\/p\/.*\/raw$/).textContent())!;

  await signIn(page);
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(page.getByText(/Saved to your account/)).toBeVisible();

  return rawUrl.match(/\/p\/([^/]+)\/raw$/)![1];
}

/** Playwright dismisses dialogs by default; destructive actions need an accept. */
function acceptConfirms(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
}

test("lists, searches, edits and deletes an owned paste", async ({ page }) => {
  const token = await publishOwned(page, "<h1>dashboard fixture</h1>");
  acceptConfirms(page);

  await page.goto("/dashboard");
  const row = page.getByRole("listitem").filter({ hasText: token });
  await expect(row).toBeVisible();
  await expect(row).toContainText("dashboard.html");

  // Search narrows to this paste, and excludes it when it cannot match.
  await page.getByLabel("Search pastes").fill(token);
  await expect(row).toBeVisible();
  await page.getByLabel("Search pastes").fill("no-such-paste-anywhere");
  await expect(page.getByText("No pastes match those filters.")).toBeVisible();
  await page.getByLabel("Search pastes").fill("");

  // Detail page: metadata, every URL, and a live preview of the stored HTML.
  await row.getByRole("link", { name: "dashboard.html" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/pastes/${token}$`));
  await expect(
    page.getByRole("heading", { name: "dashboard.html" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: `http://${token}.localhost:3000` }),
  ).toBeVisible();

  const preview = page.frameLocator('iframe[title="Paste preview"]');
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
    "dashboard fixture",
  );

  // Title editing renames it everywhere, including back on the list.
  await page.getByLabel("Paste title").fill("Renamed in the dashboard");
  await page.getByRole("button", { name: "Save title" }).click();
  await expect(
    page.getByRole("heading", { name: "Renamed in the dashboard" }),
  ).toBeVisible();

  await page.goto("/dashboard");
  await expect(
    page.getByRole("link", { name: "Renamed in the dashboard" }),
  ).toBeVisible();

  // Deleting is confirmed, and takes the public URL with it.
  await page
    .getByRole("listitem")
    .filter({ hasText: token })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText(token)).toHaveCount(0);

  const response = await page.request.get(`/p/${token}/raw`);
  expect(response.status()).toBe(404);
});

test("updates without a refresh as the data changes", async ({
  page,
  context,
}) => {
  const token = await publishOwned(page, "<h1>realtime</h1>");
  acceptConfirms(page);

  // One tab sits on the dashboard and is never reloaded again; the other one
  // does the work. Everything the first tab shows arrives over the Convex
  // subscription.
  await page.goto("/dashboard");
  const row = page.getByRole("listitem").filter({ hasText: token });
  await expect(row).toBeVisible();

  const other = await context.newPage();
  acceptConfirms(other);

  // An edit.
  await other.goto(`/dashboard/pastes/${token}`);
  await other.getByLabel("Paste title").fill("Live edit");
  await other.getByRole("button", { name: "Save title" }).click();
  await expect(row.getByRole("link", { name: "Live edit" })).toBeVisible();

  // A view. Only the wildcard runtime counts one, and it records it after the
  // response is already on the wire, so this also proves analytics reaches the
  // open dashboard on its own.
  await expect(row).toContainText("0 views");
  await other.goto(`http://${token}.localhost:3000/`);
  await expect(row).toContainText("1 views", { timeout: 15_000 });

  // And a delete.
  await other.goto(`/dashboard/pastes/${token}`);
  await other.getByRole("button", { name: "Delete paste" }).click();
  await expect(other).toHaveURL(/\/dashboard$/);
  await expect(row).toHaveCount(0);
});

test("stays usable on a phone-sized viewport", async ({ page }) => {
  const token = await publishOwned(page, "<h1>mobile</h1>");
  acceptConfirms(page);
  await page.setViewportSize({ width: 390, height: 844 });

  /** Long tokens and URLs must truncate, never push the page sideways. */
  const fits = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );

  await page.goto("/dashboard");
  const row = page.getByRole("listitem").filter({ hasText: token });
  await expect(page.getByLabel("Search pastes")).toBeVisible();
  await expect(row.getByRole("button", { name: "Delete" })).toBeVisible();
  expect(await fits()).toBe(true);

  await page.goto(`/dashboard/pastes/${token}`);
  await expect(page.getByLabel("Paste title")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete paste" }),
  ).toBeVisible();
  expect(await fits()).toBe(true);

  await page.getByRole("button", { name: "Delete paste" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
