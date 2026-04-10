import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { webhookService } from '../services/webhookService.js';
import { logger } from '../utils/logger.js';

const webhookRouter = new OpenAPIHono();

/**
 * Verifies webhook registration request from Meta
 */
webhookRouter.get('/', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  const EXPECTED_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === EXPECTED_TOKEN) {
    logger.info('Webhook verified by Meta');
    return c.text(challenge || '');
  } else {
    logger.error('Failed webhook verification', { providedToken: token });
    return c.text('Forbidden', 403);
  }
});

/**
 * Zod Payload definitions for strict Meta POST Requests
 */
const fallbackSchema = z.record(z.any());

/**
 * Receives Webhook events from Meta (messages, templates, etc.)
 */
const webhookPostRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: { 'application/json': { schema: fallbackSchema } },
    },
  },
  responses: {
    200: { description: 'Webhook Received' },
  },
});

webhookRouter.openapi(webhookPostRoute, async (c) => {
  try {
    const payload = c.req.valid('json');
    // Using un-awaited background processing strategy to return 200 OK fast
    c.executionCtx.waitUntil(webhookService.processPayload(payload));
  } catch (error) {
    logger.error('Webhook payload parsing error', { error });
  }

  return c.json({ success: true }, 200 as any);
});

export default webhookRouter;
