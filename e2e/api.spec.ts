import { expect, test } from "@playwright/test";

// The public REST API over real HTTP. Anonymous flows only — the API-key and
// owner paths are covered inside Convex (`convex/apiKeys.test.ts`), where the
// authorization actually happens, without needing a signed-in browser here.
// Requires a running Convex dev deployment (`npx convex dev`).
const HTML = "<h1>published by curl</h1>";

/** Appended to anything served as HTML — see `lib/paste-http.ts`. */
const FONT_LINK =
  '<link rel="stylesheet" href="http://localhost:3000/fonts/thmanyah.css">';

const html = (body: string) => ({
  headers: { "Content-Type": "text/html" },
  data: body,
});

test("publishes, reads, updates and deletes a paste anonymously", async ({
  request,
}) => {
  const created = await request.post("/api/v1/pastes?title=From%20the%20API", {
    ...html(HTML),
  });
  expect(created.status()).toBe(201);
  expect(created.headers()["x-request-id"]).toBeTruthy();
  expect(created.headers()["ratelimit-limit"]).toBeTruthy();

  const { data } = await created.json();
  expect(data.token).toHaveLength(12);
  expect(data.publicUrl).toMatch(
    new RegExp(`^http://${data.token}\\.localhost:3000$`),
  );
  expect(data.rawUrl).toContain(`/p/${data.token}/raw`);
  // The update token is the anonymous management credential, returned once.
  expect(data.updateToken).toHaveLength(32);

  // The public URL really serves the bytes we sent.
  expect(await (await request.get(data.publicUrl)).text()).toBe(
    `${HTML}${FONT_LINK}`,
  );

  const fetched = await request.get(`/api/v1/pastes/${data.token}`);
  expect(fetched.status()).toBe(200);
  const metadata = (await fetched.json()).data;
  expect(metadata.title).toBe("From the API");
  expect(metadata.contentLength).toBe(HTML.length);
  // Public metadata, so no owner-only fields and no secrets.
  expect(metadata).not.toHaveProperty("hasPassword");
  expect(JSON.stringify(metadata)).not.toContain(data.updateToken);

  const renamed = await request.patch(`/api/v1/pastes/${data.token}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Update-Token": data.updateToken,
    },
    data: { title: "Renamed" },
  });
  expect(renamed.status()).toBe(200);
  expect((await renamed.json()).data.title).toBe("Renamed");

  const replaced = await request.patch(`/api/v1/pastes/${data.token}`, {
    headers: {
      "Content-Type": "text/html",
      "X-Update-Token": data.updateToken,
    },
    data: "<h1>v2</h1>",
  });
  expect(replaced.status()).toBe(200);
  expect(await (await request.get(data.publicUrl)).text()).toBe("<h1>v2</h1>");

  const deleted = await request.delete(`/api/v1/pastes/${data.token}`, {
    headers: { "X-Update-Token": data.updateToken },
  });
  expect(deleted.status()).toBe(200);

  // Gone from the API and, immediately, from the public URL.
  expect((await request.get(`/api/v1/pastes/${data.token}`)).status()).toBe(
    404,
  );
  expect((await request.get(data.publicUrl)).status()).toBe(404);
});

test("refuses a write without the update token", async ({ request }) => {
  const { data } = await (
    await request.post("/api/v1/pastes", html(HTML))
  ).json();

  for (const response of [
    await request.patch(`/api/v1/pastes/${data.token}`, {
      headers: { "Content-Type": "application/json" },
      data: { title: "not mine" },
    }),
    await request.delete(`/api/v1/pastes/${data.token}`),
    await request.patch(`/api/v1/pastes/${data.token}`, {
      headers: {
        "Content-Type": "application/json",
        "X-Update-Token": "wrong",
      },
      data: { title: "not mine" },
    }),
  ]) {
    expect([401, 403]).toContain(response.status());
    expect((await response.json()).error.code).toMatch(
      /UNAUTHORIZED|FORBIDDEN/,
    );
  }

  // Unchanged.
  const after = await (
    await request.get(`/api/v1/pastes/${data.token}`)
  ).json();
  expect(after.data.title).toBeUndefined();
});

test("returns structured errors for bad requests", async ({ request }) => {
  const cases = [
    {
      response: await request.post("/api/v1/pastes", html("")),
      status: 400,
      code: "VALIDATION",
    },
    {
      response: await request.post("/api/v1/pastes", {
        headers: { "Content-Type": "text/html" },
        data: "x".repeat(5 * 1024 * 1024 + 1),
      }),
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    },
    {
      response: await request.post("/api/v1/pastes", {
        headers: { "Content-Type": "application/pdf" },
        data: "%PDF-1.4",
      }),
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    },
    {
      response: await request.get("/api/v1/pastes/doesnotexist"),
      status: 404,
      code: "NOT_FOUND",
    },
    {
      response: await request.post("/api/v1/pastes?subdomain=www", html(HTML)),
      status: 409,
      code: "CONFLICT",
    },
  ];

  for (const { response, status, code } of cases) {
    expect(response.status()).toBe(status);
    const body = await response.json();
    expect(body.error.code).toBe(code);
    expect(typeof body.error.message).toBe("string");
    expect(response.headers()["x-request-id"]).toBeTruthy();
  }
});

test("refuses a cookie-only write from another origin", async ({ request }) => {
  // The CSRF case Milestone 6 deferred to the REST API: a `text/plain` POST is
  // CORS-simple, so a hostile page can send one with the visitor's session
  // cookie attached and no preflight to stop it.
  const forged = await request.post("/api/v1/pastes", {
    headers: { "Content-Type": "text/plain", Origin: "https://evil.example" },
    data: HTML,
  });
  expect(forged.status()).toBe(403);
  expect((await forged.json()).error.code).toBe("FORBIDDEN");

  // Our own origin is fine, and so is a script that sends no Origin at all.
  const ours = await request.post("/api/v1/pastes", {
    headers: { "Content-Type": "text/html", Origin: "http://localhost:3000" },
    data: HTML,
  });
  expect(ours.status()).toBe(201);

  // A header credential cannot be forged cross-site, so it is not refused —
  // here the request is rejected for the bad token, not for its origin.
  const keyed = await request.delete("/api/v1/pastes/doesnotexist", {
    headers: { "X-Update-Token": "whatever", Origin: "https://evil.example" },
  });
  expect((await keyed.json()).error.code).toBe("NOT_FOUND");
});

test("propagates an incoming request id", async ({ request }) => {
  const response = await request.post("/api/v1/pastes", {
    headers: { "Content-Type": "text/html", "X-Request-Id": "trace-me" },
    data: HTML,
  });
  expect(response.headers()["x-request-id"]).toBe("trace-me");
});
