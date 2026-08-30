"use client";

import { useEffect } from "react";

/**
 * Registers `public/sw.js`, which is what makes the app installable and gives a
 * dropped connection a real page instead of the browser's error screen.
 *
 * Production only: in development the worker would sit in front of every
 * navigation and serve a stale shell after an edit. `updateViaCache: "none"` so
 * a new worker is picked up on the next visit rather than after a browser
 * cache expiry we do not control.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    // Failure is not worth a console error: an unregistered worker costs the
    // visitor an offline page, nothing else.
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  }, []);

  return null;
}
