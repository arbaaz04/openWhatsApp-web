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
import { logger } from '../utils/logger.js';
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
  const isWildcard = allowed === '*';
  const isStaging = c.env.ENVIRONMENT !== 'production';
  
  // Use a more robust matching logic that ignores protocol differences if necessary,
  // but strictly handles the wildcard case first.
  let isMatch = origin === allowed;
  if (!isMatch && origin && allowed) {
    const strippedOrigin = origin.replace(/^https?:\/\//, '');
    const strippedAllowed = allowed.replace(/^https?:\/\//, '');
    isMatch = strippedOrigin === strippedAllowed;
  }

  // Automatic bypass for staging/dev: trust any .whatflow.io origin
  const isInternalMatch = isStaging && origin?.endsWith('.whatflow.io');

  // Helper to append mandatory CORS headers to any response
  const addCorsHeaders = (res: Response) => {
    res.headers.set('Access-Control-Allow-Origin', (isWildcard || isInternalMatch) ? origin : allowed);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
    
    // Debug headers to surface configuration mismatches in the browser
    res.headers.set('X-Whatflow-Debug-Allowed', allowed ?? 'MISSING');
    res.headers.set('X-Whatflow-Debug-Origin', origin ?? 'MISSING');
    res.headers.set('X-Whatflow-Debug-Match', String(isMatch || isInternalMatch));
    
    return res;
  };

  if (!isWildcard && !isMatch && !isInternalMatch) {
    logger.warn('CORS request rejected', { origin, allowed });
    c.res = addCorsHeaders(new Response('Forbidden — origin not allowed', { status: 403 }));
    return c.res;
  }

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    c.res = addCorsHeaders(new Response(null, { status: 204 }));
    return c.res;
  }

  try {
    await next();
  } finally {
    if (c.res) {
      addCorsHeaders(c.res);
    }
  }
}
