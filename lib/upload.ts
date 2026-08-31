// Browser publishing flow: the HTML goes straight from the browser to Convex
// File Storage, so it never passes through a Vercel function.
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppError } from "./errors";
import { asHtmlFile } from "./markdown";
import { pasteUrls } from "./urls";
import { MAX_UPLOAD_BYTES } from "@/convex/lib/validation";

/**
 * Anything that can run a Convex mutation. Both `ConvexReactClient` (the
 * browser) and `ConvexHttpClient` (the REST API, server-side) satisfy it, so
 * the publish flow below is shared rather than written twice.
 */
export type Mutator = {
  mutation<M extends FunctionReference<"mutation">>(
    reference: M,
    args: FunctionArgs<M>,
  ): Promise<FunctionReturnType<M>>;
};

export type PublishOptions = {
  title?: string;
  description?: string;
  customSubdomain?: string;
  folderId?: Id<"folders">;
  /** API-key credential, when publishing on behalf of an automation. */
  apiKey?: string;
};

/** The create-paste response contract, shared by every publishing surface. */
export type PublishResult = {
  pasteId: string;
  token: string;
  publicUrl: string;
  rawUrl: string;
  /** Anonymous pastes only, and only ever returned here. */
  updateToken?: string;
};

/** Uploads one file and returns its Convex storage id. */
export async function uploadFile(
  convex: Mutator,
  file: File | Blob,
): Promise<Id<"_storage">> {
  if (file.size === 0) throw new AppError("VALIDATION", "File is empty.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new AppError(
      "PAYLOAD_TOO_LARGE",
      `File must be at most ${MAX_UPLOAD_BYTES} bytes.`,
    );

  const uploadUrl = await convex.mutation(api.storage.generateUploadUrl, {});
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "text/html" },
    body: file,
  });
  if (!response.ok)
    throw new AppError("INTERNAL", `Upload failed (${response.status}).`);

  const { storageId } = (await response.json()) as {
    storageId?: Id<"_storage">;
  };
  if (!storageId) throw new AppError("INTERNAL", "Upload returned no file id.");
  return storageId;
}

/**
 * Uploads HTML and creates the paste that points at it. If the create fails the
 * uploaded bytes are simply left unreferenced; `storage.sweepOrphans` reclaims
 * them, so there is nothing to unwind here.
 *
 * A Markdown file is rendered to HTML first (see `lib/markdown.ts`), which is
 * why this and `replaceHtml` are the only two places that had to learn about
 * Markdown at all: every publishing surface goes through one of them.
 */
export async function publishHtml(
  convex: Mutator,
  input: File,
  options: PublishOptions = {},
): Promise<PublishResult> {
  const file = await asHtmlFile(input);
  const storageId = await uploadFile(convex, file);
  const created = await convex.mutation(api.pastes.create, {
    storageId,
    filename: file.name || "index.html",
    contentType: file.type || "text/html",
    ...options,
  });
  return { ...created, ...pasteUrls(created.token) };
}

/**
 * Replaces a paste's HTML. The new file is uploaded first; `pastes.replaceContent`
 * only drops the old one once the new storage id is committed.
 */
export async function replaceHtml(
  convex: Mutator,
  input: File,
  paste: { token: string; updateToken?: string; apiKey?: string },
): Promise<void> {
  const file = await asHtmlFile(input);
  const storageId = await uploadFile(convex, file);
  await convex.mutation(api.pastes.replaceContent, {
    ...paste,
    storageId,
    contentType: file.type || "text/html",
    filename: file.name || undefined,
  });
}
