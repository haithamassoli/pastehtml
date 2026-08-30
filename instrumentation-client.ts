// Client-side error tracking. This file runs after the document loads and
// before hydration, so a crash in the first render is already covered.
//
// Two native events are the whole surface: React's own error boundaries handle
// what they can (`app/(dashboard)/dashboard/error.tsx`), and everything that
// escapes one — an event handler, a failed fetch, a third-party script — lands
// in exactly one of these. No-ops without a DSN, like the server half.
import { captureException } from "@/lib/sentry";

const where = () => ({ url: location.href });

window.addEventListener("error", (event) =>
  captureException(event.error ?? event.message, where()),
);

window.addEventListener("unhandledrejection", (event) =>
  captureException(event.reason, where()),
);
