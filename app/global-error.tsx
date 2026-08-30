"use client";

// The last resort: an error thrown by the root layout itself, which `app/error.tsx`
// cannot catch because it renders inside it. It replaces the whole document, so
// it brings its own `<html>`, its own `<body>` and no styling that depends on
// providers that may be the thing that failed.
//
// Next 16 renamed the second prop from `reset` to `retry`.
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-mono text-sm opacity-60">500</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          pastehtml could not load
        </h1>
        <p className="max-w-md opacity-70">
          Something failed before the page could render. Reloading usually
          clears it.
        </p>
        {error.digest && (
          <p className="font-mono text-xs opacity-60">{error.digest}</p>
        )}
        <button
          type="button"
          onClick={retry}
          className="mt-3 h-9 rounded-lg border px-4 text-sm font-medium"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
