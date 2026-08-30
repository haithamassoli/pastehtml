// One-time import of the legacy Rails export. Nothing in this file runs during
// normal operation: every function is internal, so it is reachable only with a
// deploy key (`npx convex run internal.migrate.…`), never from a browser or an
// API key. It stays in the tree after cutover because a migration you cannot
// re-run is a migration you cannot verify.
//
// The contract this file consumes is `docs/migration.md`. The bytes never come
// through here — the driver uploads them to File Storage first and passes the
// resulting `storageId`, exactly as the browser does when a visitor publishes.
// That keeps a 5 MB paste out of a Convex function argument and reuses
// `describeUpload` for the size and content-type rules, so a migrated paste can
// never be one the app itself would have refused.
//
// ponytail: no `@convex-dev/migrations`. That component exists to backfill rows
// that already live in a table across many transactions; this is an insert of
// rows that do not exist yet, driven from a file outside Convex, and the resume
// story here is the `by_token` index rather than a cursor the component holds.
import { ConvexError, v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { hashPassword } from "./lib/password";
import { randomString, sha256Hex } from "./lib/tokens";
import { deleteFile, describeUpload, requireUnreferenced } from "./storage";
import {
  fail,
  validateCustomSubdomain,
  validateDescription,
  validateFilename,
  validateFolderName,
  validateTitle,
} from "./lib/validation";

/**
 * A legacy folder, with its owner already resolved to a Clerk
 * `tokenIdentifier` by the driver — Convex has no way to look a legacy user id
 * up, and inventing a mapping here would put half of it in two places.
 */
export const folderRecord = v.object({
  legacyId: v.string(),
  ownerId: v.string(),
  name: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/** A legacy paste, likewise pre-resolved: owner, folder and uploaded bytes. */
export const pasteRecord = v.object({
  legacyId: v.string(),
  token: v.string(),
  // Absent for an anonymous paste, and also for one whose legacy owner could
  // not be resolved to a Clerk identity — see `docs/migration.md`.
  ownerId: v.optional(v.string()),
  folderId: v.optional(v.id("folders")),
  storageId: v.id("_storage"),

  filename: v.string(),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  customSubdomain: v.optional(v.string()),
  contentType: v.string(),

  visibility: v.union(v.literal("public"), v.literal("protected")),
  // Only ever set when the legacy store held a recoverable password. A bcrypt
  // digest cannot be converted, so the usual case is `protected` with no
  // password at all; see `lockedHash` below.
  password: v.optional(v.string()),
  // The anonymous management secret, raw. Present only if the legacy app kept
  // it recoverably; otherwise the migrated paste has no management credential.
  updateToken: v.optional(v.string()),

  viewsCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const statusValidator = v.union(
  v.literal("imported"),
  v.literal("skipped"),
  v.literal("failed"),
);

/**
 * Rejects a token the serving layer could never find. `resolveForRuntime`
 * lowercases what it is given before looking up either a custom subdomain or a
 * token, so a stored token carrying an uppercase letter answers on `/p/…` and
 * nowhere else — the wildcard host and the raw endpoint would both 404. A
 * legacy alphabet that is not already a DNS label has to be decided on before
 * the migration, not silently mangled during it.
 */
function legacyToken(token: string): string {
  const value = token.trim();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(value))
    fail(
      "VALIDATION",
      `Token "${token}" is not a lowercase DNS label, so no wildcard or raw URL could serve it.`,
    );
  return value;
}

/**
 * Catches the classic export bug — Rails hands out seconds, this schema stores
 * milliseconds — before it files the entire archive under January 1970. Any
 * real pastehtml record postdates 2000.
 */
const EPOCH_FLOOR = Date.UTC(2000, 0, 1);

function legacyTimestamp(value: number, field: string): number {
  if (!Number.isFinite(value) || value < EPOCH_FLOOR)
    fail(
      "VALIDATION",
      `${field} (${value}) is before 2000 — the export is probably emitting seconds, not milliseconds.`,
    );
  return Math.floor(value);
}

/**
 * `pastes.claimSubdomain` is private to that module, so the rule is restated
 * here rather than widening its API for a one-off. Same validation, same
 * uniqueness read inside the writing transaction, so two legacy rows claiming
 * one name cannot both land.
 */
async function claimSubdomain(ctx: QueryCtx, subdomain: string) {
  const value = validateCustomSubdomain(subdomain);
  const existing = await ctx.db
    .query("pastes")
    .withIndex("by_custom_subdomain", (q) => q.eq("customSubdomain", value))
    .unique();
  if (existing) fail("CONFLICT", `"${value}" is already taken.`);
  return value;
}

/**
 * The password for a protected paste whose legacy digest could not come with
 * it. A fresh 32-character secret is hashed and then dropped on the floor, so
 * the paste stays closed to everyone — including us — until its owner sets a
 * new password. Failing closed is the only safe direction: the alternative is
 * publishing content whose author chose not to publish it.
 */
const lockedHash = () => hashPassword(randomString(32));

/** Folder identity is `(ownerId, name)`; the legacy id has nowhere to live. */
async function findFolder(ctx: QueryCtx, ownerId: string, name: string) {
  // ponytail: bounded at the same 500 `folders.list` caps itself at. An owner
  // past that would get duplicate folders on re-import, which is a problem the
  // dashboard would have long before the migration does.
  const owned = await ctx.db
    .query("folders")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .take(500);
  return owned.find((folder) => folder.name === name) ?? null;
}

export const importFolder = internalMutation({
  args: folderRecord.fields,
  returns: v.object({
    folderId: v.id("folders"),
    status: statusValidator,
  }),
  handler: async (ctx, args) => {
    const name = validateFolderName(args.name);
    const existing = await findFolder(ctx, args.ownerId, name);
    if (existing) return { folderId: existing._id, status: "skipped" as const };

    const folderId = await ctx.db.insert("folders", {
      ownerId: args.ownerId,
      name,
      createdAt: legacyTimestamp(args.createdAt, "createdAt"),
      updatedAt: legacyTimestamp(args.updatedAt, "updatedAt"),
    });
    return { folderId, status: "imported" as const };
  },
});

/**
 * Imports one paste, or recognises one already imported. The public token is
 * the idempotency key: it is unique by index, it is what the whole migration
 * exists to preserve, and it means a re-run needs no bookkeeping table and no
 * extra column on `pastes`.
 *
 * A second run over a record that already landed converges rather than
 * duplicating — it fills in an owner or a folder the first run could not
 * resolve, and touches nothing that is already set. That is what makes the
 * "fix the mapping file and run it again" loop work.
 */
export const importPaste = internalMutation({
  args: pasteRecord.fields,
  returns: v.object({ pasteId: v.id("pastes"), status: statusValidator }),
  handler: async (ctx, args) => {
    const token = legacyToken(args.token);
    const createdAt = legacyTimestamp(args.createdAt, "createdAt");
    const updatedAt = legacyTimestamp(args.updatedAt, "updatedAt");

    // A folder always belongs to the paste's owner. Checked before the
    // early-out too, so a bad mapping can never be patched in on a re-run.
    if (args.folderId !== undefined) {
      const folder = await ctx.db.get("folders", args.folderId);
      if (!folder || folder.ownerId !== args.ownerId)
        fail("FORBIDDEN", "Folder belongs to a different owner.");
    }

    const existing = await ctx.db
      .query("pastes")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (existing) {
      const patch: Partial<Doc<"pastes">> = {};
      if (!existing.ownerId && args.ownerId) patch.ownerId = args.ownerId;
      if (!existing.folderId && args.folderId) patch.folderId = args.folderId;
      if (Object.keys(patch).length)
        await ctx.db.patch("pastes", existing._id, patch);
      return { pasteId: existing._id, status: "skipped" as const };
    }

    await requireUnreferenced(ctx, args.storageId);
    const upload = await describeUpload(ctx, args.storageId, args.contentType);

    const pasteId = await ctx.db.insert("pastes", {
      token,
      ownerId: args.ownerId,
      folderId: args.folderId,
      storageId: args.storageId,
      filename: validateFilename(args.filename),
      title: args.title === undefined ? undefined : validateTitle(args.title),
      description:
        args.description === undefined
          ? undefined
          : validateDescription(args.description),
      customSubdomain:
        args.customSubdomain === undefined
          ? undefined
          : await claimSubdomain(ctx, args.customSubdomain),
      contentType: upload.contentType,
      contentLength: upload.contentLength,
      // `validatePassword` is deliberately not applied: a legacy password
      // shorter than today's minimum is still the password its author chose,
      // and refusing it would break the paste rather than protect anyone.
      passwordHash:
        args.visibility === "protected"
          ? await (args.password === undefined
              ? lockedHash()
              : hashPassword(args.password))
          : undefined,
      // An owned paste has no update token by construction — `claim` retires
      // it — so a legacy secret on an owned row is dropped, not carried.
      updateTokenHash:
        args.ownerId || args.updateToken === undefined
          ? undefined
          : await sha256Hex(args.updateToken),
      visibility: args.visibility,
      viewsCount: Math.max(0, Math.floor(args.viewsCount)),
      createdAt,
      updatedAt,
    });
    return { pasteId, status: "imported" as const };
  },
});

const batchResult = v.object({
  kind: v.union(v.literal("folder"), v.literal("paste")),
  legacyId: v.string(),
  status: statusValidator,
  /** The Convex id of the row, so the driver can map legacy folder ids. */
  id: v.optional(v.string()),
  error: v.optional(v.string()),
});

/**
 * One batch of the migration. An action rather than a mutation because a failed
 * record must not take the batch down with it: each `runMutation` below is a
 * subtransaction, so a rejected record rolls back alone and the loop keeps
 * going. The caller gets a per-record verdict instead of a stack trace and a
 * half-finished run.
 *
 * Folders come first within a batch only as a convenience for a caller that
 * sends both; the driver sends every folder in one batch before any paste,
 * because a paste's `folderId` has to exist before it can be referenced.
 */
export const importBatch = internalAction({
  args: {
    folders: v.array(folderRecord),
    pastes: v.array(pasteRecord),
  },
  returns: v.array(batchResult),
  handler: async (ctx, args) => {
    const results: Array<typeof batchResult.type> = [];

    const record = async (
      kind: "folder" | "paste",
      legacyId: string,
      run: () => Promise<{ id: string; status: typeof statusValidator.type }>,
    ) => {
      try {
        const { id, status } = await run();
        results.push({ kind, legacyId, status, id });
      } catch (error) {
        // The stable code plus the message, so a discrepancy report can be
        // grouped by cause without the operator reading every line.
        const data =
          error instanceof ConvexError
            ? (error.data as { code?: string; message?: string })
            : null;
        results.push({
          kind,
          legacyId,
          status: "failed" as const,
          error: data
            ? `${data.code}: ${data.message}`
            : String(error instanceof Error ? error.message : error),
        });
      }
    };

    for (const folder of args.folders)
      await record("folder", folder.legacyId, async () => {
        const out = await ctx.runMutation(
          internal.migrate.importFolder,
          folder,
        );
        return { id: out.folderId, status: out.status };
      });

    for (const paste of args.pastes)
      await record("paste", paste.legacyId, async () => {
        const out = await ctx.runMutation(internal.migrate.importPaste, paste);
        return { id: out.pasteId, status: out.status };
      });

    return results;
  },
});

/**
 * Everything the validation script compares a source record against, in one
 * round trip per chunk. `url` is a signed storage URL so the script can pull
 * the bytes back down and diff them against the export; `sha256` is Convex's
 * own hex digest of what it stored.
 */
export const inspect = internalQuery({
  args: { tokens: v.array(v.string()) },
  returns: v.array(
    v.union(
      v.null(),
      v.object({
        token: v.string(),
        ownerId: v.optional(v.string()),
        folderName: v.optional(v.string()),
        folderOwnerId: v.optional(v.string()),
        customSubdomain: v.optional(v.string()),
        filename: v.string(),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        visibility: v.union(v.literal("public"), v.literal("protected")),
        hasPassword: v.boolean(),
        hasUpdateToken: v.boolean(),
        viewsCount: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
        contentType: v.string(),
        contentLength: v.number(),
        sha256: v.string(),
        url: v.union(v.string(), v.null()),
      }),
    ),
  ),
  handler: async (ctx, args) => {
    if (args.tokens.length > 200)
      fail("VALIDATION", "At most 200 tokens per inspect call.");

    return await Promise.all(
      args.tokens.map(async (token) => {
        const paste = await ctx.db
          .query("pastes")
          .withIndex("by_token", (q) => q.eq("token", token))
          .unique();
        if (!paste) return null;
        const folder = paste.folderId
          ? await ctx.db.get("folders", paste.folderId)
          : null;
        const metadata = await ctx.db.system.get("_storage", paste.storageId);
        return {
          token: paste.token,
          ownerId: paste.ownerId,
          folderName: folder?.name,
          folderOwnerId: folder?.ownerId,
          customSubdomain: paste.customSubdomain,
          filename: paste.filename,
          title: paste.title,
          description: paste.description,
          visibility: paste.visibility,
          hasPassword: paste.passwordHash !== undefined,
          hasUpdateToken: paste.updateTokenHash !== undefined,
          viewsCount: paste.viewsCount,
          createdAt: paste.createdAt,
          updatedAt: paste.updatedAt,
          contentType: paste.contentType,
          contentLength: paste.contentLength,
          sha256: metadata?.sha256 ?? "",
          url: await ctx.storage.getUrl(paste.storageId),
        };
      }),
    );
  },
});

/**
 * Every token in the deployment, a page at a time. The validation script walks
 * this to count what landed and to spot rows that are in Convex but not in the
 * export — the direction a per-record comparison cannot see.
 */
export const listTokens = internalQuery({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    tokens: v.array(v.string()),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("pastes")
      .paginate({ cursor: args.cursor ?? null, numItems: 500 });
    return {
      tokens: page.page.map((paste) => paste.token),
      cursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Undoes an import, by token. The real production rollback is DNS — Rails keeps
 * serving and nothing about it was touched — but a staging rehearsal you cannot
 * reset is a rehearsal you get to run once, and "repeat until clean" needs it
 * more than once. Folders are left in place: they are idempotent to re-import
 * and deleting them would take their non-migrated pastes' filing with them.
 */
export const rollback = internalMutation({
  args: { tokens: v.array(v.string()) },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const token of args.tokens) {
      const paste = await ctx.db
        .query("pastes")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (!paste) continue;
      await ctx.db.delete("pastes", paste._id);
      await deleteFile(ctx, paste.storageId);
      deleted++;
    }
    return { deleted };
  },
});
