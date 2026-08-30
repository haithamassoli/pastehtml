// The legacy paste corpus — one file per shape of HTML the old Rails app served
// and this rebuild has to keep serving unchanged. Read as bytes and never as
// strings, because most of what makes them interesting (a BOM, CRLF endings,
// trailing tabs) disappears the moment something decodes and re-encodes them.
//
// Prettier is told to leave the files alone in `.prettierignore`; reformatting
// one would quietly change what the compatibility tests compare against.
//
// Named `fixtures.ts` rather than `index.ts` because `test/fixtures/legacy.ts`
// (the migration corpus) sits beside this directory, and a bare
// `test/fixtures/legacy` import resolves to that file instead.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Both runners start at the repo root: `npm run test` and `npm run test:e2e`.
const dir = join(process.cwd(), "test/fixtures/legacy");

export type LegacyFixture = {
  name: string;
  /** Why this shape is in the corpus. */
  why: string;
  bytes: Buffer;
};

const file = (name: string, why: string): LegacyFixture => ({
  name,
  why,
  bytes: readFileSync(join(dir, name)),
});

/**
 * Base64 — the encoding Convex reports for a stored object, and therefore the
 * exact string the serving layer hands out as the ETag. (The `sha256` field is
 * documented as hex in `convex`'s own types; the deployment returns base64.)
 */
export const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("base64");

/**
 * Near the 5 MiB `MAX_UPLOAD_BYTES` ceiling, generated rather than committed: a
 * multi-megabyte blob in git to prove one assertion is a bad trade, and here it
 * is the size that matters, not the markup. Hardcoding the limit matches the
 * other suites (`e2e/api.spec.ts`, `e2e/publish.spec.ts`).
 */
function largeFixture(): LegacyFixture {
  const head = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>Large</title></head>\n<body>\n`;
  const tail = `</body>\n</html>\n`;
  const row = `<p class="row">A line of a page that grew for a decade — ünïcode included.</p>\n`;
  // Byte lengths, not character counts: the row carries a multi-byte character
  // on purpose, which is exactly the arithmetic this whole suite exists to check.
  const size = (value: string) => Buffer.byteLength(value, "utf8");
  const budget = 5 * 1024 * 1024 - 1024 - size(head) - size(tail);
  const html = head + row.repeat(Math.floor(budget / size(row))) + tail;
  return {
    name: "large.html",
    why: "a document just under the upload ceiling, where a re-encode or a truncated stream would show",
    bytes: Buffer.from(html, "utf8"),
  };
}

export const legacyFixtures: LegacyFixture[] = [
  file("inline-css.html", "a <style> block and inline style attributes"),
  file("inline-js.html", "inline <script>, event handlers and document.write"),
  file(
    "unicode.html",
    "multi-byte text, RTL scripts, emoji and combining marks",
  ),
  file(
    "whitespace.html",
    "a UTF-8 BOM, CRLF and lone-CR endings, tabs and trailing spaces",
  ),
  file(
    "malformed.html",
    "unclosed tags, bare ampersands and unquoted attributes",
  ),
  largeFixture(),
];
