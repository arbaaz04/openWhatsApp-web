import type { Context, Next } from 'hono';
import { ApiError } from '../utils/errors.js';

/**
 * Hono middleware that enforces a maximum execution time for a request.
 *
 * If the downstream middleware chain takes longer than `timeoutMs`, this
 * middleware resolves with a 504 Gateway Timeout error.
 *
 * This is useful for preventing Cloudflare Workers hard-kills ("Worker hung"),
 * allowing us to return a proper CORS-compliant error response and logs
 * before the runtime terminates the process.
 *
 * @param timeoutMs - Max time in milliseconds (default 20,000 / 20s)
 */
export function timeout(timeoutMs: number = 20000) {
  return async (c: Context, next: Next) => {
    let timer: any;

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new ApiError(504, `Request timed out after ${timeoutMs / 1000}s`, 'GATEWAY_TIMEOUT'));
      }, timeoutMs);
    });

    try {
      // Race the actual request against the timeout
      await Promise.race([next(), timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  };
}
