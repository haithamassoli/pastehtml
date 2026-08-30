#!/usr/bin/env node
// Imports a legacy export directory into Convex.
//
//   node scripts/migrate-import.mjs ./export            # dev deployment
//   node scripts/migrate-import.mjs ./export --prod     # production
//   node scripts/migrate-import.mjs ./export --rollback # undo the above
//
// Safe to interrupt and safe to re-run: the paste token is the idempotency key,
// so a record already in Convex is skipped without re-uploading its bytes. A
// record that fails is reported and the run continues — read
// `<export>/import-report.json` afterwards, fix those rows, and run it again.
//
// The bytes go straight to File Storage over the signed upload URL, the same
// path a browser takes when someone publishes; only small metadata travels
// through `npx convex run`, which is what keeps a 5 MB paste out of argv.
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

// Small enough that a batch's metadata fits comfortably in a command line, big
// enough that the per-batch process spawn is not the migration's bottleneck.
const BATCH = 25;

const { positional, flags } = parseArgs(process.argv.slice(2));
const dir = positional[0];
if (!dir) {
  console.error(
    "usage: node scripts/migrate-import.mjs <export-dir> [--prod] [--rollback]",
  );
  process.exit(2);
}
const prod = Boolean(flags.prod);
const options = { prod };

const { manifest, owners, folders, pastes } = readExport(dir);
const client = new ConvexHttpClient(convexUrl());
const startedAt = Date.now();

if (flags.rollback) {
  let deleted = 0;
  for (const batch of chunk(pastes, 500))
    deleted += runConvex(
      "migrate:rollback",
      { tokens: batch.map((paste) => paste.token) },
      options,
    ).deleted;
  console.log(`rolled back ${deleted} pastes in ${Date.now() - startedAt}ms`);
  process.exit(0);
}

console.log(
  `importing ${manifest.counts?.pastes ?? pastes.length} pastes from ${manifest.source ?? dir} into ${prod ? "production" : "dev"}`,
);

// --- Folders first: a paste cannot reference a folder that does not exist yet.
const results = [];
const skippedFolders = [];
const folderRecords = [];
for (const folder of folders) {
  const ownerId = owners[folder.legacyOwnerId];
  // A folder needs an owner — the schema has no anonymous folder — so one whose
  // user never made it to Clerk is dropped and its pastes import unfiled.
  if (!ownerId) {
    skippedFolders.push(folder.legacyId);
    continue;
  }
  folderRecords.push({
    legacyId: folder.legacyId,
    ownerId,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  });
}

const folderIds = new Map();
if (folderRecords.length) {
  const folderResults = runConvex(
    "migrate:importBatch",
    { folders: folderRecords, pastes: [] },
    options,
  );
  for (const result of folderResults) {
    if (result.id) folderIds.set(result.legacyId, result.id);
    results.push(result);
  }
}

// --- Pastes.
async function upload(paste) {
  const bytes = Buffer.from(paste.contentBase64, "base64");
  // Proves the transfer before it costs an upload: if the export's own digest
  // does not match its own payload, nothing downstream can be trusted.
  if (paste.sha256 && !digests(bytes).includes(paste.sha256))
    throw new Error(`content does not match the declared sha256`);
  const url = await client.mutation(
    makeFunctionReference("storage:generateUploadUrl"),
    {},
  );
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": paste.contentType },
    body: bytes,
  });
  if (!response.ok)
    throw new Error(`upload failed with HTTP ${response.status}`);
  return (await response.json()).storageId;
}

let done = 0;
for (const batch of chunk(pastes, BATCH)) {
  // Ask first, so a resumed run does not upload bytes it is about to skip —
  // those would sit in storage until `storage.sweepOrphans` collected them.
  const existing = runConvex(
    "migrate:inspect",
    { tokens: batch.map((paste) => paste.token) },
    options,
  );

  const pending = [];
  batch.forEach((paste, index) => {
    if (existing[index])
      results.push({
        kind: "paste",
        legacyId: paste.legacyId,
        status: "skipped",
      });
    else pending.push(paste);
  });

  const records = [];
  await Promise.all(
    pending.map(async (paste) => {
      const ownerId = paste.legacyOwnerId
        ? owners[paste.legacyOwnerId]
        : undefined;
      try {
        records.push({
          legacyId: paste.legacyId,
          token: paste.token,
          ownerId,
          // Unfiled when the owner is unresolved: the folder belongs to an
          // account this paste no longer has.
          folderId:
            ownerId && paste.legacyFolderId
              ? folderIds.get(paste.legacyFolderId)
              : undefined,
          storageId: await upload(paste),
          filename: paste.filename,
          title: paste.title,
          description: paste.description,
          customSubdomain: paste.customSubdomain,
          contentType: paste.contentType,
          visibility: paste.visibility,
          password: paste.password,
          updateToken: paste.updateToken,
          viewsCount: paste.viewsCount ?? 0,
          createdAt: paste.createdAt,
          updatedAt: paste.updatedAt,
        });
      } catch (error) {
        results.push({
          kind: "paste",
          legacyId: paste.legacyId,
          status: "failed",
          error: String(error.message ?? error),
        });
      }
    }),
  );

  if (records.length)
    results.push(
      ...runConvex(
        "migrate:importBatch",
        { folders: [], pastes: records },
        options,
      ),
    );

  done += batch.length;
  process.stdout.write(`\r${done}/${pastes.length} pastes`);
}
process.stdout.write("\n");

const counts = results.reduce(
  (acc, result) => ({ ...acc, [result.status]: (acc[result.status] ?? 0) + 1 }),
  {},
);
const report = {
  startedAt,
  finishedAt: Date.now(),
  durationMs: Date.now() - startedAt,
  deployment: prod ? "prod" : "dev",
  source: manifest.source ?? dir,
  counts,
  skippedFolders,
  failures: results.filter((result) => result.status === "failed"),
};
writeFileSync(
  path.join(dir, "import-report.json"),
  JSON.stringify(report, null, 2),
);

console.log(
  `${counts.imported ?? 0} imported, ${counts.skipped ?? 0} already present, ${counts.failed ?? 0} failed in ${report.durationMs}ms`,
);
if (skippedFolders.length)
  console.log(
    `${skippedFolders.length} folders skipped: owner not in owners.json`,
  );
console.log(`report: ${path.join(dir, "import-report.json")}`);
process.exit(report.failures.length ? 1 : 0);
