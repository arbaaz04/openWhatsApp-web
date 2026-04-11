import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/index.js', () => ({
  createDb: vi.fn().mockReturnValue({}),
  setDb: vi.fn(),
  getDb: vi.fn().mockReturnValue({}),
  db: {},
}));

import app from '../index.js';

describe('Global App Router', () => {
  const testEnv = {
    WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
    DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    ALLOWED_ORIGIN: 'http://localhost:5173',
    SUPABASE_JWT_SECRET: 'test-jwt-secret',
    SUPABASE_URL: 'https://example.supabase.co',
    ENVIRONMENT: 'test',
  };

  it('should return 200 and API online status from root health endpoint', async () => {
    const req = new Request('http://localhost/');
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
    const res = await app.fetch(req, testEnv, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, message: 'Whatflow API Online' });
  });

  it('should return 404 for unknown routes', async () => {
    const req = new Request('http://localhost/api/nonexistent');
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
    const res = await app.fetch(req, testEnv, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect((body as { success: boolean }).success).toBe(false);
  });
});
