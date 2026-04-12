/**
 * @file CORS middleware with strict origin allowlisting.
 *
 * Only requests from the configured `ALLOWED_ORIGIN` binding are permitted.
 * All other origins receive a 403. Preflight OPTIONS requests are handled
 * explicitly so browsers can complete the CORS handshake.
 *
 * This prevents cross-site request forgery from third-party origins and ensures
 * the API can only be called from the WhatFlow frontend.
 */

import type { Context, Next } from 'hono';
import type { WorkerBindings } from '../types/bindings.js';

/** Headers returned on every CORS response (including preflight). */
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
} as const;

/**
 * Hono middleware that enforces CORS against the `ALLOWED_ORIGIN` binding.
 *
 * - Requests with no `Origin` header (e.g. server-to-server, curl) are allowed
 *   through — they are not cross-origin browser requests.
 * - Requests from an origin that doesn't match `ALLOWED_ORIGIN` are rejected
 *   with 403 before reaching any route handler.
 * - Preflight `OPTIONS` requests are handled and responded to immediately.
 *
 * @param c    - Hono context (must have `Bindings: WorkerBindings`)
 * @param next - Hono next function
 */
export async function cors(
  c: Context<{ Bindings: WorkerBindings }>,
  next: Next
): Promise<void | Response> {
  const origin = c.req.header('Origin');

  // Non-browser requests without an Origin header are not cross-origin
  if (!origin) {
    await next();
    return;
  }

  const allowed = c.env.ALLOWED_ORIGIN;
  const allowWildcard = allowed === '*' && c.env.ENVIRONMENT === 'development';

  if (!allowWildcard && origin !== allowed) {
    c.res = new Response('Forbidden — origin not allowed', { status: 403 });
    return;
  }

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    c.res = new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowWildcard ? '*' : origin,
        ...CORS_HEADERS,
      },
    });
    return;
  }

  await next();

  c.res.headers.set('Access-Control-Allow-Origin', allowWildcard ? '*' : origin);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => c.res.headers.set(k, v));
}
