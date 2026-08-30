// Shared plumbing for the two migration drivers. Plain `.mjs` on purpose: these
// run on an operator's laptop against production, and adding a TypeScript
// runner to the dependency tree for two ops scripts is a worse trade than
// giving up type checking on them. Nothing here imports from `convex/` — the
// contract between the scripts and the backend is the JSON in
// `docs/migration.md`, not a shared type.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

/**
 * Runs a Convex function with the deploy key the CLI already holds. A client
 * library cannot call `internal.*` functions — that is the whole point of them —
 * so the CLI is the transport. It writes logs to stderr and the return value to
 * stdout as JSON when stdout is not a TTY, which is exactly the case here.
 */
export function runConvex(functionName, args, { prod = false } = {}) {
  const result = spawnSync(
    "npx",
    [
      "convex",
      "run",
      functionName,
      JSON.stringify(args),
      ...(prod ? ["--prod"] : []),
    ],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  if (result.status !== 0)
    throw new Error(
      `npx convex run ${functionName} failed:\n${result.stderr ?? ""}`,
    );
  return JSON.parse(result.stdout);
}

/** `KEY=value` out of `.env.local`, so the driver needs no extra setup. */
function envFile(root) {
  try {
    return Object.fromEntries(
      readFileSync(path.join(root, ".env.local"), "utf8")
        .split("\n")
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
        .filter(Boolean)
        .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, "")]),
    );
  } catch {
    return {};
  }
}

export function convexUrl(root = process.cwd()) {
  const env = { ...envFile(root), ...process.env };
  const url = env.CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL;
  if (!url)
    throw new Error(
      "Set CONVEX_URL (or NEXT_PUBLIC_CONVEX_URL) to the deployment being migrated.",
    );
  return url;
}

export const readJsonl = (file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${file}:${index + 1} is not valid JSON — ${error}`);
      }
    });

/** The four files `docs/migration.md` specifies, read as one object. */
export function readExport(dir) {
  const json = (name) => JSON.parse(readFileSync(path.join(dir, name), "utf8"));
  return {
    manifest: json("manifest.json"),
    owners: json("owners.json"),
    folders: readJsonl(path.join(dir, "folders.jsonl")),
    pastes: readJsonl(path.join(dir, "pastes.jsonl")),
  };
}

export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

/**
 * The two spellings of one SHA-256. Convex's stored digest is documented as hex
 * and rendered base64 by `convex-test`, and a byte-fidelity check that pins one
 * encoding is a check that reports a false discrepancy on the deployment where
 * it guessed wrong. The digest is the same either way.
 */
export function digests(bytes) {
  const hash = createHash("sha256").update(bytes).digest();
  return [hash.toString("hex"), hash.toString("base64")];
}

export function parseArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const flags = Object.fromEntries(
    argv
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => {
        const [key, value] = arg.slice(2).split("=");
        return [key, value ?? true];
      }),
  );
  return { positional, flags };
}
