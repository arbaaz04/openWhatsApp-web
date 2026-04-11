/**
 * @file Security headers middleware.
 *
 * Adds defensive HTTP response headers on every response to mitigate a range
 * of browser-based attacks (clickjacking, MIME sniffing, information leakage).
 *
 * Applied globally in index.ts before any route handler runs.
 */

import type { Context, Next } from 'hono';

/**
 * Hono middleware that sets security-hardening HTTP response headers.
 * Should be mounted before any route handler.
 *
 * Headers set:
 * - `Strict-Transport-Security` — forces HTTPS for 1 year, including subdomains
 * - `X-Content-Type-Options` — prevents MIME-type sniffing
 * - `X-Frame-Options` — blocks the app from being embedded in iframes (clickjacking)
 * - `Referrer-Policy` — limits referrer information sent to cross-origin destinations
 * - `Permissions-Policy` — denies access to sensitive browser APIs not needed by our API
 * - `Content-Security-Policy` — strict policy for API responses
 */
export async function securityHeaders(c: Context, next: Next): Promise<void> {
  await next();
  c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );
  c.res.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );
}
