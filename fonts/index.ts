import { Bangers, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";

export const thmanyahSans = localFont({
  src: [
    {
      path: "../public/fonts/thmanyahsans-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/thmanyahsans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/thmanyahsans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/thmanyahsans-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/thmanyahsans-Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-thmanyah-sans",
  display: "swap",
});

/**
 * The comic voice: Bangers sets every heading, button label and fact value.
 * It has one weight and no Arabic glyphs — Arabic falls through to the sans
 * below it in `--font-display`, which is the same fallback the Latin-only
 * face would take anyway.
 */
export const bangers = Bangers({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bangers",
  display: "swap",
});

/** URLs, tokens and shell commands — the machine's voice, not the page's. */
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});
