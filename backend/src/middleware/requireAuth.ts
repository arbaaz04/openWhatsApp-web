/**
 * @file Supabase JWT verification middleware.
 *
 * Supabase issues HS256-signed JWTs (HMAC-SHA256). We verify them using the
 * Web Crypto API — no external JWT library needed, keeping the Worker bundle lean.
 *
 * After verification, the following values are extracted from the JWT payload
 * and stored on the Hono request context for use in route handlers:
 * - `userId`  — the Supabase user UUID (`sub` claim)
 * - `email`   — the user's email address
 *
 * `teamId` is NOT in the JWT — it is looked up from the database in
 * `requireRole`, which runs after this middleware on protected routes.
 *
 * @see https://supabase.com/docs/guides/auth/jwts
 */

import type { Context, Next } from 'hono';
import { ApiError } from '../utils/errors.js';
import type { WorkerBindings } from '../types/bindings.js';

/** Shape of the Supabase JWT payload we care about. */
interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  aud: string | string[];
  iss: string;
  exp: number;
  iat: number;
}

/** Variables that requireAuth writes onto the Hono context. */
export interface AuthContext {
  userId: string;
  userEmail: string;
}

/**
 * Decodes the base64url-encoded segments of a JWT without verifying it.
 * Verification is done separately via Web Crypto.
 */
function decodeJwtPayload(token: string): SupabaseJwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new ApiError(401, 'Malformed JWT — expected header.payload.signature', 'INVALID_TOKEN');
  }

  const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);

  try {
    return JSON.parse(atob(padded)) as SupabaseJwtPayload;
  } catch {
    throw new ApiError(401, 'Could not decode JWT payload', 'INVALID_TOKEN');
  }
}

/**
 * Verifies the JWT signature and `exp` / `aud` claims using HS256 + Web Crypto.
 *
 * @param token  - Raw JWT string from the Authorization header
 * @param secret - `SUPABASE_JWT_SECRET` binding (the signing key)
 * @returns Verified and parsed payload
 * @throws {ApiError} 401 on any verification failure
 */
async function verifySupabaseJwt(
  token: string,
  secret: string
): Promise<SupabaseJwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new ApiError(401, 'Malformed JWT', 'INVALID_TOKEN');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the Supabase JWT secret as an HMAC-SHA256 key
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Decode the signature from base64url
  const sigPadded = signatureB64.replace(/-/g, '+').replace(/_/g, '/') +
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

  // Check token expiry
  if (Date.now() / 1000 > payload.exp) {
    throw new ApiError(401, 'JWT has expired', 'TOKEN_EXPIRED');
  }

  // Supabase sets aud to "authenticated" for user JWTs
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes('authenticated')) {
    throw new ApiError(401, 'JWT audience mismatch', 'INVALID_TOKEN');
  }

  return payload;
}

/**
 * Hono middleware that enforces authentication on a route.
 *
 * Reads `Authorization: Bearer <token>`, verifies the Supabase JWT, and
 * sets `userId` and `userEmail` on the request context.
 *
 * Routes that call this middleware can safely call `c.get('userId')` without
 * null-checks — the middleware throws before the handler runs if auth fails.
 *
 * @example
 * router.get('/me', requireAuth, (c) => {
 *   const userId = c.get('userId');
 *   ...
 * });
 */
export async function requireAuth(
  c: Context<{ Bindings: WorkerBindings }>,
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

  const payload = await verifySupabaseJwt(token, jwtSecret);

  // Write auth context — downstream handlers access these via c.get()
  (c as Context<{ Bindings: WorkerBindings; Variables: Record<string, string> }>)
    .set('userId', payload.sub);
  (c as Context<{ Bindings: WorkerBindings; Variables: Record<string, string> }>)
    .set('userEmail', payload.email ?? '');

  await next();
}
