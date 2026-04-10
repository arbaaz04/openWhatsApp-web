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

    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
    const res = await webhookRouter.fetch(req, {}, ctx);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
  });

  it('should reject malformed embedded signup bodies at Zod validation layer', async () => {
    const req = new Request('http://localhost/embedded-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '' }), // fails .min(1)
    });
    const res = await authRouter.fetch(req);
    expect(res.status).toBe(400);
  });
});
