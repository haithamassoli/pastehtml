// Load-test scenarios for the serving and publishing paths. Node only, no
// dependencies: `fetch` and a promise pool are the whole harness, because the
// four things worth measuring are all "send N requests, look at the spread".
//
// ponytail: no k6, no artillery. Those earn their keep when you need ramp
// profiles, distributed generators and a results backend; here the numbers that
// matter are p50/p95 and the status mix, and a laptop can only ever produce
// those against one server anyway. See docs/load-testing.md for what this
// cannot answer.
//
//   node scripts/load-test.mjs read <token> [n] [concurrency]
//   node scripts/load-test.mjs conditional <token> [n] [concurrency]
//   node scripts/load-test.mjs create [n] [concurrency]
//   node scripts/load-test.mjs publish [n] [concurrency]   # needs API_KEY
//   node scripts/load-test.mjs views <token> [n] [concurrency]
//
// BASE overrides the target (default http://localhost:3000).

const BASE = process.env.BASE ?? "http://localhost:3000";
const { host: appHost, protocol } = new URL(BASE);

/**
 * A paste on its own origin. No Host-header trick: `fetch` refuses to send one,
 * and `*.localhost` resolves to the loopback without any DNS setup anyway.
 */
const pasteRequest = (token, init = {}) =>
  fetch(`${protocol}//${token}.${appHost}/`, init);

/** Runs `task` n times, at most `concurrency` in flight, timing each one. */
async function hammer(label, n, concurrency, task) {
  const samples = [];
  const statuses = new Map();
  let started = 0;

  const wall = Date.now();
  await Promise.all(
    Array.from({ length: Math.min(concurrency, n) }, async () => {
      while (started < n) {
        started++;
        const at = performance.now();
        const status = await task().catch((error) => String(error));
        samples.push(performance.now() - at);
        statuses.set(status, (statuses.get(status) ?? 0) + 1);
      }
    }),
  );
  const seconds = (Date.now() - wall) / 1000;

  samples.sort((a, b) => a - b);
  const at = (q) =>
    samples[Math.min(samples.length - 1, Math.floor(samples.length * q))];
  console.log(
    `${label}  n=${n} c=${concurrency}  ` +
      `p50=${at(0.5).toFixed(0)}ms p95=${at(0.95).toFixed(0)}ms max=${at(1).toFixed(0)}ms  ` +
      `${(n / seconds).toFixed(1)} req/s  ` +
      [...statuses].map(([status, count]) => `${status}×${count}`).join(" "),
  );
}

const [scenario, ...rest] = process.argv.slice(2);
const tail = (i, fallback) => Number(rest[i] ?? fallback);

switch (scenario) {
  // Public paste reads: the wildcard runtime, cold every time.
  case "read": {
    const [token] = rest;
    await hammer(
      "read       ",
      tail(1, 200),
      tail(2, 20),
      async () => (await pasteRequest(token)).status,
    );
    break;
  }

  // The same reads, conditional. Every hit should be a 304 that never touches
  // Convex File Storage.
  case "conditional": {
    const [token] = rest;
    const etag = (await pasteRequest(token)).headers.get("etag");
    if (!etag) throw new Error("no ETag on the runtime response");
    await hammer(
      "conditional",
      tail(1, 200),
      tail(2, 20),
      async () =>
        (await pasteRequest(token, { headers: { "If-None-Match": etag } }))
          .status,
    );
    break;
  }

  // Anonymous creation and API publishing are the same endpoint; the key is the
  // only difference, so they are one code path and two invocations.
  case "create":
  case "publish": {
    const apiKey = process.env.API_KEY;
    if (scenario === "publish" && !apiKey)
      throw new Error("publish needs API_KEY=<key from the dashboard>");
    const body = `<!doctype html><title>load</title><p>${"x".repeat(512)}`;
    const created = [];
    await hammer(scenario.padEnd(11), tail(0, 60), tail(1, 10), async () => {
      const response = await fetch(`${BASE}/api/v1/pastes?filename=load.html`, {
        method: "POST",
        headers: {
          "Content-Type": "text/html",
          ...(apiKey && scenario === "publish"
            ? { Authorization: `Bearer ${apiKey}` }
            : {}),
        },
        body,
      });
      if (response.ok) created.push((await response.json()).data);
      return response.status;
    });

    // Cleaning up is part of the scenario: a load test you cannot re-run
    // without hand-deleting its debris is a load test nobody re-runs.
    for (const paste of created)
      await fetch(`${BASE}/api/v1/pastes/${paste.token}`, {
        method: "DELETE",
        headers: paste.updateToken
          ? { "X-Update-Token": paste.updateToken }
          : { Authorization: `Bearer ${apiKey}` },
      });
    console.log(`cleaned up ${created.length} pastes`);
    break;
  }

  // One paste, hammered. Views are recorded in `after()`, so the interesting
  // number is not latency but whether the count catches up afterwards — and
  // every view writes the same paste document, which is the known ceiling.
  case "views": {
    const [token] = rest;
    const n = tail(1, 200);
    await hammer(
      "views      ",
      n,
      tail(2, 25),
      async () =>
        (
          await pasteRequest(token, {
            headers: { "User-Agent": "Mozilla/5.0 Chrome/130" },
          })
        ).status,
    );
    console.log(
      `recorded views: npx convex data pastes | grep ${token}  (expect +${n}, settling after the responses)`,
    );
    break;
  }

  default:
    console.log("scenarios: read | conditional | create | publish | views");
    process.exit(1);
}
