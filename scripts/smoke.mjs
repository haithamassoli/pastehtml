// Production smoke test: publish, serve, protect, unlock and delete, against a
// real deployment. Everything it creates it deletes again, so it is safe to run
// against production as often as you like.
//
//   node scripts/smoke.mjs [baseUrl]        # or BASE=… npm run smoke
//   API_KEY=ph_… node scripts/smoke.mjs     # also exercises key-owned publish
//
// With API_KEY set, the key publishes and must therefore also be able to clean
// up after itself: `pastes:read`, `pastes:write` and `pastes:delete`.
//
// ponytail: no test runner. This is a linear script whose only report is "which
// step broke" — `node:assert` and a for-loop say that in twenty lines, and a
// smoke test that needs vitest installed on the box running it is not one. The
// browser-session flows (sign-up, dashboard, folders, API-key creation,
// analytics) stay in `e2e/` where a browser already exists.

import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE = (
  process.argv[2] ??
  process.env.BASE ??
  "https://pastehtml.assoli.site"
).replace(/\/$/, "");
const API_KEY = process.env.API_KEY;
const { host: appHost, protocol } = new URL(BASE);

const stamp = new Date().toISOString();
// Non-ASCII on purpose: "identical" has to mean bytes, not a lenient string
// comparison that would pass on a mangled encoding.
const HTML = `<!doctype html><h1>smoke test</h1><p>café ☕ — ${stamp}</p>\n`;
const BYTES = Buffer.from(HTML, "utf8");
const PASSWORD = `smoke-${Math.random().toString(36).slice(2)}`;

/** Pastes to remove before exiting, newest first. */
const created = [];

/** The anonymous paste every serving step works from. */
let paste;

const api = (path, init) => fetch(`${BASE}/api/v1${path}`, init);
const publicUrl = (token) => `${protocol}//${token}.${appHost}/`;

/** The JSON envelope, with the status, so a step can assert on either. */
async function json(response) {
  const body = await response.json();
  return { status: response.status, ...body };
}

/** Asserts the response carries exactly the bytes we published. */
async function assertSameBytes(response, what) {
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, `${what} status`);
  assert.ok(
    body.equals(BYTES),
    `${what} served ${body.length} bytes, published ${BYTES.length}`,
  );
}

const steps = [];
const step = (name, run) => steps.push({ name, run });

step("health check answers", async () => {
  const { status, ok } = await json(await fetch(`${BASE}/api/health`));
  assert.equal(status, 200, "health status");
  assert.equal(ok, true, "health ok");
});

// The home page publishes straight to Convex from the browser, so the REST
// endpoint is the only anonymous publish path a script can drive — and it is
// the one documented in docs/api.md.
step("publishes an anonymous paste over REST", async () => {
  const { status, data, error } = await json(
    await api(`/pastes?title=smoke%20test&filename=smoke.html`, {
      method: "POST",
      headers: { "Content-Type": "text/html" },
      body: BYTES,
    }),
  );
  assert.equal(status, 201, `publish failed: ${JSON.stringify(error)}`);
  assert.equal(typeof data.token, "string", "token");
  assert.equal(typeof data.updateToken, "string", "updateToken");
  assert.equal(data.publicUrl, publicUrl(data.token).replace(/\/$/, ""));
  created.unshift({ token: data.token, updateToken: data.updateToken });
  paste = data;
});

step("serves the published bytes on the wildcard host", async () => {
  const response = await fetch(paste.publicUrl);
  assert.equal(
    response.headers.get("content-type"),
    "text/html",
    "public content-type",
  );
  await assertSameBytes(response, "public URL");
});

step("serves the raw source as inert text", async () => {
  const response = await fetch(paste.rawUrl);
  assert.equal(
    response.headers.get("content-type"),
    "text/plain; charset=utf-8",
    "raw content-type",
  );
  assert.equal(
    response.headers.get("x-content-type-options"),
    "nosniff",
    "raw nosniff",
  );
  await assertSameBytes(response, "raw URL");
});

step("serves the preview under a sandbox CSP", async () => {
  const response = await fetch(paste.renderUrl);
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /^sandbox (?!.*allow-same-origin)/,
    "render sandbox CSP",
  );
  await assertSameBytes(response, "render URL");
});

step("password-protects, challenges, and unlocks", async () => {
  const { status, error } = await json(
    await api(`/pastes/${paste.token}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Update-Token": created[0].updateToken,
      },
      body: JSON.stringify({ password: PASSWORD }),
    }),
  );
  assert.equal(status, 200, `set password failed: ${JSON.stringify(error)}`);

  const url = publicUrl(paste.token);
  const challenge = await fetch(url);
  const challengeBody = await challenge.text();
  assert.equal(challenge.status, 401, "challenge status");
  assert.match(challengeBody, /password protected/i, "challenge page");
  assert.ok(!challengeBody.includes(stamp), "challenge withholds the content");

  const form = (password) => ({
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password }),
    redirect: "manual",
  });

  const wrong = await fetch(url, form("not the password"));
  assert.equal(wrong.status, 401, "wrong password status");
  assert.match(await wrong.text(), /Incorrect password/, "wrong password page");

  const unlocked = await fetch(url, form(PASSWORD));
  assert.equal(unlocked.status, 303, "unlock status");
  const cookie = unlocked.headers.get("set-cookie")?.split(";")[0];
  assert.match(cookie ?? "", /^ph_unlock=/, "unlock cookie");

  // `fetch` keeps no jar, so the cookie is replayed by hand — which is also the
  // point: possession of that one cookie is the whole unlock session.
  await assertSameBytes(await fetch(url, { headers: { cookie } }), "unlocked");

  const removed = await json(
    await api(`/pastes/${paste.token}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Update-Token": created[0].updateToken,
      },
      body: JSON.stringify({ password: null }),
    }),
  );
  assert.equal(removed.status, 200, "remove password");
  await assertSameBytes(await fetch(url), "after unprotecting");
});

step(
  API_KEY
    ? "publishes through the API with an API key"
    : "refuses an unknown API key",
  async () => {
    const response = await api("/pastes?title=smoke%20key", {
      method: "POST",
      headers: {
        "Content-Type": "text/html",
        Authorization: `Bearer ${API_KEY ?? "ph_0000000000000000000000000000"}`,
      },
      body: BYTES,
    });
    const { status, data, error } = await json(response);

    if (!API_KEY) {
      assert.equal(status, 401, "unknown key status");
      assert.equal(error?.code, "UNAUTHORIZED", "unknown key code");
      return;
    }

    assert.equal(status, 201, `keyed publish failed: ${JSON.stringify(error)}`);
    created.unshift({ token: data.token, apiKey: API_KEY });
    // A keyed paste belongs to the account, so there is no update token to
    // hand out — the key is the credential from here on.
    assert.equal(data.updateToken, undefined, "keyed paste has no updateToken");
    await assertSameBytes(await fetch(data.publicUrl), "keyed publish");
  },
);

step("publishes and deletes over MCP", async () => {
  const client = new Client({ name: "pastehtml-smoke", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
      requestInit: API_KEY
        ? { headers: { Authorization: `Bearer ${API_KEY}` } }
        : undefined,
    }),
  );

  try {
    const call = async (name, args) => {
      const result = await client.callTool({ name, arguments: args });
      return {
        isError: result.isError,
        payload: JSON.parse(result.content[0].text),
      };
    };

    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    assert.ok(tools.includes("create_paste"), `tools: ${tools.join(", ")}`);

    const { isError, payload } = await call("create_paste", {
      html: HTML,
      filename: "smoke-mcp.html",
      title: "smoke test over MCP",
    });
    assert.ok(!isError, `create_paste: ${JSON.stringify(payload)}`);
    const credential = API_KEY
      ? { apiKey: API_KEY }
      : { updateToken: payload.updateToken };
    created.unshift({ token: payload.token, ...credential });

    await assertSameBytes(await fetch(payload.publicUrl), "MCP publish");

    const deleted = await call("delete_paste", {
      token: payload.token,
      updateToken: credential.updateToken,
    });
    assert.ok(
      !deleted.isError,
      `delete_paste: ${JSON.stringify(deleted.payload)}`,
    );
    assert.equal(deleted.payload.deleted, true, "MCP delete");
    created.shift();
    assert.equal(
      (await fetch(payload.publicUrl)).status,
      404,
      "deleted MCP paste still resolves",
    );
  } finally {
    await client.close();
  }
});

/**
 * Removes everything the run created; the last step, and also the safety net.
 * Nothing in here may throw — a step that already failed must still get its
 * pastes deleted, and the exit code must come from the step, not from cleanup.
 */
async function cleanup() {
  let failures = 0;
  for (const { token, updateToken, apiKey } of created) {
    const gone = await api(`/pastes/${token}`, {
      method: "DELETE",
      headers: apiKey
        ? { Authorization: `Bearer ${apiKey}` }
        : { "X-Update-Token": updateToken },
    })
      .then(async (response) => {
        // Deleted is not enough: the public URL has to stop resolving, which is
        // the promise `DELETE` makes.
        if (response.status !== 200) return false;
        return (await fetch(publicUrl(token))).status === 404;
      })
      .catch(() => false);

    console.log(`  ${gone ? "✓" : "✗"} cleanup ${token}`);
    if (!gone) failures++;
  }
  return failures;
}

console.log(`smoke: ${BASE}${API_KEY ? " (with API key)" : ""}`);

let failed = null;
for (const { name, run } of steps) {
  const at = Date.now();
  try {
    await run();
    console.log(`  ✓ ${name} (${Date.now() - at}ms)`);
  } catch (error) {
    // `fetch` failures say only "fetch failed"; the cause holds the DNS or TLS
    // error, which is usually the whole answer.
    const cause = error.cause ? ` (${error.cause.message})` : "";
    console.error(`  ✗ ${name}: ${error.message}${cause}`);
    failed = name;
    break;
  }
}

const leaked = await cleanup();
if (failed) console.error(`\nFAILED at: ${failed}`);
else if (leaked) console.error(`\nFAILED: ${leaked} paste(s) left behind`);
else console.log(`\nall ${steps.length} steps passed`);
process.exit(failed || leaked ? 1 : 0);
