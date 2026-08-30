import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// Password protection end to end: the owner enables it from the dashboard, the
// wildcard origin challenges a visitor, the wrong password is refused, the
// right one unlocks that paste and only that paste, and removing the password
// opens it back up.
//
// Needs a running Convex dev deployment (`npx convex dev`) and the `+clerk_test`
// fixture user — see README "Testing".
const USER = process.env.E2E_CLERK_USER_EMAIL ?? "e2e+clerk_test@example.com";
const PASSWORD = "correct horse battery";

/** Publishes from the home page and returns the new paste's token. */
async function publish(page: Page, html: string): Promise<string> {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "protected.html",
    mimeType: "text/html",
    buffer: Buffer.from(html),
  });

  const rawUrl = (await page.getByText(/^http.*\/p\/.*\/raw$/).textContent())!;
  return rawUrl.match(/\/p\/([^/]+)\/raw$/)![1];
}

/** Publishes anonymously, then signs in and claims it. Returns the token. */
async function publishOwned(page: Page, html: string): Promise<string> {
  const token = await publish(page, html);

  await clerk.loaded({ page });
  await clerk.signIn({ page, emailAddress: USER });
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(page.getByText(/Saved to your account/)).toBeVisible();

  return token;
}

/** Turns password protection on for a paste the signed-in user owns. */
async function protect(page: Page, token: string) {
  await page.goto(`/dashboard/pastes/${token}`);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Enable password" }).click();
  await expect(
    page.getByRole("button", { name: "Change password" }),
  ).toBeVisible();
}

const publicUrl = (token: string) => `http://${token}.localhost:3000/`;

test("protects, unlocks and unprotects a paste", async ({ page, context }) => {
  const token = await publishOwned(page, "<h1>secret contents</h1>");
  // Signed in from here on, so this one is owned the moment it is published.
  const other = await publish(page, "<h1>other secret</h1>");

  for (const each of [token, other]) await protect(page, each);

  // A visitor is challenged, not served.
  await page.goto(publicUrl(token));
  await expect(
    page.getByRole("heading", { name: /password protected/i }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
    "secret contents",
  );

  // The wrong password says only that it was wrong.
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert")).toHaveText("Incorrect password.");

  // The right one serves the paste.
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "secret contents",
  );

  // The unlock session is out of reach of the paste's own scripts, and does
  // not travel to the app origin.
  expect(await page.evaluate(() => document.cookie)).toBe("");
  const appCookies = (await context.cookies("http://localhost:3000")).map(
    (cookie) => cookie.name,
  );
  expect(appCookies).not.toContain("ph_unlock");

  // Unlocking one paste unlocks nothing else.
  await page.goto(publicUrl(other));
  await expect(
    page.getByRole("heading", { name: /password protected/i }),
  ).toBeVisible();

  // Removing the password opens it back up, and retires the old session.
  await page.goto(`/dashboard/pastes/${token}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove password" }).click();
  await expect(
    page.getByRole("button", { name: "Enable password" }),
  ).toBeVisible();

  await page.goto(publicUrl(token));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "secret contents",
  );
});

test("serves nothing to an unauthenticated request for a protected paste", async ({
  page,
  request,
}) => {
  const token = await publishOwned(page, "<h1>withheld</h1>");
  await protect(page, token);

  const runtime = await request.get(publicUrl(token), {
    failOnStatusCode: false,
  });
  expect(runtime.status()).toBe(401);
  expect(await runtime.text()).not.toContain("withheld");

  // The app-origin surfaces stay closed too — the unlock cookie is host-only
  // to the paste subdomain, so it never reaches them.
  for (const path of [`/p/${token}/raw`, `/p/${token}/render`]) {
    const response = await request.get(path, { failOnStatusCode: false });
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain("withheld");
  }
});
