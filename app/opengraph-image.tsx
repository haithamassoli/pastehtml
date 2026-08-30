// The card every shared pastehtml link unfurls into. Generated rather than
// stored: the copy on it is the product's one-line pitch, and a PNG in the repo
// would be a second place to keep that true.
import { ImageResponse } from "next/og";
import { config } from "@/lib/config";
import { THEME_COLOR } from "./manifest";

export const alt = "pastehtml — publish HTML and get an instant public URL";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// `ImageResponse` renders with Satori, which supports a deliberate subset of
// CSS: flexbox only, no Tailwind, and every container needs an explicit
// `display`. Nothing here is shared with the app's stylesheet for that reason.
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: THEME_COLOR,
        color: "#ffffff",
        padding: 80,
        fontFamily: "sans-serif",
      }}
    >
      <svg width="112" height="112" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="22" fill="#ffffff" />
        <g
          fill="none"
          stroke={THEME_COLOR}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="33,36 21,50 33,64" />
          <line x1="57" y1="32" x2="43" y2="68" />
          <polyline points="67,36 79,50 67,64" />
        </g>
      </svg>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2 }}>
          Publish HTML, get a URL
        </div>
        <div style={{ fontSize: 34, color: "#a1a1a1" }}>
          Drop a file. It goes live instantly, on its own origin. No account
          needed.
        </div>
      </div>

      <div style={{ display: "flex", fontSize: 30, color: "#a1a1a1" }}>
        {new URL(config.appUrl).host}
      </div>
    </div>,
    size,
  );
}
