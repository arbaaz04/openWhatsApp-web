/**
 * Structured JSON logger for Cloudflare Workers.
 *
 * Two usage modes:
 * 1. Module singleton — `logger.info(...)` — for services and repositories.
 * 2. Request-scoped — `createLogger({ requestId })` — for route handlers.
 *    All logs from the same request share the same requestId automatically.
 *
 * Telemetry sink (optional):
 *   If your code has access to an endpoint URL (e.g. an Axiom ingest URL stored
 *   in a Worker binding), call `setTelemetrySink(url, token)` once at request
 *   start. Subsequent ERROR and WARN logs will be forwarded there via a
 *   fire-and-forget `fetch`. Logs are always written to console regardless.
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export type LogContext = Record<string, unknown>;

export interface Logger {
  info(msg: string, context?: LogContext): void;
  warn(msg: string, context?: LogContext): void;
  error(msg: string, context?: LogContext): void;
  debug(msg: string, context?: LogContext): void;
}

// ---------------------------------------------------------------------------
// Telemetry sink — optional, set per-request in index.ts middleware
// ---------------------------------------------------------------------------
let _sinkUrl: string | null = null;
let _sinkToken: string | null = null;

/**
 * Configures an external telemetry endpoint.
 * Logs at WARN and ERROR level will be forwarded here in addition to console.
 *
 * @param url   - HTTP(S) ingest URL (e.g. Axiom dataset endpoint)
 * @param token - Bearer token for the ingest API
 *
 * @example
 * // In index.ts middleware, if the binding is configured:
 * setTelemetrySink(c.env.TELEMETRY_URL, c.env.TELEMETRY_TOKEN);
 */
export function setTelemetrySink(url: string, token: string): void {
  _sinkUrl = url;
  _sinkToken = token;
}

function forwardToSink(payload: Record<string, unknown>): void {
  if (!_sinkUrl || !_sinkToken) return;

  // Fire-and-forget — never await, never throw.
  // In Workers this needs to be wrapped in waitUntil() for correctness,
  // but at log-time we don't have execution context. The caller (index.ts)
  // can wrap setTelemetrySink setup in waitUntil if needed.
  fetch(_sinkUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${_sinkToken}`,
    },
    body: JSON.stringify([payload]),
  }).catch(() => {
    // Telemetry delivery failure must never affect the request.
  });
}

// ---------------------------------------------------------------------------
// Core write function
// ---------------------------------------------------------------------------
function write(level: LogLevel, message: string, context?: LogContext): void {
  if (process.env.NODE_ENV === 'test' && level !== 'ERROR') return;

  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (level === 'ERROR') {
    console.error(JSON.stringify(payload));
  } else if (level === 'WARN') {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }

  // Forward significant events to external telemetry sink if configured
  if (level === 'ERROR' || level === 'WARN') {
    forwardToSink(payload);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a request-scoped logger with pre-bound context.
 * Every log call merges baseContext so requestId appears in every line.
 *
 * @example
 * const log = createLogger({ requestId: c.get('requestId') });
 * log.info('Webhook verified'); // => { ..., requestId: "abc-123", ... }
 */
export function createLogger(baseContext: LogContext): Logger {
  return {
    info:  (msg, ctx) => write('INFO',  msg, { ...baseContext, ...ctx }),
    warn:  (msg, ctx) => write('WARN',  msg, { ...baseContext, ...ctx }),
    error: (msg, ctx) => write('ERROR', msg, { ...baseContext, ...ctx }),
    debug: (msg, ctx) => write('DEBUG', msg, { ...baseContext, ...ctx }),
  };
}

/** Module-level singleton for services and repositories. */
export const logger: Logger = createLogger({});
