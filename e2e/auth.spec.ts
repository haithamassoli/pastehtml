import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
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

test("signs up a brand new account and publishes into it", async ({
  page,
  request,
}) => {
  // A Clerk test-mode address: it never reaches an inbox and its verification
  // code is always 424242. Unique per run, because an address can only ever
  // sign up once.
  const email = `e2e-signup-${Date.now()}+clerk_test@example.com`;

  // The other specs go through `clerk.signIn`, which talks to Clerk's JS API
  // directly. This one drives the actual form, so bot protection is in the way
  // — the testing token `global.setup.ts` fetched is what waives it.
  await setupClerkTestingToken({ page });
  await page.goto("/sign-up");
  await clerk.loaded({ page });

  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(`e2e-fixture-${Date.now()}`);
  // "Continue with Google" is also a Continue button.
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page
    .getByRole("textbox", { name: "Enter verification code" })
    .fill("424242");

  // Signed in as an account that did not exist a minute ago, and publishing
  // into it: the paste is owned, so no update token is offered.
  await page.goto("/");
  await expect(page.getByText("Publishing to your account.")).toBeVisible();
  await page.setInputFiles('input[type="file"]', {
    name: "first.html",
    mimeType: "text/html",
    buffer: Buffer.from("<h1>my first paste</h1>"),
  });
  await expect(page.getByRole("heading", { name: "Published" })).toBeVisible();
  await expect(page.getByText("Update token")).toHaveCount(0);

  await page.goto("/dashboard");
  await expect(
    page.getByRole("listitem").filter({ hasText: "first.html" }),
  ).toBeVisible();

  // A development instance caps how many users it will hold, so every run
  // would otherwise leave one behind for good.
  const userId = await page.evaluate(
    () =>
      (window as unknown as { Clerk?: { user?: { id?: string } } }).Clerk?.user
        ?.id,
  );
  expect(userId).toBeTruthy();
  const removed = await request.delete(
    `https://api.clerk.com/v1/users/${userId}`,
    { headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` } },
  );
  expect(removed.ok()).toBe(true);
});
