import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { webhookService } from '../services/webhookService.js';
import { logger } from '../utils/logger.js';
import { MetaWebhookPayloadSchema } from '../types/webhook.types.js';
import type { WorkerBindings } from '../types/bindings.js';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

const webhookRouter = new OpenAPIHono<{ Bindings: WorkerBindings }>();

// ---------------------------------------------------------------------------
// GET /api/webhooks — Meta webhook verification handshake
// ---------------------------------------------------------------------------
webhookRouter.get('/', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  // Read from typed Cloudflare env binding — not process.env
  const expectedToken = c.env.WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === expectedToken) {
    logger.info('Webhook verified by Meta');
    return c.text(challenge ?? '');
  }

  logger.error('Webhook verification failed', { providedToken: token });
  return c.text('Forbidden', 403 as ContentfulStatusCode);
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
        'application/json': {
          schema: MetaWebhookPayloadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Webhook received and queued for processing',
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
  },
});

webhookRouter.openapi(webhookPostRoute, async (c) => {
  const payload = c.req.valid('json');

  // Ack immediately; let the runtime keep the isolate alive for background work
  c.executionCtx.waitUntil(
    webhookService.processPayload(payload, c.env)
  );

  return c.json({ success: true }, 200 as ContentfulStatusCode);
});

export default webhookRouter;
