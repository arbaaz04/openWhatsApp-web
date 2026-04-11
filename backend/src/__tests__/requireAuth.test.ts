import { describe, it, expect, vi } from 'vitest';
import { requireAuth } from '../middleware/requireAuth.js';

// ---------------------------------------------------------------------------
// JWT test fixture helpers
// ---------------------------------------------------------------------------

/** Sign a payload with HS256 using Web Crypto — mirrors what Supabase does */
async function signJwt(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const signingInput = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signingInput}.${sigB64}`;
}

const SECRET = 'test-supabase-jwt-secret';

/** Build a valid Supabase-style JWT expiring in 1 hour */
async function validToken(overrides: Record<string, unknown> = {}): Promise<string> {
  return signJwt(
    {
      sub: 'user-uuid-123',
      email: 'test@example.com',
      aud: 'authenticated',
      iss: 'https://test.supabase.co/auth/v1',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    },
    SECRET
  );
}

function makeContext(token?: string, env: Record<string, unknown> = {}) {
  const vars: Record<string, string> = {};
  return {
    req: {
      header: (k: string) =>
        k === 'Authorization' && token ? `Bearer ${token}` : undefined,
    },
    env: { SUPABASE_JWT_SECRET: SECRET, ...env },
    set: (k: string, v: string) => { vars[k] = v; },
    get: (k: string) => vars[k],
    _vars: vars,
  };
}

describe('requireAuth middleware', () => {
  it('sets userId and userEmail when a valid JWT is provided', async () => {
    const token = await validToken();
    const c = makeContext(token);
    const next = vi.fn().mockResolvedValue(undefined);

    await requireAuth(c as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(c._vars['userId']).toBe('user-uuid-123');
    expect(c._vars['userEmail']).toBe('test@example.com');
  });

  it('throws 401 when Authorization header is missing', async () => {
    const c = makeContext(undefined);
    await expect(requireAuth(c as never, vi.fn())).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('throws 401 when the JWT signature is invalid', async () => {
    const token = await validToken();
    // Tamper with the signature segment
    const [h, p] = token.split('.');
    const badToken = `${h}.${p}.invalidsignature`;
    const c = makeContext(badToken);

    await expect(requireAuth(c as never, vi.fn())).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('throws 401 when the JWT has expired', async () => {
    const token = await validToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    const c = makeContext(token);

    await expect(requireAuth(c as never, vi.fn())).rejects.toMatchObject({
      statusCode: 401,
      code: 'TOKEN_EXPIRED',
    });
  });

  it('throws 401 when the audience claim is wrong', async () => {
    const token = await validToken({ aud: 'service_role' });
    const c = makeContext(token);

    await expect(requireAuth(c as never, vi.fn())).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('throws 503 when SUPABASE_JWT_SECRET binding is not configured', async () => {
    const token = await validToken();
    const c = makeContext(token, { SUPABASE_JWT_SECRET: '' });

    await expect(requireAuth(c as never, vi.fn())).rejects.toMatchObject({
      statusCode: 503,
      code: 'MISCONFIGURED',
    });
  });
});
