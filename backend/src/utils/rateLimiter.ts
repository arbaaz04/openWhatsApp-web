import { Context, Next } from 'hono';
import { ApiError } from './errors.js';

/**
 * Basic In-Memory Rate Limiter as an initial security checkpoint.
 * Note: Cloudflare Workers resets memory on cold starts. For production multi-isolate rate-limiting,
 * use Cloudflare Rate Limiting natively or Durable Objects.
 *
 * @param limit Max requests per minute
 * @returns Hono Middleware handler
 */
export const rateLimiter = (limit: number = 100) => {
  const ipRequests = new Map<string, { count: number; resetTime: number }>();

  return async (c: Context, next: Next) => {
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const now = Date.now();

    let record = ipRequests.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + 60 * 1000 };
    }

    record.count++;
    ipRequests.set(ip, record);

    if (record.count > limit) {
      throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMIT_EXCEEDED');
    }

    await next();
  };
};
