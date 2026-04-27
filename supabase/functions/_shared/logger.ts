/**
 * @fileoverview Structured JSON logger for edge functions.
 *
 * Why this exists: Deno's `console.log` writes unstructured strings, which
 * makes Supabase log search painful (regex, false positives, no faceting).
 * A consistent JSON shape lets us filter by `fn`, `stage`, `request_id`,
 * `level`, and `latency_ms` directly in the dashboard, and gives us a
 * stable contract if we ever ship logs to an external sink.
 *
 * Design choices:
 *   - Zero dependencies (cold-start budget matters).
 *   - One log line = one JSON object on stdout/stderr (Supabase's collector
 *     already line-splits, so this is the cheapest path to structured logs).
 *   - `request_id` propagation is opt-in via `createLogger({ requestId })` so
 *     callers don't have to thread it through every helper. If the caller
 *     omits it we generate one (crypto.randomUUID — same primitive Deno uses).
 *   - Errors are normalised: `Error` instances get { name, message, stack };
 *     unknown values get JSON.stringified safely (circular refs → "[unserialisable]").
 *   - Secrets hygiene: never log full request bodies — callers should pass
 *     scoped fields. We do not auto-scrub here because that's a false sense
 *     of security; the discipline is in the call site.
 *
 * Usage:
 *
 *   import { createLogger } from "../_shared/logger.ts";
 *   const log = createLogger({ fn: "process-scan", requestId: req.headers.get("x-request-id") });
 *   log.info("scan_started", { scan_id });
 *   const t0 = performance.now();
 *   try {
 *     // ... work ...
 *     log.info("scan_completed", { scan_id, latency_ms: performance.now() - t0 });
 *   } catch (err) {
 *     log.error("scan_failed", { scan_id, latency_ms: performance.now() - t0 }, err);
 *     throw err;
 *   }
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerContext {
  /** Edge function name, e.g. "process-scan". Required for filtering. */
  fn: string;
  /** Correlates log lines for one request. Auto-generated if omitted. */
  requestId?: string;
  /** Optional static fields merged into every line (e.g. deployment env). */
  base?: Record<string, unknown>;
}

export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>, err?: unknown): void;
  error(event: string, fields?: Record<string, unknown>, err?: unknown): void;
  /** Returns a child logger with extra base fields (e.g. stage="agent2a"). */
  child(extra: Record<string, unknown>): Logger;
  /** Exposed so callers can correlate with downstream HTTP headers. */
  readonly requestId: string;
}

/** Minimum level to emit. Override via env LOG_LEVEL=debug|info|warn|error. */
const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: LogLevel =
  ((Deno.env.get("LOG_LEVEL") || "").toLowerCase() as LogLevel) in LEVEL_RANK
    ? (Deno.env.get("LOG_LEVEL")!.toLowerCase() as LogLevel)
    : "info";

export function createLogger(ctx: LoggerContext): Logger {
  const requestId = ctx.requestId || crypto.randomUUID();
  const base = { fn: ctx.fn, request_id: requestId, ...(ctx.base || {}) };
  return buildLogger(base, requestId);
}

function buildLogger(base: Record<string, unknown>, requestId: string): Logger {
  const emit = (level: LogLevel, event: string, fields?: Record<string, unknown>, err?: unknown) => {
    if (LEVEL_RANK[level] < LEVEL_RANK[MIN_LEVEL]) return;
    const line: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      event,
      ...base,
      ...(fields || {}),
    };
    if (err !== undefined) line.error = normaliseError(err);
    const serialised = safeStringify(line);
    // warn/error → stderr so Supabase log explorer surfaces severity correctly.
    if (level === "error" || level === "warn") console.error(serialised);
    else console.log(serialised);
  };

  return {
    requestId,
    debug: (e, f) => emit("debug", e, f),
    info: (e, f) => emit("info", e, f),
    warn: (e, f, err) => emit("warn", e, f, err),
    error: (e, f, err) => emit("error", e, f, err),
    child: (extra) => buildLogger({ ...base, ...extra }, requestId),
  };
}

function normaliseError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (typeof err === "object" && err !== null) {
    return { value: safeStringify(err) };
  }
  return { value: String(err) };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ unserialisable: true, type: typeof value });
  }
}
