import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { webhookService } from '../services/webhookService.js';
import { logger } from '../utils/logger.js';
import { MetaWebhookPayloadSchema } from '../types/webhook.types.js';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

const webhookRouter = new OpenAPIHono();

// ---------------------------------------------------------------------------
// GET /api/webhooks  — Meta webhook verification handshake
// ---------------------------------------------------------------------------
webhookRouter.get('/', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN;

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
          // Full Meta payload shape — no z.any() shortcuts
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
  // Payload is fully typed — no casting required
  const payload = c.req.valid('json');

  // Return 200 immediately; process in the background.
  // waitUntil ensures Cloudflare keeps the isolate alive until work completes.
  c.executionCtx.waitUntil(
    webhookService.processPayload(payload, c.env as Record<string, unknown>)
  );

  return c.json({ success: true }, 200 as ContentfulStatusCode);
});

export default webhookRouter;
