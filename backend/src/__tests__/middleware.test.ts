import { describe, it, expect, vi } from 'vitest';
import { securityHeaders } from '../middleware/securityHeaders.js';
import { cors } from '../middleware/cors.js';

/** Build a minimal Hono-like context stub for middleware testing */
function makeContext(overrides: Record<string, unknown> = {}) {
  const headers = new Map<string, string>();
  return {
    res: {
      headers: {
        set: (k: string, v: string) => headers.set(k, v),
        get: (k: string) => headers.get(k),
      },
    },
    req: {
      method: 'GET',
      header: (_k: string): string | undefined => undefined,
    },
    env: { ALLOWED_ORIGIN: 'https://app.whatflow.io' },
    ...overrides,
  };
}

describe('securityHeaders middleware', () => {
  it('sets Strict-Transport-Security after next()', async () => {
    const c = makeContext();
    const next = vi.fn().mockResolvedValue(undefined);
    await securityHeaders(c as never, next);
    expect(c.res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const c = makeContext();
    await securityHeaders(c as never, vi.fn().mockResolvedValue(undefined));
    expect(c.res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY', async () => {
    const c = makeContext();
    await securityHeaders(c as never, vi.fn().mockResolvedValue(undefined));
    expect(c.res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('sets Referrer-Policy', async () => {
    const c = makeContext();
    await securityHeaders(c as never, vi.fn().mockResolvedValue(undefined));
    expect(c.res.headers.get('Referrer-Policy')).toBeTruthy();
  });

  it('sets Content-Security-Policy', async () => {
    const c = makeContext();
    await securityHeaders(c as never, vi.fn().mockResolvedValue(undefined));
    expect(c.res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
  });

  it('calls next() exactly once', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    await securityHeaders(makeContext() as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('cors middleware', () => {
  it('passes through requests with no Origin header (non-browser)', async () => {
    const c = makeContext({ req: { method: 'GET', header: () => undefined } });
    const next = vi.fn().mockResolvedValue(undefined);
    await cors(c as never, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes through requests from the allowed origin', async () => {
    const c = makeContext({
      req: { method: 'GET', header: (k: string) => k === 'Origin' ? 'https://app.whatflow.io' : undefined },
    });
    const next = vi.fn().mockResolvedValue(undefined);
    await cors(c as never, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('blocks requests from a disallowed origin with 403', async () => {
    let setCalled = false;
    const c = {
      req: { method: 'GET', header: (k: string) => k === 'Origin' ? 'https://attacker.com' : undefined },
      env: { ALLOWED_ORIGIN: 'https://app.whatflow.io' },
      res: null as unknown,
    };
    Object.defineProperty(c, 'res', {
      set: (v: unknown) => { setCalled = true; c._res = v; },
      get: () => c._res,
    });

    await cors(c as never, vi.fn());
    expect(setCalled).toBe(true);
    const res = (c as unknown as { _res: Response })._res;
    expect(res.status).toBe(403);
  });

  it('handles OPTIONS preflight by returning 204', async () => {
    let setCalled = false;
    const c = {
      req: {
        method: 'OPTIONS',
        header: (k: string) => k === 'Origin' ? 'https://app.whatflow.io' : undefined,
      },
      env: { ALLOWED_ORIGIN: 'https://app.whatflow.io' },
      res: null as unknown,
      _res: null as unknown,
    };
    Object.defineProperty(c, 'res', {
      set: (v: unknown) => { setCalled = true; c._res = v; },
      get: () => c._res,
    });

    await cors(c as never, vi.fn());
    expect(setCalled).toBe(true);
    const res = (c as unknown as { _res: Response })._res;
    expect(res.status).toBe(204);
  });
});

describe('securityHeaders middleware', () => {
  it('sets Strict-Transport-Security after next()', async () => {
    const c = makeContext();
    const next = vi.fn().mockResolvedValue(undefined);
    await securityHeaders(c as never, next);
    expect(c.res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const c = makeContext();
    await securityHeaders(c as never, vi.fn().mockResolvedValue(undefined));
    expect(c.res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY', async () => {
    const c = makeContext();
    await securityHeaders(c as never, vi.fn().mockResolvedValue(undefined));
    expect(c.res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('sets Referrer-Policy', async () => {
    const c = makeContext();
    await securityHeaders(c as never, vi.fn().mockResolvedValue(undefined));
    expect(c.res.headers.get('Referrer-Policy')).toBeTruthy();
  });

  it('calls next() exactly once', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    await securityHeaders(makeContext() as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
