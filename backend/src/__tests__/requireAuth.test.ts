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

async function signEs256Jwt(
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  kid: string
): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT', kid };
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const headerB64 = enc(header);
  const payloadB64 = enc(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const webCryptoSig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(signingInput)
    )
  );

  // Convert DER ECDSA signature to JOSE (r || s)
  const derToJose = (der: Uint8Array): Uint8Array => {
    const readInt = (offset: number): { value: Uint8Array; next: number } => {
      if (der[offset] !== 0x02) throw new Error('Invalid DER integer');
      const len = der[offset + 1];
      const start = offset + 2;
      const end = start + len;
      const raw = der.slice(start, end);
      let trimmed = raw;
      while (trimmed.length > 32 && trimmed[0] === 0) trimmed = trimmed.slice(1);
      const out = new Uint8Array(32);
      out.set(trimmed.slice(-32), 32 - Math.min(trimmed.length, 32));
      return { value: out, next: end };
    };

    if (der[0] !== 0x30) throw new Error('Invalid DER sequence');
    const { value: r, next } = readInt(2);
    const { value: s } = readInt(next);
    const jose = new Uint8Array(64);
    jose.set(r, 0);
    jose.set(s, 32);
    return jose;
  };

  const joseSig = webCryptoSig.length === 64 ? webCryptoSig : derToJose(webCryptoSig);
  const sigB64 = btoa(String.fromCharCode(...joseSig))
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

  it('accepts a valid ES256 token using Supabase JWKS', async () => {
    const kid = 'test-es256-key';
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );

    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const token = await signEs256Jwt(
      {
        sub: 'user-es256-123',
        email: 'es256@example.com',
        aud: 'authenticated',
        iss: 'https://test.supabase.co/auth/v1',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      keyPair.privateKey,
      kid
    );

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          keys: [{ ...publicJwk, kid, alg: 'ES256', use: 'sig' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const c = makeContext(token, {
      SUPABASE_JWT_SECRET: '', // ES256 path should not require shared secret
      SUPABASE_URL: 'https://test.supabase.co',
    });

    const next = vi.fn().mockResolvedValue(undefined);
    await requireAuth(c as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(c._vars['userId']).toBe('user-es256-123');
    expect(c._vars['userEmail']).toBe('es256@example.com');

    fetchMock.mockRestore();
  });
});
