// Browser publishing flow: the HTML goes straight from the browser to Convex
// File Storage, so it never passes through a Vercel function.
import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppError } from "./errors";
import { pasteUrls } from "./urls";
import { MAX_UPLOAD_BYTES } from "@/convex/lib/validation";

export type PublishOptions = {
  title?: string;
  description?: string;
  customSubdomain?: string;
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
  convex: ConvexReactClient,
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
 */
export async function publishHtml(
  convex: ConvexReactClient,
  file: File,
  options: PublishOptions = {},
): Promise<PublishResult> {
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
  convex: ConvexReactClient,
  file: File,
  paste: { token: string; updateToken?: string },
): Promise<void> {
  const storageId = await uploadFile(convex, file);
  await convex.mutation(api.pastes.replaceContent, {
    ...paste,
    storageId,
    contentType: file.type || "text/html",
    filename: file.name || undefined,
  });
}
