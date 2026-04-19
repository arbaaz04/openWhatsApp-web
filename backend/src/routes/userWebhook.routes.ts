/**
 * @file userWebhook.routes.ts
 *
 * REST API for managing user-registered outbound webhooks.
 * All routes are scoped under `/api/teams/:teamId/webhooks` and require
 * the caller to be a team member with at minimum the `developer` role.
 *
 * Secrets are auto-generated (64-char hex) if not provided by the caller.
 * The plaintext secret is returned **only at creation time** via the
 * `secretPlaintext` field. After that, the API returns `'***'`.
 * Clients should store the secret securely on receipt.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createLogger } from '../utils/logger.js';
import { webhookRepository } from '../repositories/webhookRepository.js';
import type { WorkerBindings } from '../types/bindings.js';
import type { WebhookEventName } from '../types/webhook.types.js';

type Variables = { requestId: string; userId: string; userEmail: string; teamId: string };

const userWebhookRouter = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: Variables }>();

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------

const VALID_EVENTS = [
  'conversation.message.received',
  'conversation.message.sent',
  'conversation.window.opened',
  'conversation.window.closed',
] as const;

const WebhookKindSchema = z.enum(['whatflow-web', 'meta']).default('whatflow-web');
const WebhookEventsSchema = z.array(z.enum(VALID_EVENTS)).default([]);

const WebhookRowSchema = z.object({
  id: z.number(),
  teamId: z.number(),
  channelId: z.number().nullable(),
  kind: z.enum(['whatflow-web', 'meta']),
  url: z.string(),
  secret: z.literal('***'),
  events: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Middleware — applied to ALL routes in this router
// ---------------------------------------------------------------------------

userWebhookRouter.use('/:teamId/webhooks', requireAuth);
userWebhookRouter.use('/:teamId/webhooks', requireRole('admin', 'developer'));
userWebhookRouter.use('/:teamId/webhooks/:webhookId', requireAuth);
userWebhookRouter.use('/:teamId/webhooks/:webhookId', requireRole('admin', 'developer'));
userWebhookRouter.use('/:teamId/webhooks/:webhookId/rotate-secret', requireAuth);
userWebhookRouter.use('/:teamId/webhooks/:webhookId/rotate-secret', requireRole('admin', 'developer'));

// ---------------------------------------------------------------------------
// POST /:teamId/webhooks — register a new webhook
// ---------------------------------------------------------------------------

const createWebhookRoute = createRoute({
  method: 'post',
  path: '/:teamId/webhooks',
  request: {
    params: z.object({ teamId: z.string().regex(/^\d+$/) }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url('Must be a valid URL'),
            kind: WebhookKindSchema,
            events: WebhookEventsSchema,
            channelId: z.number().int().positive().optional().nullable(),
            secret: z.string().min(16).max(512).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Webhook created. `secretPlaintext` is shown once — store it securely.',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            webhook: WebhookRowSchema,
            /** Plaintext secret — only returned at creation. */
            secretPlaintext: z.string(),
          }),
        },
      },
    },
    400: { description: 'Invalid request body' },
    401: { description: 'Unauthorized' },
    403: { description: 'Insufficient permissions or channel not owned by team' },
    409: { description: 'A meta webhook already exists for this channel' },
    422: { description: 'URL must use HTTPS' },
  },
});

userWebhookRouter.openapi(createWebhookRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const teamId = parseInt(c.req.param('teamId'), 10);
  const { url, kind, events, channelId, secret } = c.req.valid('json');

  // Generate a strong random secret if the caller didn't provide one
  const plaintextSecret =
    secret ??
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  const webhook = await webhookRepository.create(
    {
      teamId,
      channelId: channelId ?? null,
      kind,
      url,
      secret: plaintextSecret,
      events: events as WebhookEventName[],
    },
    c.env.DATA_ENCRYPTION_KEY
  );

  log.info('Webhook registered', { teamId, webhookId: webhook.id, kind, url });

  return c.json(
    {
      success: true as const,
      webhook: {
        ...webhook,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
      },
      secretPlaintext: plaintextSecret,
    },
    201
  );
});

// ---------------------------------------------------------------------------
// GET /:teamId/webhooks — list all webhooks for a team
// ---------------------------------------------------------------------------

const listWebhooksRoute = createRoute({
  method: 'get',
  path: '/:teamId/webhooks',
  request: {
    params: z.object({ teamId: z.string().regex(/^\d+$/) }),
  },
  responses: {
    200: {
      description: 'Webhook list for the team',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            webhooks: z.array(WebhookRowSchema),
            total: z.number(),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Insufficient permissions' },
  },
});

userWebhookRouter.openapi(listWebhooksRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const teamId = parseInt(c.req.param('teamId'), 10);

  const webhooks = await webhookRepository.listByTeam(teamId);

  log.info('Webhooks listed', { teamId, count: webhooks.length });

  return c.json(
    {
      success: true as const,
      webhooks: webhooks.map((wh) => ({
        ...wh,
        createdAt: wh.createdAt.toISOString(),
        updatedAt: wh.updatedAt.toISOString(),
      })),
      total: webhooks.length,
    },
    200
  );
});

// ---------------------------------------------------------------------------
// GET /:teamId/webhooks/:webhookId — get a single webhook
// ---------------------------------------------------------------------------

const getWebhookRoute = createRoute({
  method: 'get',
  path: '/:teamId/webhooks/:webhookId',
  request: {
    params: z.object({
      teamId: z.string().regex(/^\d+$/),
      webhookId: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: 'Webhook details',
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(true), webhook: WebhookRowSchema }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Insufficient permissions' },
    404: { description: 'Webhook not found' },
  },
});

userWebhookRouter.openapi(getWebhookRoute, async (c) => {
  const teamId = parseInt(c.req.param('teamId'), 10);
  const webhookId = parseInt(c.req.param('webhookId'), 10);

  const webhook = await webhookRepository.getById(webhookId, teamId);

  return c.json(
    {
      success: true as const,
      webhook: {
        ...webhook,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
      },
    },
    200
  );
});

// ---------------------------------------------------------------------------
// PATCH /:teamId/webhooks/:webhookId — partial update
// ---------------------------------------------------------------------------

const updateWebhookRoute = createRoute({
  method: 'patch',
  path: '/:teamId/webhooks/:webhookId',
  request: {
    params: z.object({
      teamId: z.string().regex(/^\d+$/),
      webhookId: z.string().regex(/^\d+$/),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().optional(),
            events: WebhookEventsSchema.optional(),
            isActive: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Webhook updated',
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(true), webhook: WebhookRowSchema }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Insufficient permissions' },
    404: { description: 'Webhook not found' },
    422: { description: 'URL must use HTTPS' },
  },
});

userWebhookRouter.openapi(updateWebhookRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const teamId = parseInt(c.req.param('teamId'), 10);
  const webhookId = parseInt(c.req.param('webhookId'), 10);
  const patch = c.req.valid('json');

  const webhook = await webhookRepository.update(
    webhookId,
    teamId,
    {
      url: patch.url,
      events: patch.events as WebhookEventName[] | undefined,
      isActive: patch.isActive,
    },
    c.env.DATA_ENCRYPTION_KEY
  );

  log.info('Webhook updated', { teamId, webhookId });

  return c.json(
    {
      success: true as const,
      webhook: {
        ...webhook,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
      },
    },
    200
  );
});

// ---------------------------------------------------------------------------
// DELETE /:teamId/webhooks/:webhookId — remove a webhook
// ---------------------------------------------------------------------------

const deleteWebhookRoute = createRoute({
  method: 'delete',
  path: '/:teamId/webhooks/:webhookId',
  request: {
    params: z.object({
      teamId: z.string().regex(/^\d+$/),
      webhookId: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: 'Webhook deleted',
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(true) }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Insufficient permissions' },
    404: { description: 'Webhook not found' },
  },
});

userWebhookRouter.openapi(deleteWebhookRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const teamId = parseInt(c.req.param('teamId'), 10);
  const webhookId = parseInt(c.req.param('webhookId'), 10);

  await webhookRepository.delete(webhookId, teamId);

  log.info('Webhook deleted', { teamId, webhookId });

  return c.json({ success: true as const }, 200);
});

// ---------------------------------------------------------------------------
// POST /:teamId/webhooks/:webhookId/rotate-secret — rotate signing secret
// ---------------------------------------------------------------------------

const rotateSecretRoute = createRoute({
  method: 'post',
  path: '/:teamId/webhooks/:webhookId/rotate-secret',
  request: {
    params: z.object({
      teamId: z.string().regex(/^\d+$/),
      webhookId: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: 'Secret rotated. New plaintext shown once — store it securely.',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            secretPlaintext: z.string(),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Insufficient permissions' },
    404: { description: 'Webhook not found' },
  },
});

userWebhookRouter.openapi(rotateSecretRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const teamId = parseInt(c.req.param('teamId'), 10);
  const webhookId = parseInt(c.req.param('webhookId'), 10);

  const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await webhookRepository.update(webhookId, teamId, { secret: newSecret }, c.env.DATA_ENCRYPTION_KEY);

  log.info('Webhook secret rotated', { teamId, webhookId });

  return c.json({ success: true as const, secretPlaintext: newSecret }, 200);
});

export default userWebhookRouter;
