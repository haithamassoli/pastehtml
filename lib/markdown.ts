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
 * The rendered body, dressed in the app's own palette so a published note looks
 * like it belongs here rather than like a browser default. Deliberately
 * self-contained: no font or script is fetched from anywhere, so the paste
 * renders the same forever. Body type comes from the Thmanyah stylesheet
 * `lib/paste-http.ts` appends to every HTML paste — its blanket `*` rule wins
 * over anything unqualified here, which is why only code overrides it back.
 */
function document(body: string, filename: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titleOf(body, filename)}</title>
<style>
:root { --ink:#18120e; --paper:#fff8ec; --red:#e62429; --yellow:#ffd400; --blue:#0072ce; }
* { margin:0; box-sizing:border-box; }
body { background-color:var(--paper); background-image:radial-gradient(circle, rgb(24 18 14 / .07) 1px, transparent 1.4px); background-size:12px 12px; color:var(--ink); -webkit-font-smoothing:antialiased; }
main { max-width:50rem; margin:0 auto; padding:2.5rem 1.25rem 4rem; line-height:1.65; }
main > :first-child { margin-top:0; }
h1, h2, h3, h4, h5, h6 { line-height:1.2; margin:1.8rem 0 .7rem; font-weight:700; }
h1 { font-size:clamp(2rem,5vw,2.75rem); text-shadow:2px 2px 0 var(--red); }
h2 { font-size:1.8rem; border-bottom:3px solid var(--ink); padding-bottom:.2rem; }
h3 { font-size:1.35rem; } h4 { font-size:1.1rem; }
p, ul, ol, blockquote, table, pre { margin:1rem 0; }
a { color:var(--blue); text-underline-offset:2px; }
ul, ol { padding-inline-start:1.7rem; }
li { margin:.3rem 0; }
code, pre, pre code { font-family:ui-monospace, "SF Mono", Menlo, Consolas, monospace !important; }
code { font-size:.85em; background:rgb(24 18 14 / .08); padding:.08rem .34rem; unicode-bidi:isolate; }
pre { direction:ltr; text-align:left; background:var(--ink); color:var(--paper); border:3px solid var(--ink); box-shadow:5px 5px 0 0 var(--red); padding:1rem 1.1rem; overflow-x:auto; }
pre code { background:none; padding:0; font-size:.85rem; line-height:1.55; }
blockquote { border-inline-start:6px solid var(--yellow); background:#fff7d6; padding:.6rem 1rem; }
blockquote > :first-child { margin-top:0; } blockquote > :last-child { margin-bottom:0; }
table { border-collapse:collapse; width:100%; display:block; overflow-x:auto; }
th, td { border:2px solid var(--ink); padding:.45rem .7rem; text-align:start; }
th { background:var(--yellow); }
img { max-width:100%; height:auto; border:3px solid var(--ink); }
hr { border:none; border-top:3px dashed rgb(24 18 14 / .3); margin:1.8rem 0; }
input[type="checkbox"] { width:1rem; height:1rem; vertical-align:middle; margin-inline-end:.3rem; }
</style>
</head>
<body>
<main dir="auto">
${body}</main>
</body>
</html>
`;
}
