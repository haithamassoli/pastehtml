// POST /api/v1/abuse — tell us a paste is phishing, malware or spam.
//
//   curl -X POST https://pastehtml.assoli.site/api/v1/abuse \
//        -H 'Content-Type: application/json' \
//        -d '{"token":"abc123def456","reason":"phishing page for a bank"}'
//
// Unauthenticated, because a report is a favour and a sign-up wall means never
// hearing about the page. Nothing about the reporter is recorded — see the
// `abuseReports` table. The report lands in a queue the operator reads with
// `npx convex run admin:pending`; `convex/admin.ts` is the rest of the workflow.
import { api } from "@/convex/_generated/api";
import { ok, route } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { convex } from "@/lib/paste-http";

export const POST = route("api:write", async ({ request, id }) => {
  const body: unknown = await request.json().catch(() => {
    throw new AppError("VALIDATION", "Body is not valid JSON.");
  });
  const { token, reason } = (body ?? {}) as Record<string, unknown>;
  if (typeof token !== "string" || typeof reason !== "string")
    throw new AppError("VALIDATION", `"token" and "reason" are required.`);

  // Convex re-checks that the paste exists and throttles per reported paste, so
  // the edge limit this route already carries is not the only thing stopping a
  // report flood.
  await convex.mutation(api.admin.report, { token, reason });

  // 202: received, and a human decides what happens next.
  return ok({ received: true }, id, 202);
});
