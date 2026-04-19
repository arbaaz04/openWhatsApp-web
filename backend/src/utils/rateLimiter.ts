import type { Context, Env, Next } from 'hono';
import { ApiError } from './errors.js';
import type { WorkerBindings } from '../types/bindings.js';

/**
 * Rate limiter middleware with two modes:
 *
 * MODE 1 — Cloudflare Native (production)
 *   Uses the `RATE_LIMITER` binding declared in `WorkerBindings`.
 *   Per-account, persistent across isolates, survives cold starts.
 *
 * MODE 2 — In-Memory (local dev / test)
 *   Falls back to a per-isolate Map when the CF binding is absent.
 *   Resets on cold starts — NOT suitable for multi-isolate deployments.
 *
 * @param limit - Max requests per minute (in-memory fallback only)
 */
export const rateLimiter = (limit: number = 100) => {
  // LOCAL DEV ONLY — per-isolate, resets on cold start
  const localStore = new Map<string, { count: number; resetAt: number }>();

  return async <E extends Env & { Bindings: WorkerBindings }>(
    c: Context<E>,
    next: Next
  ): Promise<void> => {
    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for') ??
      'anonymous';

    // MODE 1: Cloudflare native binding — no cast needed, fully typed
    if (c.env?.RATE_LIMITER) {
      const { success } = await c.env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMIT_EXCEEDED');
      }
      await next();
      return;
    }

    if (c.env?.ENVIRONMENT !== 'local') {
      throw new ApiError(503, 'Rate limiter binding missing in production environment', 'MISCONFIGURED');
    }

    // MODE 2: In-memory fallback (local dev ONLY)
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
