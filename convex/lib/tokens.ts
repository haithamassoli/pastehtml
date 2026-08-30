// Public paste tokens and anonymous update tokens. Only hashes of update tokens
// are ever persisted; the raw value is returned to the caller exactly once.

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export const PASTE_TOKEN_LENGTH = 12;
export const UPDATE_TOKEN_LENGTH = 32;

/** Unbiased random string: bytes past the largest whole multiple are rejected. */
export function randomString(length: number): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export const generatePasteToken = () => randomString(PASTE_TOKEN_LENGTH);
export const generateUpdateToken = () => randomString(UPDATE_TOKEN_LENGTH);

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time equality so hash comparison leaks no prefix information. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
