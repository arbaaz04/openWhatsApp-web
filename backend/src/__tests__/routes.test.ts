import { describe, it, expect, vi } from 'vitest';

// Short-circuit DB init so the webhook route's execution context doesn't throw
vi.mock('../db/index.js', () => ({
  createDb: vi.fn().mockReturnValue({}),
  setDb: vi.fn(),
  getDb: vi.fn().mockReturnValue({}),
  db: {},
}));

import authRouter from '../routes/auth.routes.js';
import webhookRouter from '../routes/webhook.routes.js';

describe('API Route Integrations', () => {
  it('should verify Meta webhook handshake with correct token', async () => {
    const env = { WEBHOOK_VERIFY_TOKEN: 'test_token' };
    const req = new Request(
      'http://localhost/?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=abc123'
    );
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
    const res = await webhookRouter.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('abc123');
  });

  it('should reject Meta webhook handshake with wrong token', async () => {
    const env = { WEBHOOK_VERIFY_TOKEN: 'test_token' };
    const req = new Request(
      'http://localhost/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123'
    );
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
    const res = await webhookRouter.fetch(req, env, ctx);
    expect(res.status).toBe(403);
  });

  it('should accept and queue a valid Meta webhook POST payload', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+10000000000',
                  phone_number_id: 'phone123',
                },
                messages: [
                  {
                    from: 'customer456',
                    id: 'msg1',
                    timestamp: '1234567890',
                    type: 'text',
                    text: { body: 'Hello' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const secret = 'test_app_secret';
    const rawBody = JSON.stringify(payload);

    // Generate a real HMAC-SHA256 signature the same way Meta does
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const buf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const signature = `sha256=${hex}`;

    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: rawBody,
    });

    const env = { META_APP_SECRET: secret, WEBHOOK_QUEUE: { send: vi.fn() } };
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
    const res = await webhookRouter.fetch(req, env, ctx);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
  });

  it('should reject webhook POST with an invalid or missing HMAC signature', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object: 'test', entry: [] }),
    });

    const env = { META_APP_SECRET: 'test_secret' };
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
    const res = await webhookRouter.fetch(req, env, ctx);

    expect(res.status).toBe(401);
  });

  it('should fail embedded signup when authentication is missing', async () => {
    const req = new Request('http://localhost/embedded-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '' }), // fails .min(1)
    });
    const res = await authRouter.fetch(req, { ENVIRONMENT: 'local' });
    expect(res.status).toBe(500);
  });
});
