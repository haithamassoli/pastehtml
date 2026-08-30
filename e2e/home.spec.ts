import { expect, test } from "@playwright/test";

// Smoke: the app boots and the home page renders.
test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/pastehtml/i);
});
