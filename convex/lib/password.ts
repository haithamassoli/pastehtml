// Paste passwords. PBKDF2-HMAC-SHA256 through Web Crypto, which the Convex V8
// runtime provides natively — argon2id or bcrypt would mean a WASM/native
// dependency and a `"use node"` action hop on every unlock attempt. PBKDF2 is
// the strongest memory-hard-less KDF the runtime already has.
//
// ponytail: iterations are the whole knob, and they are capped by Convex's
// per-transaction budget rather than by policy. If passwords ever guard
// something valuable enough, move hashing into a Node action and switch to
// argon2id; the stored string is self-describing, so both can coexist.
import { fail } from "./validation";
import { timingSafeEqual } from "./tokens";

const ALGORITHM = "pbkdf2-sha256";
const ITERATIONS = 100_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

const hex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BITS,
  );
  return hex(new Uint8Array(bits));
}

/** Rejects a password that is too short or too long. Never logs the value. */
export function validatePassword(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH)
    fail(
      "VALIDATION",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  if (password.length > MAX_PASSWORD_LENGTH)
    fail(
      "VALIDATION",
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`,
    );
  return password;
}

/**
 * `pbkdf2-sha256$<iterations>$<saltHex>$<hashHex>` — self-describing, so the
 * cost can be raised later without invalidating existing passwords. The
 * plaintext is never stored, and never leaves the mutation that hashes it.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const digest = await derive(password, salt, ITERATIONS);
  return `${ALGORITHM}$${ITERATIONS}$${hex(salt)}$${digest}`;
}

/** Constant-time comparison, so a wrong guess leaks nothing about the digest. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, iterations, saltHex, digest] = stored.split("$");
  if (algorithm !== ALGORITHM || !saltHex || !digest) return false;

  const rounds = Number(iterations);
  if (!Number.isInteger(rounds) || rounds <= 0) return false;

  const salt = saltHex.match(/../g);
  if (!salt || salt.length * 2 !== saltHex.length) return false;

  const candidate = await derive(
    password,
    Uint8Array.from(salt, (byte) => parseInt(byte, 16)),
    rounds,
  );
  return timingSafeEqual(candidate, digest);
}
