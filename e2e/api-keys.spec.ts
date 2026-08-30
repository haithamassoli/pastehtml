import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// API keys, from the settings page to a real publish and back: create a key in
// the UI, publish with it over the REST API, see the paste come back owned, and
// watch the key stop working the moment it is revoked.
//
// Needs a running Convex dev deployment (`npx convex dev`) and the `+clerk_test`
// fixture user — see README "Testing".
const USER = process.env.E2E_CLERK_USER_EMAIL ?? "e2e+clerk_test@example.com";
const HTML = "<h1>published with an API key</h1>";

/**
 * Creates a key on the settings page and returns the secret, which the UI shows
 * exactly once. `scopes` names the boxes to leave ticked; the form starts with
 * read and write on.
 */
async function createKey(page: Page, name: string, scopes?: string[]) {
  // Clerk has to be loaded on a page of the app before a session can be made.
  await page.goto("/");
  await clerk.loaded({ page });
  await clerk.signIn({ page, emailAddress: USER });
  await page.goto("/dashboard/settings/api-keys");

  await page.getByLabel("Key name").fill(name);
  if (scopes)
    for (const scope of ["pastes:read", "pastes:write"])
      if (!scopes.includes(scope))
        await page.getByRole("checkbox", { name: scope }).uncheck();
  await page.getByRole("button", { name: "Create key" }).click();

  await expect(page.getByText(/Copy this key now/)).toBeVisible();
  // The list below shows a truncated prefix with an ellipsis; the full secret
  // is the one that is all key and nothing else.
  const secret = (await page
    .locator("code")
    .filter({ hasText: /^ph_[A-Za-z0-9_-]+$/ })
    .first()
    .textContent())!;
  expect(secret.length).toBeGreaterThan(20);
  return secret;
}

const bearer = (key: string) => ({
  Authorization: `Bearer ${key}`,
  "Content-Type": "text/html",
});

test("publishes with a key made in the settings UI, then stops when it is revoked", async ({
  page,
  request,
}) => {
  const name = `e2e ${Date.now()}`;
  const key = await createKey(page, name);

  const created = await request.post("/api/v1/pastes?title=Keyed", {
    headers: bearer(key),
    data: HTML,
  });
  expect(created.status()).toBe(201);
  const { data } = await created.json();
  // Owned by the account the key belongs to, so no anonymous update token is
  // issued — the key is the credential from here on.
  expect(data.updateToken).toBeUndefined();
  expect(await (await request.get(data.publicUrl)).text()).toBe(HTML);

  // The key reads back the owner view, which a stranger never sees.
  const owned = await request.get(`/api/v1/pastes/${data.token}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  expect((await owned.json()).data.hasPassword).toBe(false);

  // And the dashboard lists it, so "owned by the account" means the same thing
  // in the browser as it does over the API.
  await page.goto("/dashboard");
  await expect(
    page.getByRole("listitem").filter({ hasText: data.token }),
  ).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/dashboard/settings/api-keys");
  await page
    .getByRole("listitem")
    .filter({ hasText: name })
    .getByRole("button", { name: "Revoke" })
    .click();
  await expect(
    page.getByRole("listitem").filter({ hasText: name }),
  ).toContainText("revoked");

  // Revocation is checked in Convex on every request, so it takes effect on
  // the next one rather than whenever a cache happens to expire.
  const afterRevoke = await request.post("/api/v1/pastes", {
    headers: bearer(key),
    data: HTML,
  });
  expect(afterRevoke.status()).toBe(401);
  expect((await afterRevoke.json()).error.code).toBe("UNAUTHORIZED");
});

test("refuses to publish with a key that only carries the read scope", async ({
  page,
  request,
}) => {
  const key = await createKey(page, `e2e read-only ${Date.now()}`, [
    "pastes:read",
  ]);

  const refused = await request.post("/api/v1/pastes", {
    headers: bearer(key),
    data: HTML,
  });
  expect(refused.status()).toBe(403);
  expect((await refused.json()).error.message).toContain("pastes:write");
});
