import { ConvexError } from "convex/values";
import { SCOPES, type Scope } from "../schema";

// Limits shared by Convex functions and the Next.js layer (see lib/config.ts).
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_FILENAME_LENGTH = 255;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_FOLDER_NAME_LENGTH = 100;
export const SUBDOMAIN_MIN_LENGTH = 3;
export const SUBDOMAIN_MAX_LENGTH = 63;

// Configurable reserved list — subdomains the app itself owns.
// `clerk`, `accounts` and `clkmail` are Clerk's production CNAMEs under the
// app host: handing one to a paste would let user HTML answer on a sign-in
// origin the moment DNS ever moved.
export const RESERVED_SUBDOMAINS: readonly string[] = [
  "www",
  "api",
  "app",
  "admin",
  "status",
  "docs",
  "mcp",
  "mail",
  "support",
  "clerk",
  "accounts",
  "clkmail",
];

const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain"];

/** Mirrors `ErrorCode` in lib/errors.ts; Convex can't import that module. */
export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

const invalid = (message: string) => fail("VALIDATION", message);

export function validateFilename(filename: string): string {
  const value = filename.trim();
  if (!value) invalid("Filename is required.");
  if (value.length > MAX_FILENAME_LENGTH)
    invalid(`Filename must be at most ${MAX_FILENAME_LENGTH} characters.`);
  // Path separators and control chars would break Content-Disposition headers.
  if (/[/\\]|[\u0000-\u001f\u007f]/.test(value))
    invalid("Filename contains invalid characters.");
  return value;
}

export function validateTitle(title: string): string {
  const value = title.trim();
  if (value.length > MAX_TITLE_LENGTH)
    invalid(`Title must be at most ${MAX_TITLE_LENGTH} characters.`);
  return value;
}

export function validateDescription(description: string): string {
  const value = description.trim();
  if (value.length > MAX_DESCRIPTION_LENGTH)
    invalid(
      `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
    );
  return value;
}

export function validateFolderName(name: string): string {
  const value = name.trim();
  if (!value) invalid("Folder name is required.");
  if (value.length > MAX_FOLDER_NAME_LENGTH)
    invalid(
      `Folder name must be at most ${MAX_FOLDER_NAME_LENGTH} characters.`,
    );
  return value;
}

/** Normalizes to lowercase and enforces the DNS-label + reserved-name rules. */
export function validateCustomSubdomain(subdomain: string): string {
  const value = subdomain.trim().toLowerCase();
  if (
    value.length < SUBDOMAIN_MIN_LENGTH ||
    value.length > SUBDOMAIN_MAX_LENGTH
  )
    invalid(
      `Subdomain must be ${SUBDOMAIN_MIN_LENGTH}-${SUBDOMAIN_MAX_LENGTH} characters.`,
    );
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value))
    invalid(
      "Subdomain may only contain lowercase letters, digits and hyphens, and cannot start or end with a hyphen.",
    );
  if (RESERVED_SUBDOMAINS.includes(value))
    fail("CONFLICT", `"${value}" is reserved.`);
  return value;
}

export function validateContentLength(contentLength: number): number {
  if (!Number.isInteger(contentLength) || contentLength <= 0)
    invalid("Content must not be empty.");
  if (contentLength > MAX_UPLOAD_BYTES)
    fail(
      "PAYLOAD_TOO_LARGE",
      `Content must be at most ${MAX_UPLOAD_BYTES} bytes.`,
    );
  return contentLength;
}

/** Accepts parameterized types such as `text/html; charset=utf-8`. */
export function validateContentType(contentType: string): string {
  const value = contentType.trim().toLowerCase();
  const essence = value.split(";")[0].trim();
  if (!ALLOWED_CONTENT_TYPES.includes(essence))
    fail("UNSUPPORTED_MEDIA_TYPE", `Unsupported content type: ${essence}`);
  return value;
}

export function validateScopes(scopes: readonly string[]): Scope[] {
  if (scopes.length === 0) invalid("At least one scope is required.");
  for (const scope of scopes) {
    if (!SCOPES.includes(scope as Scope)) invalid(`Unknown scope: ${scope}`);
  }
  return [...new Set(scopes)] as Scope[];
}
