/**
 * @file Basic structured JSON logger
 */

/**
 * Logs information globally in a structured JSON format to easily trace via DataDog/CloudWatch.
 * @param {string} level - 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
 * @param {string} message - The message to log
 * @param {Record<string, unknown>} [context] - Key value pairs of context data
 */
function log(level: string, message: string, context?: Record<string, unknown>) {
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

export const logger = {
  info: (msg: string, context?: Record<string, unknown>) => log('INFO', msg, context),
  warn: (msg: string, context?: Record<string, unknown>) => log('WARN', msg, context),
  error: (msg: string, context?: Record<string, unknown>) => log('ERROR', msg, context),
  debug: (msg: string, context?: Record<string, unknown>) => log('DEBUG', msg, context),
};
