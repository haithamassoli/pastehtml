import { expect, test, vi } from "vitest";

// The endpoint exists to fail when Convex does, so the Convex client is the
// only thing worth stubbing here.
const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = query;
    mutation = vi.fn();
  },
}));

const { GET } = await import("./route");

test("reports healthy when Convex answers", async () => {
  query.mockResolvedValueOnce(null);
  const response = await GET();

  expect(response.status).toBe(200);
  expect((await response.json()).ok).toBe(true);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

test("reports 503 when Convex does not", async () => {
  // A health check that stays green through a backend outage is worse than no
  // health check, because it is the thing the alert is wired to.
  query.mockRejectedValueOnce(new Error("connection refused"));
  const response = await GET();

  expect(response.status).toBe(503);
  expect((await response.json()).ok).toBe(false);
});
