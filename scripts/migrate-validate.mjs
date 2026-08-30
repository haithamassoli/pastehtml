#!/usr/bin/env node
// Compares a legacy export against what actually landed in Convex and writes a
// discrepancy report.
//
//   node scripts/migrate-validate.mjs ./export [--prod] [--sample=100]
//
// Every record is checked for presence, metadata, ownership, folder ownership
// and content length; a sample additionally has its bytes pulled back out of
// File Storage and compared byte for byte. Exits non-zero when anything at all
// disagrees, so it can gate the cutover in CI.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import {
  chunk,
  convexUrl,
  digests,
  parseArgs,
  readExport,
  runConvex,
} from "./migrate-lib.mjs";

const INSPECT_BATCH = 100;

const { positional, flags } = parseArgs(process.argv.slice(2));
const dir = positional[0];
if (!dir) {
  console.error(
    "usage: node scripts/migrate-validate.mjs <export-dir> [--prod] [--sample=N]",
  );
  process.exit(2);
}
const options = { prod: Boolean(flags.prod) };
const sampleSize = Number(flags.sample ?? 100);

const { owners, folders, pastes } = readExport(dir);
const client = new ConvexHttpClient(convexUrl());
const foldersById = new Map(folders.map((folder) => [folder.legacyId, folder]));

const discrepancies = [];
const note = (paste, kind, expected, actual) =>
  discrepancies.push({
    legacyId: paste.legacyId,
    token: paste.token,
    kind,
    expected,
    actual,
  });

// The app trims and lowercases on the way in, so comparing raw source values
// would report a discrepancy for every record whose title had a stray space.
const trimmed = (value) => (value === undefined ? undefined : value.trim());
const norm = (value) => (value === undefined ? undefined : value.toLowerCase());

/** Evenly spaced across the export, so a sample is not just the oldest rows. */
const step = Math.max(1, Math.ceil(pastes.length / Math.max(1, sampleSize)));
const sampled = new Set(
  pastes.filter((_, index) => index % step === 0).map((paste) => paste.token),
);

let checked = 0;
for (const batch of chunk(pastes, INSPECT_BATCH)) {
  const found = runConvex(
    "migrate:inspect",
    { tokens: batch.map((paste) => paste.token) },
    options,
  );

  for (const [index, paste] of batch.entries()) {
    const actual = found[index];
    if (!actual) {
      note(paste, "missing", "present", null);
      continue;
    }

    const bytes = Buffer.from(paste.contentBase64, "base64");
    const ownerId = paste.legacyOwnerId
      ? owners[paste.legacyOwnerId]
      : undefined;
    const folder =
      ownerId && paste.legacyFolderId
        ? foldersById.get(paste.legacyFolderId)
        : undefined;

    const expected = {
      filename: trimmed(paste.filename),
      title: trimmed(paste.title),
      description: trimmed(paste.description),
      customSubdomain: norm(paste.customSubdomain),
      visibility: paste.visibility,
      viewsCount: paste.viewsCount ?? 0,
      createdAt: paste.createdAt,
      updatedAt: paste.updatedAt,
      ownerId,
      contentLength: bytes.byteLength,
      // Protection survives; the password behind it usually does not.
      hasPassword: paste.visibility === "protected",
      // An owned paste never keeps an update token — `pastes.claim` retires it.
      hasUpdateToken: Boolean(!ownerId && paste.updateToken),
      folderName: folder?.name,
    };

    for (const [field, want] of Object.entries(expected))
      if (actual[field] !== want)
        note(paste, field, want, actual[field] ?? null);

    // A folder must belong to the same account as the paste filed in it.
    if (
      actual.folderName !== undefined &&
      actual.folderOwnerId !== actual.ownerId
    )
      note(
        paste,
        "folderOwnerId",
        actual.ownerId ?? null,
        actual.folderOwnerId,
      );

    if (!digests(bytes).includes(actual.sha256))
      note(paste, "sha256", digests(bytes)[0], actual.sha256);

    // Wildcard resolution, on every record that claims a name of its own plus
    // the sample. This is the check that proves the old URL still answers: it
    // goes through the same query the wildcard host and the raw endpoint use.
    for (const subdomain of [
      ...(sampled.has(paste.token) ? [paste.token] : []),
      ...(paste.customSubdomain ? [paste.customSubdomain] : []),
    ]) {
      const resolved = await client.query(
        makeFunctionReference("pastes:resolveForRuntime"),
        { subdomain },
      );
      if (resolved?.token !== paste.token) {
        note(
          paste,
          `wildcard:${subdomain}`,
          paste.token,
          resolved?.token ?? null,
        );
        continue;
      }
      // Protected pastes must answer locked and hand over no URL; public ones
      // must hand over a URL or the host has nothing to serve.
      const locked = paste.visibility === "protected";
      if (resolved.locked !== locked)
        note(paste, `locked:${subdomain}`, locked, resolved.locked);
      if (!locked && !resolved.url)
        note(paste, `url:${subdomain}`, "a storage url", null);
    }

    // Raw bytes, for the sample. Convex's digest already covers this, but the
    // digest is computed by the same system being validated — pulling the file
    // back down is the check that does not take Convex's word for it.
    if (sampled.has(paste.token) && actual.url) {
      const body = Buffer.from(await (await fetch(actual.url)).arrayBuffer());
      if (!body.equals(bytes))
        note(
          paste,
          "bytes",
          `${bytes.byteLength} bytes`,
          `${body.byteLength} bytes, differing`,
        );
    }

    checked++;
  }
  process.stdout.write(`\r${checked}/${pastes.length} checked`);
}
process.stdout.write("\n");

// The other direction: rows in Convex that the export never mentioned. A
// per-record comparison is blind to these, and after a partial re-run they are
// exactly what an operator wants to see.
const sourceTokens = new Set(pastes.map((paste) => paste.token));
const extras = [];
let migratedCount = 0;
let cursor = null;
for (;;) {
  const page = runConvex("migrate:listTokens", { cursor }, options);
  migratedCount += page.tokens.length;
  for (const token of page.tokens)
    if (!sourceTokens.has(token)) extras.push(token);
  if (page.isDone) break;
  cursor = page.cursor;
}

const report = {
  generatedAt: Date.now(),
  deployment: options.prod ? "prod" : "dev",
  sourcePastes: pastes.length,
  migratedPastes: migratedCount,
  sampled: sampled.size,
  extras,
  discrepancies,
  byKind: discrepancies.reduce(
    (acc, item) => ({ ...acc, [item.kind]: (acc[item.kind] ?? 0) + 1 }),
    {},
  ),
};
const file = path.join(dir, "discrepancy-report.json");
writeFileSync(file, JSON.stringify(report, null, 2));

console.log(
  `source ${pastes.length} / migrated ${migratedCount} — ${discrepancies.length} discrepancies, ${extras.length} unexpected rows`,
);
console.log(report.byKind);
console.log(`report: ${file}`);
process.exit(discrepancies.length || extras.length ? 1 : 0);
