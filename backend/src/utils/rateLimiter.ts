import { Context, Next } from 'hono';
import { ApiError } from './errors.js';

// ---------------------------------------------------------------------------
// Cloudflare Workers Rate Limiting Binding type
// Declared here so Hono's generic Context can be typed without pulling in
// the full @cloudflare/workers-types package in every file.
// ---------------------------------------------------------------------------
interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Production-grade rate limiter middleware with two modes:
 *
 * MODE 1 — Cloudflare Native (production)
 *   When `env.RATE_LIMITER` binding is present, delegates to Cloudflare's
 *   built-in Rule-based rate limiter. This is per-account, persistent across
 *   isolates, and survives cold starts.
 *
 * MODE 2 — In-Memory (local dev / test)
 *   Falls back to a simple per-isolate Map when the CF binding is absent.
 *   This resets on cold starts and is NOT suitable for multi-isolate deployments.
 *   Clearly gated — never silently used in production if the binding is configured.
 *
 * @param limit - Max requests per minute (used for local fallback only)
 */
export const rateLimiter = (limit: number = 100) => {
  // LOCAL DEV ONLY — isolated per Worker instance, resets on cold start
  const localStore = new Map<string, { count: number; resetAt: number }>();

  return async (c: Context, next: Next): Promise<void> => {
    const ip = c.req.header('cf-connecting-ip')
      ?? c.req.header('x-forwarded-for')
      ?? 'anonymous';

    // MODE 1: Cloudflare native binding (production)
    const cfLimiter = (c.env as Record<string, unknown>)?.RATE_LIMITER as RateLimiterBinding | undefined;

    if (cfLimiter) {
      const { success } = await cfLimiter.limit({ key: ip });
      if (!success) {
        throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMIT_EXCEEDED');
      }
      await next();
      return;
    }

    // MODE 2: Local dev in-memory fallback
    const now = Date.now();
    let record = localStore.get(ip);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + 60_000 };
    }

    record.count += 1;
    localStore.set(ip, record);

    if (record.count > limit) {
      throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMIT_EXCEEDED');
    }

    await next();
  };
};
