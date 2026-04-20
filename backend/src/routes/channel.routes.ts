import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createLogger } from '../utils/logger.js';
import { type DrizzleDb } from '../db/index.js';
import { channels } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { WorkerBindings } from '../types/bindings.js';
import { getTemplates } from '../utils/metaApiClient.js';
import { decrypt } from '../utils/encryption.js';
import { ApiError } from '../utils/errors.js';

type Variables = { 
  requestId: string; 
  userId: string; 
  userEmail: string; 
  teamId: string;
  db: DrizzleDb;
};

const channelRouter = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: Variables }>();

channelRouter.use('*', async (c, next) => {
  if (!c.get('db') && c.env?.HYPERDRIVE) {
    const { createDb } = await import('../db/index.js');
    c.set('db', createDb(c.env.HYPERDRIVE.connectionString));
  }
  await next();
});

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const ChannelRowSchema = z.object({
  id: z.number(),
  teamId: z.number(),
  type: z.enum(['sim', 'business_app']),
  phoneNumber: z.string().nullable(),
  businessName: z.string().nullable(),
  whatsappId: z.string().nullable(),
  wabaId: z.string().nullable(),
  status: z.enum(['active', 'paused', 'disabled']),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// GET /:teamId/channels — list all channels for a team
// ---------------------------------------------------------------------------

const listChannelsRoute = createRoute({
  method: 'get',
  path: '/:teamId/channels',
  request: {
    params: z.object({ teamId: z.string().regex(/^\d+$/) }),
  },
  responses: {
    200: {
      description: 'List of WhatsApp channels for the team',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            channels: z.array(ChannelRowSchema),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Insufficient permissions' },
  },
});

channelRouter.openapi(listChannelsRoute, async (c) => {
  const db = c.get('db');
  const log = createLogger({ requestId: c.get('requestId') });
  const teamId = parseInt(c.req.param('teamId'), 10);

  // Auth check handled by middleware later, but for now we rely on the same logic as user.routes
  // Note: we don't have separate per-route middleware in this file yet so we'll wrap the logic
  
  const rows = await db
    .select()
    .from(channels)
    .where(eq(channels.teamId, teamId));

  log.info('Channels listed', { teamId, count: rows.length });

  return c.json(
    {
      success: true as const,
      channels: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    200
  );
});

// ---------------------------------------------------------------------------
// DELETE /:teamId/channels/:channelId — disconnect/delete a channel
// ---------------------------------------------------------------------------

const deleteChannelRoute = createRoute({
  method: 'delete',
  path: '/:teamId/channels/:channelId',
  request: {
    params: z.object({
      teamId: z.string().regex(/^\d+$/),
      channelId: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: 'Channel disconnected successfully',
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(true) }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Insufficient permissions' },
    404: { description: 'Channel not found' },
  },
});

channelRouter.openapi(deleteChannelRoute, async (c) => {
  const db = c.get('db');
  const log = createLogger({ requestId: c.get('requestId') });
  const teamId = parseInt(c.req.param('teamId'), 10);
  const channelId = parseInt(c.req.param('channelId'), 10);

  const result = await db
    .delete(channels)
    .where(and(eq(channels.id, channelId), eq(channels.teamId, teamId)))
    .returning();

  if (result.length === 0) {
    throw new ApiError(404, 'Channel not found or not owned by team', 'CHANNEL_NOT_FOUND');
  }

  log.info('Channel disconnected', { teamId, channelId });

  return c.json({ success: true as const }, 200);
});

// ---------------------------------------------------------------------------
// GET /:teamId/channels/:channelId/templates — fetch templates from Meta
// ---------------------------------------------------------------------------

const listTemplatesRoute = createRoute({
  method: 'get',
  path: '/:teamId/channels/:channelId/templates',
  request: {
    params: z.object({
      teamId: z.string().regex(/^\d+$/),
      channelId: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: 'List of approved WhatsApp message templates',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            templates: z.array(z.any()),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Insufficient permissions' },
    404: { description: 'Channel not found' },
    500: { description: 'Internal server error' },
  },
});

channelRouter.openapi(listTemplatesRoute, async (c) => {
  const db = c.get('db');
  const log = createLogger({ requestId: c.get('requestId') });
  const teamId = parseInt(c.req.param('teamId'), 10);
  const channelId = parseInt(c.req.param('channelId'), 10);

  // 1. Fetch channel details
  const [channel] = await db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.teamId, teamId)))
    .limit(1);

  if (!channel) {
    throw new ApiError(404, 'Channel not found or not owned by team', 'CHANNEL_NOT_FOUND');
  }

  if (!channel.wabaId) {
    throw new ApiError(422, 'This channel does not have a linked WABA ID', 'CHANNEL_MISCONFIGURED');
  }

  // 2. Decrypt token and fetch templates
  const accessToken = await decrypt(channel.accessToken, c.env.DATA_ENCRYPTION_KEY);
  const templates = await getTemplates({
    wabaId: channel.wabaId,
    accessToken,
  });

  log.info('Templates fetched from Meta', { teamId, channelId, count: templates.length });

  return c.json({ success: true as const, templates }, 200);
});

// Apply auth/role middleware to all routes
channelRouter.use('/:teamId/*', requireAuth);
channelRouter.use('/:teamId/*', requireRole('admin', 'developer'));

export default channelRouter;
