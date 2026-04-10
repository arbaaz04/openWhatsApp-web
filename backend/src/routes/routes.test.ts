import { describe, it, expect, vi } from 'vitest';
import authRouter from './auth.routes.js';
import webhookRouter from './webhook.routes.js';

describe('API Route Integrations', () => {
  it('should ping webhook verification natively resolving Meta challenges', async () => {
    // Stub Meta verification token natively within testing environments
    process.env.WEBHOOK_VERIFY_TOKEN = 'test_token';
    const res = await webhookRouter.request('/?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=123');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('123');

    const resFail = await webhookRouter.request('/?hub.mode=subscribe&hub.verify_token=wrong');
    expect(resFail.status).toBe(403);
  });

  it('should process webhook POST gracefully parsing generic body payload constraints', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
    });
    
    // Inject mock execution context natively resolving waitUntil triggers
    const res = await webhookRouter.fetch(req, {
      waitUntil: vi.fn(),
    } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
  });

  it('should process embedded signup dynamically returning safe WABA bridges', async () => {
    // Note: Due to strict Zod object parsers, malformed requests automatically return 400s cleanly without hitting endpoint internals!
    const reqFail = new Request('http://localhost/embedded-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '' }) // Invalid due to .min(1)
    });
    const resFail = await authRouter.fetch(reqFail);
    expect(resFail.status).toBe(400); // Handled natively by @hono/zod-openapi
  });
});
