/**
 * Structured JSON logger for Cloudflare Workers.
 *
 * Two usage modes:
 *
 * 1. Module-level singleton — `logger.info(...)` — for services and repositories
 *    that don't have access to per-request context.
 *
 * 2. Request-scoped instance — `createLogger({ requestId, ... })` — for route
 *    handlers that want to correlate all logs from a single request. The base
 *    context is merged into every log entry automatically.
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
type LogContext = Record<string, unknown>;

function write(level: LogLevel, message: string, context?: LogContext): void {
  if (process.env.NODE_ENV === 'test' && level !== 'ERROR') return;

  const payload = {
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
}

export interface Logger {
  info(msg: string, context?: LogContext): void;
  warn(msg: string, context?: LogContext): void;
  error(msg: string, context?: LogContext): void;
  debug(msg: string, context?: LogContext): void;
}

/**
 * Creates a request-scoped logger with pre-bound base context.
 * Every log call will include `baseContext` merged alongside any call-site context.
 *
 * @example
 * const log = createLogger({ requestId: c.get('requestId') });
 * log.info('Processing request'); // => { ..., requestId: "abc-123", message: "..." }
 */
export function createLogger(baseContext: LogContext): Logger {
  return {
    info: (msg, ctx) => write('INFO', msg, { ...baseContext, ...ctx }),
    warn: (msg, ctx) => write('WARN', msg, { ...baseContext, ...ctx }),
    error: (msg, ctx) => write('ERROR', msg, { ...baseContext, ...ctx }),
    debug: (msg, ctx) => write('DEBUG', msg, { ...baseContext, ...ctx }),
  };
}

/** Module-level singleton for use in services and repositories. */
export const logger: Logger = createLogger({});
