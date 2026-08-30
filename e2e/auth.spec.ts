import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// A Clerk `+clerk_test` fixture user — see README "Testing" for the one command
// that creates it. The address never reaches a real inbox and is not a secret.
const USER = process.env.E2E_CLERK_USER_EMAIL ?? "e2e+clerk_test@example.com";

/** Clerk has to be loaded on the page before a session can be established. */
async function signIn(page: Page) {
  await clerk.loaded({ page });
  await clerk.signIn({ page, emailAddress: USER });
}

test("signs in, reaches the dashboard, and loses it again on sign-out", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/");
  await clerk.signOut({ page });

  // Logout invalidation: the session is gone server-side too, so the guard in
  // the dashboard layout bounces the very next request.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("scopes the session cookie to the app host only", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await signIn(page);

  // A leading dot in the Domain attribute is exactly what would hand the cookie
  // to `<token>.pastehtml.assoli.site`. On the app host, none may carry one.
  const appCookies = (await context.cookies()).filter((cookie) =>
    cookie.domain.replace(/^\./, "").endsWith("localhost"),
  );
  expect(appCookies.length).toBeGreaterThan(0);
  for (const cookie of appCookies) expect(cookie.domain).toBe("localhost");
});

test("claims an anonymous paste into the signed-in account", async ({
  page,
}) => {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "claimed.html",
    mimeType: "text/html",
    buffer: Buffer.from("<h1>claim me</h1>"),
  });

  const publicUrl = (await page
    .getByRole("link", { name: /^http/ })
    .first()
    .textContent())!;
  const updateToken = (await page.locator("code").first().textContent())!;
  expect(updateToken).toHaveLength(32);

  // Signing in on the same page keeps the update token in React state, which is
  // the whole point: it is the only copy the browser was ever given.
  await signIn(page);
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(page.getByText(/Saved to your account/)).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // Even with a live session in this browser, the paste's own origin sees an
  // empty cookie jar — the isolation claim, tested against real credentials.
  await page.goto(publicUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("claim me");
  expect(await page.evaluate(() => document.cookie)).toBe("");
});
