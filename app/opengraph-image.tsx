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
  const ink = "#18120e";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        // The paper the site is printed on, dotted like the page itself.
        background: THEME_COLOR,
        backgroundImage:
          "radial-gradient(circle at 18% 8%, rgba(255,212,0,0.35), transparent 40%), radial-gradient(circle at 88% 70%, rgba(0,114,206,0.18), transparent 42%)",
        color: ink,
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="96" height="96" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#ffffff" />
          <rect
            x="4"
            y="4"
            width="92"
            height="92"
            fill="none"
            stroke={ink}
            strokeWidth="8"
          />
          <g
            fill="none"
            stroke={ink}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="33,36 21,50 33,64" />
            <line x1="57" y1="32" x2="43" y2="68" />
            <polyline points="67,36 79,50 67,64" />
          </g>
        </svg>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            background: "#ffd400",
            border: `4px solid ${ink}`,
            padding: "10px 18px",
          }}
        >
          No account needed
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: -2,
            // No offset shadow here, unlike the page's headline: Satori draws
            // each glyph's shadow over its neighbours, so the red lands inside
            // the letterforms instead of behind them. The chips carry the
            // colour on this card instead.
          }}
        >
          Publish HTML, get a URL
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#57504a" }}>
          Drop a file. It goes live instantly, on its own origin.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 700,
          color: "#ffffff",
          background: ink,
          padding: "12px 20px",
          alignSelf: "flex-start",
        }}
      >
        {new URL(config.appUrl).host}
      </div>
    </div>,
    size,
  );
}
