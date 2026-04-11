/**
 * Structured JSON logger for Cloudflare Workers.
 *
 * Two usage modes:
 * 1. Module singleton — `logger.info(...)` — for services and repositories.
 * 2. Request-scoped — `createLogger({ requestId })` — for route handlers.
 *    All logs from the same request share the same requestId automatically.
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export type LogContext = Record<string, unknown>;

export interface Logger {
  info(msg: string, context?: LogContext): void;
  warn(msg: string, context?: LogContext): void;
  error(msg: string, context?: LogContext): void;
  debug(msg: string, context?: LogContext): void;
}

interface LoggerOptions {
  environment?: string;
  sinkUrl?: string;
  sinkToken?: string;
}

function forwardToSink(
  payload: Record<string, unknown>,
  sinkUrl?: string,
  sinkToken?: string
): void {
  if (!sinkUrl || !sinkToken) return;

  // Fire-and-forget — never await, never throw.
  fetch(sinkUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sinkToken}`,
    },
    body: JSON.stringify([payload]),
  }).catch(() => {
    // Telemetry delivery failure must never affect the request.
  });
}

// ---------------------------------------------------------------------------
// Core write function
// ---------------------------------------------------------------------------
function write(
  level: LogLevel,
  message: string,
  context: LogContext | undefined,
  options: LoggerOptions
): void {
  if (options.environment === 'test' && level !== 'ERROR') return;

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
    forwardToSink(payload, options.sinkUrl, options.sinkToken);
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
export function createLogger(baseContext: LogContext, options: LoggerOptions = {}): Logger {
  return {
    info:  (msg, ctx) => write('INFO',  msg, { ...baseContext, ...ctx }, options),
    warn:  (msg, ctx) => write('WARN',  msg, { ...baseContext, ...ctx }, options),
    error: (msg, ctx) => write('ERROR', msg, { ...baseContext, ...ctx }, options),
    debug: (msg, ctx) => write('DEBUG', msg, { ...baseContext, ...ctx }, options),
  };
}

/** Module-level singleton for services and repositories. */
export const logger: Logger = createLogger({});
