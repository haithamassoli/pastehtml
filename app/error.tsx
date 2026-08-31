"use client";

// Error boundary for every route below the root layout: a Convex query that
// rejects, an expired session, a paste that is not yours, a backend blip. Was
// scoped to the dashboard; nothing in it was dashboard-specific, and the rest
// of the app had no boundary at all.
//
// Wears `StatusPage` like 404 and 422 do, so the three read as one set. The
// panel is the alert, hence `role="alert"` on the wrapper rather than a second
// box inside it.
//
// Next 16 renamed this second prop from `reset` to `retry`.
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/status-page";
import { errorMessage } from "@/lib/errors";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <StatusPage
      code="500"
      title="Something went wrong"
      role="alert"
      actions={
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      }
    >
      <p>{errorMessage(error)}</p>
      {/* The one string support can match against a server log. */}
      {error.digest && <p className="font-mono text-xs">{error.digest}</p>}
    </StatusPage>
  );
}
