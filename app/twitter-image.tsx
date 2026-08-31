// X's card is the same 1200×630 crop as the Open Graph one, so it is the same
// drawing. Re-exported rather than left to X's `og:image` fallback so the tag
// is declared outright — some scrapers only look for `twitter:image`.
export { alt, size, contentType, default } from "./opengraph-image";
