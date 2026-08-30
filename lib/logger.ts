// Structured application logger. Emits one JSON line per event to stdout/stderr
// and redacts sensitive fields so credentials never reach logs.
// ponytail: console-based; swap for pino if we need transports/sampling.

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

// Matched against field *names*. Every credential this codebase holds is named
// after one of these: `apiKey`, `updateToken`, `unlockToken`, `password`,
// `Authorization`, `Cookie`. `hash` covers `passwordHash` and `keyHash` — a
// digest is not a secret, but it is what a leaked log would be attacked with,
// and nothing benign here is named for one (the paste digest is `sha256`).
const REDACT =
  /(password|token|secret|apikey|api_key|authorization|cookie|hash)/i;

// The one credential that also travels inside strings, where no field name
// gives it away: an API key pasted into an error message, a URL or a stack.
const API_KEY = /\bph_[A-Za-z0-9_-]{6,}/g;

function scrub(text: string): string {
  return text.replace(API_KEY, "ph_[REDACTED]");
}

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields))
    out[k] = REDACT.test(k) ? "[REDACTED]" : clean(v);
  return out;
}

function clean(value: unknown): unknown {
  if (typeof value === "string") return scrub(value);
  // `message` and `stack` are non-enumerable, so an Error walked as a plain
  // object serializes to `{}` — losing exactly the thing we log it for. The
  // spread keeps whatever else was attached (a `ConvexError`'s `data`).
  if (value instanceof Error)
    return {
      name: value.name,
      message: scrub(value.message),
      stack: value.stack && scrub(value.stack),
      ...redact({ ...value }),
    };
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return redact(value as Fields);
  return value;
}

function emit(level: Level, msg: string, fields: Fields = {}) {
  const line = JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    ...redact(fields),
  });
  (level === "error" || level === "warn" ? console.error : console.log)(line);
}

export const logger = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
  // Bind a request/correlation id onto every subsequent log.
  child: (bound: Fields) => ({
    debug: (m: string, f?: Fields) => emit("debug", m, { ...bound, ...f }),
    info: (m: string, f?: Fields) => emit("info", m, { ...bound, ...f }),
    warn: (m: string, f?: Fields) => emit("warn", m, { ...bound, ...f }),
    error: (m: string, f?: Fields) => emit("error", m, { ...bound, ...f }),
  }),
};

export { redact, redact as _redactForTest };
