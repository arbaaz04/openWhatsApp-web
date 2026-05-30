/**
 * @file /api/conversations routes — paginated history and outbound messaging.
 *
 * Both routes are gated behind `requireAuth`. Ownership of a conversation is
 * asserted via a DB join (conversation → channel → teamId) so an authenticated
 * user from a different team cannot read or write to another team's conversations.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLogger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { type DrizzleDb } from '../db/index.js';
import { conversations, channels, teamMembers } from '../db/schema.js';
import { messageRepository } from '../repositories/messageRepository.js';
import { sendWhatsAppMessage } from '../utils/metaApiClient.js';
import { decrypt } from '../utils/encryption.js';
import { eq, and, desc } from 'drizzle-orm';
import type { WorkerBindings } from '../types/bindings.js';

type Variables = {
  requestId: string;
  userId: string;
  userEmail: string;
  teamId: string;
  db: DrizzleDb;
};

const conversationRouter = new OpenAPIHono<{
  Bindings: WorkerBindings;
  Variables: Variables;
}>();

conversationRouter.use('*', async (c, next) => {
  if (!c.get('db') && c.env?.HYPERDRIVE) {
    const { createDb } = await import('../db/index.js');
    c.set('db', createDb(c.env.HYPERDRIVE.connectionString));
  }
  await next();
});

// ---------------------------------------------------------------------------
// Shared middleware — all /api/conversations routes require authentication
// ---------------------------------------------------------------------------

conversationRouter.use('*', requireAuth);

// 60 req/min per IP for outbound sends only.
const sendMessageRateLimiter = rateLimiter(60);
conversationRouter.use('/:conversationId/messages', async (c, next) => {
  if (c.req.method !== 'POST') {
    await next();
    return;
  }
  await sendMessageRateLimiter(c, next);
});

// ---------------------------------------------------------------------------
// Shared ownership helper — resolves conversation and enforces team boundary
// ---------------------------------------------------------------------------

/**
 * Loads the conversation + channel in a single join and verifies the caller
 * belongs to the team that owns the channel.
 *
 * @throws {ApiError 404} conversation does not exist
 * @throws {ApiError 403} caller's team does not own the conversation
 */
async function resolveAndAuthorize(
  db: DrizzleDb,
  conversationId: number,
  callerUserId: string
): Promise<{
  id: number;
  teamId: number;
  channelId: number;
  customerNumber: string;
  whatsappId: string | null;
  accessToken: string;
  lastCustomerMessageAt: Date | null;
}> {
  const [row] = await db
    .select({
      id: conversations.id,
      teamId: channels.teamId,
      channelId: channels.id,
      customerNumber: conversations.customerNumber,
      whatsappId: channels.whatsappId,
      accessToken: channels.accessToken,
      lastCustomerMessageAt: conversations.lastCustomerMessageAt,
    })
    .from(conversations)
    .innerJoin(channels, eq(channels.id, conversations.channelId))
    .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
    .where(and(eq(conversations.id, conversationId), eq(teamMembers.userId, callerUserId)))
    .limit(1);

  if (!row) {
    throw new ApiError(404, 'Conversation not found', 'NOT_FOUND');
  }

  return row;
}

// ---------------------------------------------------------------------------
// GET / — list conversations for the authenticated user
// ---------------------------------------------------------------------------

const listConversationsRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      limit: z.string().regex(/^\d+$/).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Conversations visible to the authenticated user, newest activity first.',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            conversations: z.array(
              z.object({
                id: z.number(),
                channelId: z.number(),
                customerNumber: z.string(),
                whatsappId: z.string().nullable(),
                isWindowOpen: z.boolean().nullable(),
                lastCustomerMessageAt: z.string().nullable(),
                createdAt: z.string(),
              })
            ),
          }),
        },
      },
    },
    401: { description: 'Unauthorized — missing or invalid JWT' },
  },
});

conversationRouter.openapi(listConversationsRoute, async (c) => {
  const db = c.get('db');
  const log = createLogger({ requestId: c.get('requestId') });
  const userId = c.get('userId');
  const { limit } = c.req.valid('query');
  const pageSize = Math.min(parseInt(limit ?? '50', 10), 100);

  const rows = await db
    .select({
      id: conversations.id,
      channelId: conversations.channelId,
      customerNumber: conversations.customerNumber,
      whatsappId: channels.whatsappId,
      isWindowOpen: conversations.isWindowOpen,
      lastCustomerMessageAt: conversations.lastCustomerMessageAt,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .innerJoin(channels, eq(channels.id, conversations.channelId))
    .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
    .where(eq(teamMembers.userId, userId))
    .orderBy(desc(conversations.lastCustomerMessageAt), desc(conversations.id))
    .limit(pageSize);

  log.info('Conversations list served', { userId, count: rows.length, limit: pageSize });

  return c.json({
    success: true as const,
    conversations: rows.map((row) => {
      const isWindowOpen = row.lastCustomerMessageAt
        ? (Date.now() - new Date(row.lastCustomerMessageAt).getTime()) < 24 * 60 * 60 * 1000
        : false;
      return {
        id: row.id,
        channelId: row.channelId,
        customerNumber: row.customerNumber,
        whatsappId: row.whatsappId,
        isWindowOpen,
        lastCustomerMessageAt: row.lastCustomerMessageAt
          ? row.lastCustomerMessageAt.toISOString()
          : null,
        createdAt: row.createdAt.toISOString(),
      };
    }),
  }, 200);
});

// ---------------------------------------------------------------------------
// GET /:conversationId — get conversation details
// ---------------------------------------------------------------------------

const getConversationRoute = createRoute({
  method: 'get',
  path: '/:conversationId',
  request: {
    params: z.object({
      conversationId: z.string().regex(/^\d+$/, 'Must be a numeric ID'),
    }),
  },
  responses: {
    200: {
      description: 'Conversation metadata.',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            conversation: z.object({
              id: z.number(),
              teamId: z.number(),
              channelId: z.number(),
              customerNumber: z.string(),
              whatsappId: z.string().nullable(),
              isWindowOpen: z.boolean(),
              lastCustomerMessageAt: z.string().nullable(),
            }),
          }),
        },
      },
    },
    401: { description: 'Unauthorized — missing or invalid JWT' },
    403: { description: "Conversation does not belong to the caller's team" },
    404: { description: 'Conversation not found' },
  },
});

conversationRouter.openapi(getConversationRoute, async (c) => {
  const db = c.get('db');
  const conversationId = parseInt(c.req.param('conversationId'), 10);
  const userId = c.get('userId');

  const row = await resolveAndAuthorize(db, conversationId, userId);

  const isWindowOpen = row.lastCustomerMessageAt
    ? (Date.now() - new Date(row.lastCustomerMessageAt).getTime()) < 24 * 60 * 60 * 1000
    : false;

  return c.json({
    success: true as const,
    conversation: {
      id: row.id,
      teamId: row.teamId,
      channelId: row.channelId,
      customerNumber: row.customerNumber,
      whatsappId: row.whatsappId,
      isWindowOpen,
      lastCustomerMessageAt: row.lastCustomerMessageAt
        ? row.lastCustomerMessageAt.toISOString()
        : null,
    },
  }, 200);
});

// ---------------------------------------------------------------------------
// GET /:conversationId/messages — cursor-based pagination
// ---------------------------------------------------------------------------

const listMessagesRoute = createRoute({
  method: 'get',
  path: '/:conversationId/messages',
  request: {
    params: z.object({
      conversationId: z.string().regex(/^\d+$/, 'Must be a numeric ID'),
    }),
    query: z.object({
      /**
       * Exclusive upper-bound cursor — pass the smallest `id` from the previous page.
       * Omit for the first request (returns the most recent messages).
       */
      before: z.string().regex(/^\d+$/).optional(),
      /**
       * Page size. Default: 50. Max: 200.
       * Clients should use the default unless they have a specific UX reason for a larger page.
       */
      limit: z.string().regex(/^\d+$/).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Paginated message list ordered newest-first. Reverse before rendering.',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            conversationId: z.number(),
            messages: z.array(
              z.object({
                id: z.number(),
                body: z.string().nullable(),
                direction: z.enum(['incoming', 'outgoing', 'echo']),
                status: z.string().nullable(),
                externalId: z.string().nullable(),
                createdAt: z.string().describe('ISO-8601 UTC timestamp'),
              })
            ),
            /** True when an earlier page exists. Use `nextCursor` to fetch it. */
            hasMore: z.boolean(),
            /**
             * Pass this value as `?before=<cursor>` to fetch the next (older) page.
             * Null when `hasMore` is false.
             */
            nextCursor: z.number().nullable(),
          }),
        },
      },
    },
    401: { description: 'Unauthorized — missing or invalid JWT' },
    403: { description: "Conversation does not belong to the caller's team" },
    404: { description: 'Conversation not found' },
  },
});

conversationRouter.openapi(listMessagesRoute, async (c) => {
  const db = c.get('db');
  const log = createLogger({ requestId: c.get('requestId') });
  const conversationId = parseInt(c.req.param('conversationId'), 10);
  const { before, limit } = c.req.valid('query');

  // Authorize based on userId since conversations span all teams a user belongs to
  await resolveAndAuthorize(db, conversationId, c.get('userId'));

  const { items, hasMore } = await messageRepository.listMessages(db, conversationId, {
    before: before !== undefined ? parseInt(before, 10) : undefined,
    limit: limit !== undefined ? parseInt(limit, 10) : undefined,
  });

  const nextCursor = hasMore && items.length > 0
    ? items[items.length - 1].id
    : null;

  log.info('Messages page served', {
    conversationId,
    count: items.length,
    hasMore,
    cursor: before,
  });

  return c.json({
    success: true as const,
    conversationId,
    messages: items.map((m) => ({
      id: m.id,
      body: m.body,
      direction: m.direction,
      status: m.status,
      externalId: m.externalId,
      createdAt: m.createdAt.toISOString(),
    })),
    hasMore,
    nextCursor,
  }, 200);
});

// ---------------------------------------------------------------------------
// POST /:conversationId/messages — send an outbound message
// ---------------------------------------------------------------------------

const sendMessageBody = z.object({
  /** Type of message to send, defaults to text */
  type: z.enum([
    'text', 'image', 'document', 'audio', 'video', 'sticker', 
    'location', 'contacts', 'interactive', 'template'
  ]).default('text'),
  
  /**
   * Message body fallback text. For text messages, this is the message.
   * For other messages, this acts as an internal fallback / summary in the DB.
   */
  body: z
    .string()
    .min(1, 'Message body cannot be empty')
    .max(4000, 'Message body cannot exceed 4000 characters')
    .transform((s) => s.trim()),

  /**
   * The actual Meta payload object for rich messages.
   * e.g., { text: { body: "hi" } } or { image: { id: "..." } } or { interactive: { ... } }
   * If omitted, a basic text payload is auto-generated for 'text' type.
   */
  payload: z.record(z.string(), z.unknown()).optional(),
});

const sendMessageRoute = createRoute({
  method: 'post',
  path: '/:conversationId/messages',
  request: {
    params: z.object({
      conversationId: z.string().regex(/^\d+$/, 'Must be a numeric ID'),
    }),
    body: {
      content: { 'application/json': { schema: sendMessageBody } },
    },
  },
  responses: {
    201: {
      description: 'Message accepted by Meta and persisted.',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            messageId: z.number().describe('Internal DB message ID'),
            wamid: z.string().describe('WhatsApp message ID returned by Meta'),
          }),
        },
      },
    },
    400: { description: 'Invalid request body' },
    401: { description: 'Unauthorized — missing or invalid JWT' },
    403: { description: "Conversation does not belong to the caller's team" },
    404: { description: 'Conversation not found' },
    422: { description: 'Meta rejected the message (e.g. window closed, invalid number)' },
    429: { description: 'Meta rate limit hit — back off and retry' },
    503: { description: 'Meta API temporarily unavailable' },
  },
});

conversationRouter.openapi(sendMessageRoute, async (c) => {
  const db = c.get('db');
  const log = createLogger({ requestId: c.get('requestId') });
  const userId = c.get('userId');
  const conversationId = parseInt(c.req.param('conversationId'), 10);
  const { type, body, payload } = c.req.valid('json');

  // 1. Resolve conversation and enforce team ownership in one DB query
  const row = await resolveAndAuthorize(db, conversationId, userId);

  // 1.5 Check WhatsApp 24-hour service window expiry
  const isWindowOpen = row.lastCustomerMessageAt
    ? (Date.now() - new Date(row.lastCustomerMessageAt).getTime()) < 24 * 60 * 60 * 1000
    : false;

  if (!isWindowOpen && type !== 'template') {
    throw new ApiError(
      422,
      'The 24-hour WhatsApp messaging window is closed. You must use a template message to initiate conversation.',
      'WINDOW_CLOSED'
    );
  }

  if (!row.whatsappId) {
    throw new ApiError(422, 'This channel does not have a configured WhatsApp phone number ID', 'CHANNEL_MISCONFIGURED');
  }

  // 2. Decrypt the channel's access token (stored AES-256-GCM encrypted)
  const accessToken = await decrypt(row.accessToken, c.env.DATA_ENCRYPTION_KEY);

  // 3. Call the Meta Cloud API — throws MetaApiError on failure
  log.info('Sending outbound WhatsApp message', {
    conversationId,
    phoneNumberId: row.whatsappId,
    recipientNumber: row.customerNumber,
    type,
    hasPayload: !!payload,
    bodyLength: body.length,
  });

  const messagePayload = payload ?? (type === 'text' ? { text: { body, preview_url: false } } : {});

  const { wamid, recipientWaId } = await sendWhatsAppMessage({
    phoneNumberId: row.whatsappId,
    accessToken,
    recipientNumber: row.customerNumber,
    type,
    messagePayload,
  });

  log.info('Message sent via Meta API', {
    conversationId,
    wamid,
    recipientWaId,
  });

  // 4. Persist the outbound message record (after Meta confirms it)
  const { messageId } = await messageRepository.createOutboundMessage(
    db,
    conversationId,
    body,
    wamid,
    userId
  );

  // 5. Broadcast the outbound message to all connected WebSocket clients
  //    so the sender's own UI updates immediately without a page refresh.
  //    Fire-and-forget — we've already committed to the DB; WS failure is non-critical.
  if (c.env.INBOX_SYNC && row.whatsappId) {
    const doId = c.env.INBOX_SYNC.idFromName(row.whatsappId);
    const stub = c.env.INBOX_SYNC.get(doId);
    c.executionCtx?.waitUntil(
      stub.fetch(new Request('http://internal/broadcast', {
        method: 'POST',
        headers: {
          'x-internal-auth': c.env.META_APP_SECRET,
        },
        body: JSON.stringify({
          type: 'outgoing',
          messageId,
          wamid,
          conversationId,
          body,
          direction: 'outgoing',
          status: 'sent',
          timestamp: new Date().toISOString(),
        }),
      })).then(async (res) => {
        if (!res.ok) {
          log.error('Durable Object WS broadcast failed for outbound message', {
            status: res.status,
            body: await res.text()
          });
        }
      }).catch((err: unknown) => {
        log.error('WS broadcast failed for outbound message', {
          conversationId,
          wamid,
          error: err instanceof Error ? err.message : String(err),
        });
      })
    );
  }

  // 6. Dispatch `conversation.message.sent` to user-registered webhooks.
  //    Fire-and-forget via waitUntil so it never blocks the HTTP response.
    if (c.env.DATA_ENCRYPTION_KEY) {
      const { webhookDeliveryService } = await import('../services/webhookDeliveryService.js');
      c.executionCtx?.waitUntil(
        webhookDeliveryService.dispatchEvent({
          eventName: 'conversation.message.sent',
          channelId: row.channelId,
          eventData: {
            conversationId,
            messageId,
            channelId: row.channelId,
            customerNumber: row.customerNumber,
            body,
            direction: 'outgoing',
            wamid,
            timestamp: new Date().toISOString(),
          },
          encryptionKey: c.env.DATA_ENCRYPTION_KEY,
          env: { USER_WEBHOOK_QUEUE: c.env.USER_WEBHOOK_QUEUE },
          db,
        })
      );
    }

  return c.json({ success: true as const, messageId, wamid }, 201);
});

export default conversationRouter;
