/**
 * @file Supabase JWT verification middleware.
 *
 * Supabase issues HS256-signed JWTs (HMAC-SHA256). We verify them using the
 * Web Crypto API — no external JWT library needed, keeping the Worker bundle lean.
 *
 * After verification the following values are written to the Hono context:
 *   - `userId`    — the Supabase user UUID (`sub` claim)
 *   - `userEmail` — the user's email address
 *
 * `teamId` is NOT in the JWT — it is resolved from the database in
 * `requireRole`, which runs after this middleware on protected routes.
 *
 * @see https://supabase.com/docs/guides/auth/jwts
 */

import type { Context, Next } from 'hono';
import { ApiError } from '../utils/errors.js';
import type { AppEnv } from '../types/honoContext.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the Supabase JWT payload we care about. */
interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  aud: string | string[];
  iss: string;
  exp: number;
  iat: number;
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

/**
 * Decodes the base64url-encoded payload segment of a JWT.
 * Verification happens separately in `verifySupabaseJwt`.
 */
function decodeJwtPayload(token: string): SupabaseJwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new ApiError(401, 'Malformed JWT — expected header.payload.signature', 'INVALID_TOKEN');
  }

  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  try {
    return JSON.parse(atob(padded)) as SupabaseJwtPayload;
  } catch {
    throw new ApiError(401, 'Could not decode JWT payload', 'INVALID_TOKEN');
  }
}

/**
 * Verifies the JWT signature using HS256 + Web Crypto, then checks `exp` and
 * `aud` claims. Throws a typed ApiError on any failure.
 *
 * @param token  - Raw JWT string (from the Authorization header)
 * @param secret - `SUPABASE_JWT_SECRET` binding value
 */
async function verifySupabaseJwt(
  token: string,
  secret: string,
  expectedIssuer: string | undefined
): Promise<SupabaseJwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new ApiError(401, 'Malformed JWT', 'INVALID_TOKEN');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigPadded =
    signatureB64.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (signatureB64.length % 4)) % 4);
  const signatureBytes = Uint8Array.from(atob(sigPadded), (c) => c.charCodeAt(0));

  const valid = await crypto.subtle.verify(
    'HMAC',
    cryptoKey,
    signatureBytes,
    encoder.encode(signingInput)
  );

  if (!valid) {
    throw new ApiError(401, 'Invalid JWT signature', 'INVALID_TOKEN');
  }

  const payload = decodeJwtPayload(token);

  if (Date.now() / 1000 > payload.exp) {
    throw new ApiError(401, 'JWT has expired', 'TOKEN_EXPIRED');
  }

  // Supabase sets `aud` to "authenticated" for user-issued tokens
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes('authenticated')) {
    throw new ApiError(401, 'JWT audience mismatch', 'INVALID_TOKEN');
  }

  if (expectedIssuer && payload.iss !== `${expectedIssuer}/auth/v1`) {
    throw new ApiError(401, 'JWT issuer mismatch', 'INVALID_TOKEN');
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Hono middleware that enforces authentication on a route.
 *
 * Reads `Authorization: Bearer <token>`, verifies the Supabase HS256 JWT, and
 * writes `userId` and `userEmail` onto the request context for downstream use.
 *
 * Routes using this middleware can call `c.get('userId')` without null-checks —
 * the middleware throws (and the global error handler returns 401) before the
 * route handler ever runs.
 *
 * @example
 * router.get('/me', requireAuth, (c) => {
 *   const userId = c.get('userId'); // always present here
 * });
 */
export async function requireAuth(
  c: Context<AppEnv>,
  next: Next
): Promise<void> {
  const authHeader = c.req.header('Authorization') ?? '';

  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or malformed Authorization header', 'UNAUTHORIZED');
  }

  const token = authHeader.slice('Bearer '.length);
  const jwtSecret = c.env.SUPABASE_JWT_SECRET;

  if (!jwtSecret) {
    throw new ApiError(503, 'Auth service not configured', 'MISCONFIGURED');
  }

  const payload = await verifySupabaseJwt(token, jwtSecret, c.env.SUPABASE_URL);

  c.set('userId', payload.sub);
  c.set('userEmail', payload.email ?? '');

  await next();
}
