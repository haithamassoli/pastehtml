// GET /api/health — the one URL an uptime checker polls.
//
// Not `/`: the marketing page renders without touching the backend, so it stays
// green while every paste on the site is unreachable. This runs the same
// indexed lookup a visitor's request runs, for a token that cannot exist, so a
// 200 means Next reached Convex and Convex answered — the whole chain that
// actually breaks. No rate limit and no envelope: a checker polling every
// minute must never be throttled into a false alarm, and it reads the status
// code, not a body.
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";
import { convex } from "@/lib/paste-http";

// A GET handler with no request argument would otherwise be prerendered at
// build time, and a health check answered from the build is not one.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const started = Date.now();
  const headers = { "Cache-Control": "no-store" };

  try {
    await convex.query(api.pastes.getByToken, { token: "healthcheck" });
    return Response.json({ ok: true, ms: Date.now() - started }, { headers });
  } catch (error) {
    logger.error("health check failed", { error });
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
