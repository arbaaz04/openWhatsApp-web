/**
 * @file Supabase JWT verification middleware.
 *
 * Supabase now issues asymmetric JWTs (typically ES256) verified via JWKS.
 * For compatibility we still support legacy HS256 projects that rely on
 * SUPABASE_JWT_SECRET.
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
import { logger } from '../utils/logger.js';
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

interface JwtHeader {
  alg: string;
  typ?: string;
  kid?: string;
}

interface JwkKey {
  kid?: string;
  kty: string;
  alg?: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
}

interface JwksResponse {
  keys: JwkKey[];
}

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
let jwksCache: { url: string; expiresAt: number; keys: JwkKey[] } | null = null;

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

function decodeJwtHeader(token: string): JwtHeader {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new ApiError(401, 'Malformed JWT — expected header.payload.signature', 'INVALID_TOKEN');
  }

  const base64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  try {
    return JSON.parse(atob(padded)) as JwtHeader;
  } catch {
    throw new ApiError(401, 'Could not decode JWT header', 'INVALID_TOKEN');
  }
}

function decodeBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function joseToDerEcdsaSignature(signature: Uint8Array): Uint8Array {
  if (signature.length !== 64) {
    throw new ApiError(401, 'Invalid ES256 signature length', 'INVALID_TOKEN');
  }

  const r = signature.slice(0, 32);
  const s = signature.slice(32);

  const encodeInt = (bytes: Uint8Array): Uint8Array => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i++;
    let out = bytes.slice(i);
    if (out[0] & 0x80) {
      const prefixed = new Uint8Array(out.length + 1);
      prefixed[0] = 0;
      prefixed.set(out, 1);
      out = prefixed;
    }
    return out;
  };

  const rEnc = encodeInt(r);
  const sEnc = encodeInt(s);
  const totalLength = 2 + rEnc.length + 2 + sEnc.length;

  const der = new Uint8Array(2 + totalLength);
  der[0] = 0x30;
  der[1] = totalLength;
  der[2] = 0x02;
  der[3] = rEnc.length;
  der.set(rEnc, 4);
  der[4 + rEnc.length] = 0x02;
  der[5 + rEnc.length] = sEnc.length;
  der.set(sEnc, 6 + rEnc.length);
  return der;
}

async function getJwks(supabaseUrl: string): Promise<JwkKey[]> {
  const jwksUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;

  if (jwksCache && jwksCache.url === jwksUrl && Date.now() < jwksCache.expiresAt) {
    return jwksCache.keys;
  }

  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new ApiError(503, 'Unable to fetch Supabase JWKS', 'MISCONFIGURED');
  }

  const data = (await response.json()) as JwksResponse;
  if (!Array.isArray(data.keys) || data.keys.length === 0) {
    throw new ApiError(503, 'Supabase JWKS is empty', 'MISCONFIGURED');
  }

  jwksCache = {
    url: jwksUrl,
    expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
    keys: data.keys,
  };

  return data.keys;
}

async function verifySupabaseJwtWithJwks(
  token: string,
  expectedIssuer: string | undefined
): Promise<SupabaseJwtPayload> {
  if (!expectedIssuer) {
    throw new ApiError(503, 'SUPABASE_URL is required for JWKS verification', 'MISCONFIGURED');
  }

  const header = decodeJwtHeader(token);
  if (header.alg !== 'ES256') {
    throw new ApiError(401, `Unsupported JWT algorithm: ${header.alg}`, 'INVALID_TOKEN');
  }
  if (!header.kid) {
    throw new ApiError(401, 'JWT missing key id (kid)', 'INVALID_TOKEN');
  }

  const keys = await getJwks(expectedIssuer);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new ApiError(401, 'No matching JWKS key for JWT kid', 'INVALID_TOKEN');
  }

  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') {
    throw new ApiError(401, 'Unsupported JWKS key type for ES256', 'INVALID_TOKEN');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  const [headerB64, payloadB64, signatureB64] = token.split('.');
  const signingInput = `${headerB64}.${payloadB64}`;
  const signatureJose = decodeBase64Url(signatureB64);
  const signatureDer = joseToDerEcdsaSignature(signatureJose);
  const signingInputBytes = new TextEncoder().encode(signingInput);

  let valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    signatureDer,
    signingInputBytes
  );

  // Some runtimes accept raw JOSE signatures directly for ECDSA verify.
  if (!valid) {
    valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      signatureJose,
      signingInputBytes
    );
  }

  if (!valid) {
    throw new ApiError(401, 'Invalid JWT signature', 'INVALID_TOKEN');
  }

  return decodeJwtPayload(token);
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
  secret: string | undefined,
  expectedIssuer: string | undefined
): Promise<SupabaseJwtPayload> {
  const header = decodeJwtHeader(token);

  if (header.alg === 'ES256') {
    return verifySupabaseJwtWithJwks(token, expectedIssuer);
  }

  if (header.alg !== 'HS256') {
    throw new ApiError(401, `Unsupported JWT algorithm: ${header.alg}`, 'INVALID_TOKEN');
  }

  if (!secret) {
    throw new ApiError(503, 'Auth service not configured', 'MISCONFIGURED');
  }

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
  const requestId = c.get('requestId');

  logger.info('Authenticating request', { requestId, hasToken: !!token });

  try {
    const payload = await verifySupabaseJwt(token, jwtSecret, c.env.SUPABASE_URL);
    
    logger.info('Authentication successful', { requestId, userId: payload.sub });
    
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email ?? '');

    await next();
  } catch (err) {
    logger.error('Authentication failed', { 
      requestId, 
      error: err instanceof Error ? err.message : String(err) 
    });
    throw err;
  }
}
