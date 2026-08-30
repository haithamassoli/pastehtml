// Structured application logger. Emits one JSON line per event to stdout/stderr
// and redacts sensitive fields so credentials never reach logs.
// ponytail: console-based; swap for pino if we need transports/sampling.

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const REDACT = /(password|token|secret|apikey|api_key|authorization|cookie)/i;

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT.test(k)) out[k] = "[REDACTED]";
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redact(v as Fields);
    } else out[k] = v;
  }
  return out;
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

export { redact as _redactForTest };
