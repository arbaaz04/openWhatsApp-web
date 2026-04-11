import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { createLogger } from '../utils/logger.js';
import { MetaWebhookPayloadSchema } from '../types/webhook.types.js';
import { verifyWebhookSignature } from '../utils/verifyWebhookSignature.js';
import type { WorkerBindings } from '../types/bindings.js';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

type Variables = { requestId: string };

const webhookRouter = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: Variables }>();

// ---------------------------------------------------------------------------
// GET /api/webhooks — Meta webhook verification handshake
// ---------------------------------------------------------------------------
webhookRouter.get('/', (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === c.env.WEBHOOK_VERIFY_TOKEN) {
    log.info('Webhook verified by Meta');
    return c.text(challenge ?? '');
  }

  log.error('Webhook verification failed', {
    hasToken: !!token,
    mode,
  });
  return c.text('Forbidden', 403 as ContentfulStatusCode);
});

// ---------------------------------------------------------------------------
// HMAC guard middleware — must run BEFORE the openapi route so it executes
// before Zod schema validation (OWASP A08 — Software & Data Integrity).
//
// Meta signs every POST with X-Hub-Signature-256: sha256=<hmac>.
// We reject unauthenticated payloads here before any business logic runs.
// ---------------------------------------------------------------------------
webhookRouter.use('/', async (c, next) => {
  if (c.req.method !== 'POST') {
    await next();
    return;
  }

  const log = createLogger({ requestId: c.get('requestId') });
  const signature = c.req.header('X-Hub-Signature-256') ?? '';

  // Read raw body for HMAC computation — the body stream can only be consumed once.
  // We store the string on the request object so the downstream handler avoids
  // a second read attempt.
  const rawBody = await c.req.text();

  const valid = await verifyWebhookSignature(rawBody, signature, c.env.META_APP_SECRET ?? '');
  if (!valid) {
    log.error('Webhook HMAC verification failed', { hasSignature: !!signature });
    return c.json({ success: false, error: 'Invalid webhook signature' }, 401);
  }

  // Hono internally caches the body from the c.req.text() call above.
  // The openapi validator will read from that cache via c.req.json() — no patch needed.
  await next();
});

// ---------------------------------------------------------------------------
// POST /api/webhooks — Inbound Meta webhook events
// ---------------------------------------------------------------------------
const webhookPostRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': { schema: MetaWebhookPayloadSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Webhook received and queued for processing',
      content: {
        'application/json': { schema: z.object({ success: z.boolean() }) },
      },
    },
    401: { description: 'Invalid or missing HMAC signature' },
  },
});

webhookRouter.openapi(webhookPostRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });

  // At this point HMAC has been verified by the middleware above.
  // c.req.valid('json') gives us the Zod-parsed, type-safe payload.
  const payload = c.req.valid('json');

  log.info('Webhook payload accepted', {
    object: payload.object,
    entries: payload.entry.length,
  });

  await c.env.WEBHOOK_QUEUE.send(payload);

  return c.json({ success: true }, 200);
});

export default webhookRouter;
