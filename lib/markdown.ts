// Markdown is rendered to HTML at ingest, not at view time. What gets stored is
// therefore a real HTML document, and every surface downstream — the wildcard
// origin, /raw, /render, the stored-digest ETag, the content-type validator —
// keeps working with nothing changed. The only thing that widens is what a
// publisher may hand in.
//
// Raw HTML inside the Markdown is passed through rather than stripped: this
// product already serves arbitrary user HTML on an isolated origin, so a <script>
// written in a fenced document is the same risk as one written in an .html file,
// which is to say the risk the whole design already accounts for.

/** `.md` / `.markdown`. Also what the rendered file's name is derived from. */
const MARKDOWN_EXTENSION = /\.(md|markdown)$/i;

/** Extension or declared type — the REST API sends the latter and no filename. */
export function isMarkdown(file: { name: string; type: string }): boolean {
  return (
    MARKDOWN_EXTENSION.test(file.name) ||
    file.type.split(";")[0].trim().toLowerCase() === "text/markdown"
  );
}

/**
 * The file to actually upload. HTML passes straight through; Markdown comes back
 * as a self-contained HTML document named `<base>.html`.
 *
 * `marked` is imported dynamically so it stays out of the home page's initial
 * bundle — it is only ever needed once someone drops a `.md`.
 */
export async function asHtmlFile(file: File): Promise<File> {
  if (!isMarkdown(file)) return file;

  const { marked } = await import("marked");
  const body = await marked.parse(await file.text(), { gfm: true });
  const base = file.name.replace(MARKDOWN_EXTENSION, "");

  return new File([document(body, base)], `${base || "index"}.html`, {
    type: "text/html",
  });
}

/**
 * The document's own first H1 names it, falling back to the filename — the same
 * <title> the paste page and the OG card read. What comes back is HTML-safe
 * text, ready to drop into the element: `marked` has already escaped the
 * heading's own characters, so only the filename branch needs escaping, and
 * escaping the heading a second time would render `&amp;` where `&` belongs.
 *
 * ponytail: a regex over the rendered HTML, not a DOM parse. It reads an H1 that
 * `marked` itself just emitted, and a miss costs a filename-derived title. Parse
 * it properly the day the title matters more than that.
 */
function titleOf(html: string, fallback: string): string {
  const heading = /<h1[^>]*>([\s\S]*?)<\/h1>/i
    .exec(html)?.[1]
    // Raw HTML the author wrote inside the heading. Dropped rather than shown:
    // `<title>` renders no markup, and this is what keeps a `</title>` out.
    .replace(/<[^>]*>/g, "")
    .trim();
  return heading || escape(fallback) || "Untitled";
}

const escape = (value: string) =>
  value.replace(
    /[&<>"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[
        char
      ] as string,
  );

/**
 * The reader's themes: three light, three dark. Each is the same dozen custom
 * properties the stylesheet below is written against, so a theme is data, not
 * CSS. Paper is the app's own newsprint and Ink is its night edition; the rest
 * trade the comic look for plain, calmer reading.
 */
const THEMES = {
  paper: {
    label: "Paper",
    scheme: "light",
    vars: "--bg:#fff8ec; --fg:#18120e; --line:#18120e; --w:3px; --link:#0072ce; --accent:#e62429; --mark:#ffd400; --quote:#fff7d6; --th:#ffd400; --pre:#18120e; --pre-fg:#fff8ec; --dots:rgb(24 18 14 / .07);",
  },
  sepia: {
    label: "Sepia",
    scheme: "light",
    vars: "--bg:#f4ecd8; --fg:#3b2e1e; --line:#8b6f47; --w:2px; --link:#8a4a0b; --accent:#dcc59c; --mark:#c9a86a; --quote:#ece1c6; --th:#e6d5b0; --pre:#3b2e1e; --pre-fg:#f4ecd8; --dots:transparent;",
  },
  white: {
    label: "White",
    scheme: "light",
    vars: "--bg:#ffffff; --fg:#1f2328; --line:#d0d7de; --w:1px; --link:#0969da; --accent:transparent; --mark:#d0d7de; --quote:#f6f8fa; --th:#f6f8fa; --pre:#f6f8fa; --pre-fg:#1f2328; --dots:transparent;",
  },
  ink: {
    label: "Ink",
    scheme: "dark",
    vars: "--bg:#18120e; --fg:#f3e9d7; --line:#f3e9d7; --w:3px; --link:#5cb3ff; --accent:#e62429; --mark:#ffd400; --quote:#2a2210; --th:#4a3b00; --pre:#0b0806; --pre-fg:#f3e9d7; --dots:rgb(255 248 236 / .05);",
  },
  slate: {
    label: "Slate",
    scheme: "dark",
    vars: "--bg:#22272e; --fg:#c9d1d9; --line:#444c56; --w:1px; --link:#6cb6ff; --accent:transparent; --mark:#545d68; --quote:#2d333b; --th:#2d333b; --pre:#1c2128; --pre-fg:#c9d1d9; --dots:transparent;",
  },
  black: {
    label: "Black",
    scheme: "dark",
    vars: "--bg:#000000; --fg:#d4d4d4; --line:#333333; --w:1px; --link:#6cb6ff; --accent:transparent; --mark:#444444; --quote:#111111; --th:#161616; --pre:#0d0d0d; --pre-fg:#d4d4d4; --dots:transparent;",
  },
} as const;

type Scheme = (typeof THEMES)[keyof typeof THEMES]["scheme"];

/** Where a chosen theme is kept. Per paste: every paste is its own origin. */
const THEME_KEY = "ph-reading-theme";

const themeCss = Object.entries(THEMES)
  .map(
    ([id, t]) => `[data-theme="${id}"] { color-scheme:${t.scheme}; ${t.vars} }`,
  )
  .join("\n");

const themeOptions = (scheme: Scheme) =>
  Object.entries(THEMES)
    .filter(([, t]) => t.scheme === scheme)
    .map(([id, t]) => `<option value="${id}">${t.label}</option>`)
    .join("");

/**
 * The rendered body, dressed in the app's own palette so a published note looks
 * like it belongs here rather than like a browser default. Deliberately
 * self-contained: no font or script is fetched from anywhere, so the paste
 * renders the same forever. Body type comes from the Thmanyah stylesheet
 * `lib/paste-http.ts` appends to every HTML paste — its blanket `*` rule wins
 * over anything unqualified here, which is why only code overrides it back.
 *
 * The reader picks the theme. With no choice made it follows the system: Paper
 * by day, Ink at night. A choice is set on `<html>` by the script in `<head>`,
 * before first paint, so a dark reader never sees a flash of paper. Storage
 * throws in the sandboxed `/render` preview (an opaque origin); the picker
 * still works there, it just forgets on reload.
 *
 * ponytail: the choice is remembered per paste, since each is its own origin.
 * A cookie on the parent domain would carry it across pastes — at the price of
 * a cookie every paste and the app then receive.
 */
function document(body: string, filename: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titleOf(body, filename)}</title>
<script>try{var t=localStorage.getItem("${THEME_KEY}");if(${JSON.stringify(Object.keys(THEMES))}.indexOf(t)>-1)document.documentElement.dataset.theme=t}catch(e){}</script>
<style>
:root { color-scheme:light; ${THEMES.paper.vars} }
@media (prefers-color-scheme: dark) { :root:not([data-theme]) { color-scheme:dark; ${THEMES.ink.vars} } }
${themeCss}
* { margin:0; box-sizing:border-box; }
body { background-color:var(--bg); background-image:radial-gradient(circle, var(--dots) 1px, transparent 1.4px); background-size:12px 12px; color:var(--fg); -webkit-font-smoothing:antialiased; }
.ph-theme { display:flex; justify-content:flex-end; align-items:center; gap:.5rem; max-width:50rem; margin:0 auto; padding:1rem 1.25rem 0; font-size:.85rem; }
.ph-theme select { font:inherit; color:var(--fg); background:var(--bg); border:var(--w) solid var(--line); padding:.25rem .4rem; }
main { max-width:50rem; margin:0 auto; padding:1.5rem 1.25rem 4rem; line-height:1.65; }
main > :first-child { margin-top:0; }
h1, h2, h3, h4, h5, h6 { line-height:1.2; margin:1.8rem 0 .7rem; font-weight:700; }
h1 { font-size:clamp(2rem,5vw,2.75rem); text-shadow:2px 2px 0 var(--accent); }
h2 { font-size:1.8rem; border-bottom:var(--w) solid var(--line); padding-bottom:.2rem; }
h3 { font-size:1.35rem; } h4 { font-size:1.1rem; }
p, ul, ol, blockquote, table, pre { margin:1rem 0; }
a { color:var(--link); text-underline-offset:2px; }
ul, ol { padding-inline-start:1.7rem; }
li { margin:.3rem 0; }
code, pre, pre code { font-family:ui-monospace, "SF Mono", Menlo, Consolas, monospace !important; }
code { font-size:.85em; background:color-mix(in srgb, var(--fg) 9%, transparent); padding:.08rem .34rem; unicode-bidi:isolate; }
pre { direction:ltr; text-align:left; background:var(--pre); color:var(--pre-fg); border:var(--w) solid var(--line); box-shadow:5px 5px 0 0 var(--accent); padding:1rem 1.1rem; overflow-x:auto; }
pre code { background:none; padding:0; font-size:.85rem; line-height:1.55; }
blockquote { border-inline-start:6px solid var(--mark); background:var(--quote); padding:.6rem 1rem; }
blockquote > :first-child { margin-top:0; } blockquote > :last-child { margin-bottom:0; }
table { border-collapse:collapse; width:100%; display:block; overflow-x:auto; }
th, td { border:var(--w) solid var(--line); padding:.45rem .7rem; text-align:start; }
th { background:var(--th); }
img { max-width:100%; height:auto; border:var(--w) solid var(--line); }
hr { border:none; border-top:var(--w) dashed color-mix(in srgb, var(--fg) 30%, transparent); margin:1.8rem 0; }
input[type="checkbox"] { width:1rem; height:1rem; vertical-align:middle; margin-inline-end:.3rem; }
@media print { .ph-theme { display:none; } }
</style>
</head>
<body>
<label class="ph-theme">Theme
<select id="ph-theme"><option value="auto">Auto</option><optgroup label="Light">${themeOptions("light")}</optgroup><optgroup label="Dark">${themeOptions("dark")}</optgroup></select>
</label>
<script>(function(){var r=document.documentElement,s=document.getElementById("ph-theme");s.value=r.dataset.theme||"auto";s.onchange=function(){if(s.value==="auto")delete r.dataset.theme;else r.dataset.theme=s.value;try{localStorage.setItem("${THEME_KEY}",s.value)}catch(e){}}})()</script>
<main dir="auto">
${body}</main>
</body>
</html>
`;
}
