import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// Folder management, end to end: create, rename, file a paste, see it from the
// folder, take it back out, then delete the folder and prove the paste lived.
//
// Needs a running Convex dev deployment (`npx convex dev`) and the `+clerk_test`
// fixture user — see README "Testing".
const USER = process.env.E2E_CLERK_USER_EMAIL ?? "e2e+clerk_test@example.com";

/** Publishes anonymously, then signs in and claims it. Returns the token. */
async function publishOwned(page: Page, html: string): Promise<string> {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "folders.html",
    mimeType: "text/html",
    buffer: Buffer.from(html),
  });

  const rawUrl = (await page.getByText(/^http.*\/p\/.*\/raw$/).textContent())!;

  await clerk.loaded({ page });
  await clerk.signIn({ page, emailAddress: USER });
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(page.getByText(/Saved to your account/)).toBeVisible();

  return rawUrl.match(/\/p\/([^/]+)\/raw$/)![1];
}

test("creates, fills, empties and deletes a folder", async ({ page }) => {
  const token = await publishOwned(page, "<h1>folder fixture</h1>");
  // The name is unique per run so parallel workers never collide in the list.
  const name = `Folder ${token}`;
  const renamed = `${name} renamed`;

  page.on("dialog", (dialog) =>
    dialog.type() === "prompt" ? dialog.accept(renamed) : dialog.accept(),
  );

  await page.goto("/dashboard/folders");
  await page.getByLabel("New folder name").fill(name);
  await page.getByRole("button", { name: "Create folder" }).click();

  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toBeVisible();

  // Rename, live, without a reload.
  await row.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("link", { name: renamed })).toBeVisible();

  // An empty folder says so.
  await page.getByRole("link", { name: renamed }).click();
  await expect(page).toHaveURL(/\/dashboard\/folders\/[^/]+$/);
  const folderUrl = page.url();
  await expect(page.getByText("This folder is empty.")).toBeVisible();

  // File the paste from its own page — the move-paste action.
  await page.goto(`/dashboard/pastes/${token}`);
  await page.getByLabel("Folder").selectOption({ label: renamed });

  await page.goto(folderUrl);
  const paste = page.getByRole("listitem").filter({ hasText: token });
  await expect(paste).toBeVisible();

  // The dashboard filter narrows to the same folder.
  await page.goto("/dashboard");
  const listed = page.getByRole("listitem").filter({ hasText: token });
  await page.getByLabel("Filter by folder").selectOption({ label: renamed });
  await expect(listed).toBeVisible();
  // Filed, so "No folder" must not show it. (The account keeps other unfiled
  // pastes across runs, so this checks the row, not an empty state.)
  await page
    .getByLabel("Filter by folder")
    .selectOption({ label: "No folder" });
  await expect(listed).toHaveCount(0);

  // Remove-from-folder, from the folder itself.
  await page.goto(folderUrl);
  await paste.getByRole("button", { name: "Remove from folder" }).click();
  await expect(page.getByText("This folder is empty.")).toBeVisible();

  // Put it back, so the folder is deleted with a paste still inside it — the
  // case that has to keep the paste.
  await page.goto(`/dashboard/pastes/${token}`);
  await page.getByLabel("Folder").selectOption({ label: renamed });

  await page.goto("/dashboard/folders");
  await page
    .getByRole("listitem")
    .filter({ hasText: renamed })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText(renamed)).toHaveCount(0);

  // The paste survives, unfiled, and its public URL still serves.
  await page.goto(`/dashboard/pastes/${token}`);
  await expect(page.getByLabel("Paste title")).toBeVisible();
  expect((await page.request.get(`/p/${token}/raw`)).status()).toBe(200);
});
