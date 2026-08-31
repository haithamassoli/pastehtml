import type { MetadataRoute } from "next";

// The paper the whole design is printed on. Also the `theme_color`, so an
// installed window's chrome matches the page it opens onto.
export const THEME_COLOR = "#fff8ec";

/**
 * Only the app host serves this: `proxy.ts` answers anything but `/` on a paste
 * origin with a 404, so a published page can never claim to be this app.
 *
 * `id` is pinned to `/` so the identity survives a future change to
 * `start_url` — a browser keys an installed app on this, not on the URL.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "pastehtml — publish HTML, get a URL",
    short_name: "pastehtml",
    description:
      "Drop an HTML or Markdown file and it goes live instantly on its own URL. No account needed.",
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fff8ec",
    theme_color: THEME_COLOR,
    categories: ["developer", "productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Full-bleed, glyph inside the 80% safe zone, so a launcher can crop it
      // to whatever shape it likes without clipping the mark.
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "New paste", url: "/" },
      { name: "Dashboard", url: "/dashboard" },
    ],
  };
}
