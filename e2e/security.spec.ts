import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// The isolation claim pushed at rather than stated: a paste that actively goes
// looking for the signed-in user's credentials, run on its own origin with a
// real Clerk session live in the same browser.
//
// The static half is asserted elsewhere and not repeated here — `auth.spec.ts`
// for the cookie scope, `preview.spec.ts` for the raw endpoint's `text/plain`
// and the preview sandbox, `password.spec.ts` for the unlock cookie.
//
// Needs a running Convex dev deployment (`npx convex dev`) and the `+clerk_test`
// fixture user — see README "Testing".
const USER = process.env.E2E_CLERK_USER_EMAIL ?? "e2e+clerk_test@example.com";
const APP = "http://localhost:3000";

type Probe = {
  cookie: string;
  storage: string;
  domain: string;
  framedTitle: string;
  framedLocation: string;
  api: string;
  replies: string[];
};

/**
 * A paste that tries every route out of its own origin: the app's cookies, its
 * storage, its DOM through a frame, and its API with whatever credentials the
 * browser attaches on its own. Results land on `window.__probe`.
 */
const HOSTILE = `<!doctype html><meta charset="utf-8"><title>hostile</title>
<script>
window.__probe = (async () => {
  const probe = async (fn) => {
    try { return String(await fn()); } catch (error) { return "threw:" + error.name; }
  };

  const replies = [];
  addEventListener("message", (event) => replies.push(String(event.data)));

  // The app is one DNS label away, so the classic escape is to meet it halfway.
  const domain = await probe(() => { document.domain = "localhost"; return document.domain; });

  const frame = document.createElement("iframe");
  frame.src = "${APP}/dashboard";
  // The probe runs while the parser is still in the head, so there is no body
  // to append to yet.
  document.documentElement.append(frame);
  await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  const framedTitle = await probe(() => frame.contentDocument === null ? "opaque" : frame.contentDocument.title);
  const framedLocation = await probe(() => frame.contentWindow.location.href);
  frame.contentWindow.postMessage({ giveMeYourSession: true }, "*");

  // Ambient credentials: the browser attaches whatever it holds for the app.
  const api = await probe(async () => (await fetch("${APP}/api/v1/pastes", { credentials: "include" })).status);

  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    cookie: document.cookie,
    storage: await probe(() => { localStorage.setItem("stolen", "from the paste"); return localStorage.getItem("stolen"); }),
    domain, framedTitle, framedLocation, api, replies,
  };
})();
</script>
`;

/** Publishes from the home page and returns the paste's own origin. */
async function publish(page: Page, html: string): Promise<string> {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "hostile.html",
    mimeType: "text/html",
    buffer: Buffer.from(html),
  });
  return (await page
    .getByRole("link", { name: /^http/ })
    .first()
    .textContent())!;
}

test("hostile HTML reaches nothing of the app's from its own origin", async ({
  page,
}) => {
  const publicUrl = await publish(page, HOSTILE);

  // A real session, so there is something to steal.
  await clerk.loaded({ page });
  await clerk.signIn({ page, emailAddress: USER });

  await page.goto(publicUrl);
  const probe = await page.evaluate(
    () => (window as unknown as { __probe: Promise<Probe> }).__probe,
  );

  expect(probe.cookie).toBe("");
  // The dashboard is either refused as a frame or opaque inside one; either
  // way nothing of it comes back.
  expect(probe.framedTitle).not.toContain("Dashboard");
  expect(probe.framedLocation).not.toContain("/dashboard");
  expect(probe.replies).toEqual([]);
  // Meeting the app halfway is refused or ignored; either way the paste stays
  // on its own origin.
  expect(probe.domain).not.toBe("localhost");
  // No CORS grant on the app origin, so the request never becomes a response.
  expect(probe.api).toBe("threw:TypeError");

  // Its own storage is its own: the app origin never sees what it wrote, and
  // `document.domain` bought it nothing.
  expect(probe.storage).toBe("from the paste");
  await page.goto(APP);
  expect(await page.evaluate(() => localStorage.getItem("stolen"))).toBeNull();
});

test("a paste origin serves the paste and nothing else of the app", async ({
  page,
  request,
}) => {
  const publicUrl = await publish(page, "<h1>just a paste</h1>");
  const token = new URL(publicUrl).hostname.split(".")[0];

  // Every app surface an attacker would want same-origin access to is simply
  // not routed here, so there is no origin from which ambient credentials and
  // a privileged endpoint ever meet.
  for (const path of [
    "/dashboard",
    "/api/v1/pastes",
    `/p/${token}/raw`,
    "/internal/paste/other",
    "/sign-in",
  ]) {
    const response = await request.get(`${publicUrl}${path}`, {
      failOnStatusCode: false,
    });
    expect(response.status(), path).toBe(404);
  }
});
