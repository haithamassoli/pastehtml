"use client";

// Error boundary for every route below the root layout: a Convex query that
// rejects, an expired session, a paste that is not yours, a backend blip. Was
// scoped to the dashboard; nothing in it was dashboard-specific, and the rest
// of the app had no boundary at all.
//
// Next 16 renamed this second prop from `reset` to `retry`.
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 p-6">
      <div
        role="alert"
        className="border-border flex flex-col items-start gap-3 rounded-lg border p-6"
      >
        <p className="font-medium">Something went wrong</p>
        <p className="text-muted-foreground text-sm">{errorMessage(error)}</p>
        {error.digest && (
          <p className="text-muted-foreground font-mono text-xs">
            {error.digest}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      </div>
    </main>
  );
}
