import type { Metadata } from "next";

// Precached at service-worker install and served whenever a navigation cannot
// reach the network. Static and self-contained on purpose: it has to render
// with nothing but what the cache already holds.
export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false },
};

export default function Offline() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 p-6 text-center">
      <p className="text-muted-foreground font-mono text-sm">offline</p>
      <h1 className="text-2xl font-semibold tracking-tight">No connection</h1>
      <p className="text-muted-foreground">
        pastehtml needs the network to publish and to load a paste. This page
        will work again the moment you are back online.
      </p>
    </main>
  );
}
