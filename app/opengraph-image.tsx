// The card every shared pastehtml link unfurls into. Generated rather than
// stored: the copy on it is the product's one-line pitch, and a PNG in the repo
// would be a second place to keep that true. `app/twitter-image.tsx` re-exports
// this one — X's card is the same 1200×630 crop, so it is the same drawing.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { config } from "@/lib/config";
import { THEME_COLOR } from "./manifest";

export const alt = "pastehtml — publish HTML and get an instant public URL";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#18120e";
const PAPER = THEME_COLOR;
const RED = "#e62429";
const YELLOW = "#ffd400";
const BLUE = "#0072ce";

/**
 * The page's own three faces, read off disk rather than fetched: a social
 * scraper is the one caller that never waits around, and a font CDN in that
 * path is a blank card whenever it is slow. Reading from `process.cwd()` is
 * safe because both image routes prerender at build time, where `public/` is
 * on disk — check the build output still marks them `○` before making either
 * of them dynamic.
 *
 * Satori reads ttf/otf/woff but not woff2, hence the `.ttf` cuts of the sans
 * that the app itself loads as woff2.
 */
const font = (file: string) =>
  readFile(join(process.cwd(), "public/fonts", file));
const fonts = Promise.all([
  font("Bangers-Regular.ttf"),
  font("ThmanyahSans-Regular.ttf"),
  font("ThmanyahSans-Bold.ttf"),
]);

/**
 * `ImageResponse` renders with Satori, which supports a deliberate subset of
 * CSS: flexbox only, no Tailwind, every container needs an explicit `display`,
 * and SVG has no `<text>`. Nothing here is shared with the app's stylesheet for
 * that reason — including the headline's red offset, which is a second copy of
 * the text behind the first rather than a `text-shadow`. Satori draws a shadow
 * per glyph, so the red would land *inside* the letterforms.
 */
export default async function OpengraphImage() {
  const [bangers, sans, sansBold] = await fonts;
  const host = new URL(config.appUrl).host;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: "24px 40px 40px 24px",
        background: PAPER,
        backgroundImage:
          "radial-gradient(circle at 14% 4%, rgba(255,212,0,0.45), transparent 42%), radial-gradient(circle at 94% 92%, rgba(0,114,206,0.25), transparent 46%)",
        fontFamily: "Thmanyah Sans",
        color: INK,
      }}
    >
      {/* One panel, the way every page in the app is one panel. */}
      <div
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          border: `7px solid ${INK}`,
          background: "#ffffff",
          boxShadow: `14px 14px 0 0 ${INK}`,
          padding: "34px 46px 38px",
          overflow: "hidden",
        }}
      >
        <Halftone />

        {/* Masthead: the wordmark exactly as the site's header wears it. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            transform: "rotate(-1.5deg)",
          }}
        >
          <svg width="52" height="52" viewBox="0 0 100 100">
            <rect width="100" height="100" fill={YELLOW} />
            <rect
              x="4"
              y="4"
              width="92"
              height="92"
              fill="none"
              stroke={INK}
              strokeWidth="8"
            />
            <g
              fill="none"
              stroke={INK}
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
              fontFamily: "Bangers",
              fontSize: 34,
              letterSpacing: 1,
              paddingTop: 5,
            }}
          >
            pastehtml
            <span style={{ color: RED }}>.assoli.site</span>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 30 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                transform: "rotate(-1.5deg)",
                background: YELLOW,
                border: `3px solid ${INK}`,
                boxShadow: `4px 4px 0 0 ${INK}`,
                padding: "5px 11px",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 2.5,
                marginBottom: 20,
              }}
            >
              NO SIGN-UP · LIVE IN ONE SECOND
            </div>

            <Kapow>Publish HTML,</Kapow>
            <Kapow>get a URL.</Kapow>

            <div style={{ display: "flex", fontSize: 25, color: "#57504a", marginTop: 16 }}>
              Drop a file. It goes live instantly.
            </div>
          </div>

          {/* The published page, tipped off-square, with the burst on its
              corner — the same pairing the marketing hero uses. */}
          <div
            style={{
              position: "relative",
              display: "flex",
              width: 386,
              height: 268,
              marginRight: 10,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 22,
                left: 0,
                display: "flex",
                flexDirection: "column",
                width: 360,
                border: `4px solid ${INK}`,
                background: "#ffffff",
                boxShadow: `9px 9px 0 0 ${INK}`,
                transform: "rotate(2.5deg)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  borderBottom: `4px solid ${INK}`,
                  background: PAPER,
                  padding: "8px 10px",
                }}
              >
                {[RED, YELLOW, BLUE].map((dot) => (
                  <div
                    key={dot}
                    style={{
                      display: "flex",
                      width: 13,
                      height: 13,
                      borderRadius: 13,
                      border: `2px solid ${INK}`,
                      background: dot,
                    }}
                  />
                ))}
                <div style={{ display: "flex", fontSize: 12, color: "#57504a", marginLeft: 1, whiteSpace: "nowrap" }}>
                  {host}/p/k3f9x2q7
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", padding: "18px 18px 22px", gap: 11 }}>
                <div style={{ display: "flex", fontFamily: "Bangers", fontSize: 38, letterSpacing: 1 }}>
                  Hello, world!
                </div>
                <div style={{ display: "flex", width: 250, height: 12, background: "#e8e0d2" }} />
                <div style={{ display: "flex", width: 290, height: 12, background: "#e8e0d2" }} />
                <div style={{ display: "flex", width: 180, height: 12, background: "#e8e0d2" }} />
                <div
                  style={{
                    display: "flex",
                    alignSelf: "flex-start",
                    marginTop: 4,
                    background: BLUE,
                    color: "#ffffff",
                    border: `3px solid ${INK}`,
                    padding: "4px 10px",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                  }}
                >
                  LIVE
                </div>
              </div>
            </div>
            <Burst />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Bangers",
              fontSize: 30,
              letterSpacing: 1,
              color: "#ffffff",
              background: INK,
              padding: "7px 16px 3px",
              transform: "rotate(-1deg)",
            }}
          >
            {host}
          </div>
          {["BROWSER", "CLI", "REST API", "MCP"].map((label, index) => (
            <div
              key={label}
              style={{
                display: "flex",
                border: `3px solid ${INK}`,
                background: "#ffffff",
                padding: "6px 11px",
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: 1.5,
                transform: index % 2 ? "rotate(1.5deg)" : "rotate(-1.5deg)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Bangers", data: bangers, weight: 400, style: "normal" },
        { name: "Thmanyah Sans", data: sans, weight: 400, style: "normal" },
        { name: "Thmanyah Sans", data: sansBold, weight: 700, style: "normal" },
      ],
    },
  );
}

/** One headline line: ink over a red copy of itself, offset by six pixels. */
function Kapow({ children }: { children: string }) {
  const base = {
    fontFamily: "Bangers",
    fontSize: 84,
    letterSpacing: 2,
    lineHeight: 1,
  } as const;
  return (
    <div style={{ display: "flex", position: "relative", height: 84 }}>
      <div style={{ ...base, position: "absolute", left: 6, top: 6, color: RED }}>
        {children}
      </div>
      <div style={{ ...base, position: "absolute", left: 0, top: 0, color: INK }}>
        {children}
      </div>
    </div>
  );
}

/** The FREE burst. Satori has no `<text>`, so the word rides on top as HTML. */
function Burst() {
  return (
    <div
      style={{
        position: "absolute",
        top: -54,
        right: -30,
        display: "flex",
        width: 142,
        height: 142,
        transform: "rotate(10deg)",
      }}
    >
      <svg width="142" height="142" viewBox="0 0 120 120">
        <polygon
          fill={RED}
          stroke={INK}
          strokeWidth="4"
          points="60,4 71,26 93,13 91,38 116,37 99,55 120,68 96,74 105,98 81,90 78,115 60,96 42,115 39,90 15,98 24,74 0,68 21,55 4,37 29,38 27,13 49,26"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 142,
          height: 142,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Bangers",
          fontSize: 38,
          letterSpacing: 2,
          color: "#ffffff",
          transform: "rotate(-9deg)",
        }}
      >
        FREE
      </div>
    </div>
  );
}

/**
 * Ben-Day dots in the bottom-left corner. Drawn as circles rather than as the
 * app's tiled `radial-gradient`, which Satori paints once instead of repeating.
 */
function Halftone() {
  const dots = [];
  for (let row = 0; row < 9; row++)
    for (let column = 0; column < 13; column++)
      dots.push(
        <circle
          key={`${row}-${column}`}
          cx={column * 17 + 8}
          cy={row * 17 + 8}
          r={4.2 - Math.max(row, column) * 0.22}
          fill={RED}
        />,
      );
  return (
    <div style={{ position: "absolute", left: -26, bottom: -26, display: "flex", opacity: 0.3 }}>
      <svg width="230" height="160" viewBox="0 0 230 160">
        {dots}
      </svg>
    </div>
  );
}
