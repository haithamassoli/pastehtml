"use client";

// Error state for every dashboard route. A Convex query that rejects — an
// expired session, a paste that is not yours, a backend blip — throws during
// render and lands here instead of blanking the page.
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-border flex flex-col items-start gap-3 rounded-lg border p-6"
    >
      <p className="font-medium">Something went wrong</p>
      <p className="text-muted-foreground text-sm">{errorMessage(error)}</p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
