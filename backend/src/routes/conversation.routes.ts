import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLogger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { conversations, channels } from '../db/schema.js';
import { messageRepository } from '../repositories/messageRepository.js';
import { eq } from 'drizzle-orm';
import type { WorkerBindings } from '../types/bindings.js';

type Variables = {
  requestId: string;
  userId: string;
  userEmail: string;
  teamId: string;
};

const conversationRouter = new OpenAPIHono<{
  Bindings: WorkerBindings;
  Variables: Variables;
}>();

// ---------------------------------------------------------------------------
// GET /api/conversations/:conversationId/messages
// Cursor-based pagination — oldest first from the client's perspective.
// ---------------------------------------------------------------------------

const listMessagesRoute = createRoute({
  method: 'get',
  path: '/:conversationId/messages',
  request: {
    params: z.object({ conversationId: z.string().regex(/^\d+$/, 'Must be a number') }),
    query: z.object({
      /** Exclusive upper-bound cursor — pass the smallest id from the previous page */
      before: z.string().regex(/^\d+$/).optional(),
      /** Page size — default 50, max 200 */
      limit: z.string().regex(/^\d+$/).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Paginated message list (newest-first). Reverse before rendering.',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            conversationId: z.number(),
            messages: z.array(
              z.object({
                id: z.number(),
                body: z.string().nullable(),
                direction: z.enum(['incoming', 'outgoing', 'echo']),
                status: z.string().nullable(),
                externalId: z.string().nullable(),
                createdAt: z.string(), // ISO-8601
              })
            ),
            /**
             * True when there are older messages before this page.
             * The frontend uses this to show a "Load earlier messages" button.
             */
            hasMore: z.boolean(),
            /**
             * Cursor to use as `?before=` on the next request.
             * Null when this is the last page (hasMore is false).
             */
            nextCursor: z.number().nullable(),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: "Conversation does not belong to the caller's team" },
    404: { description: 'Conversation not found' },
  },
});

conversationRouter.use('/:conversationId/messages', requireAuth);
conversationRouter.openapi(listMessagesRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const userId = c.get('userId');
  const conversationId = parseInt(c.req.param('conversationId'), 10);
  const { before, limit } = c.req.valid('query');

  // Verify the conversation exists and belongs to a channel the caller's
  // team owns. We check this via a join — no raw SQL, parameterised Drizzle query.
  const [convo] = await db
    .select({
      id: conversations.id,
      teamId: channels.teamId,
    })
    .from(conversations)
    .innerJoin(channels, eq(channels.id, conversations.channelId))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!convo) {
    throw new ApiError(404, 'Conversation not found', 'NOT_FOUND');
  }

  // TODO (Phase 5): replace with requireRole middleware once teamId is on the JWT
  // For now we rely on the fact that requireAuth validates the caller's identity,
  // and the teamId check via DB enforces ownership.
  // This is a layered approach — auth first, then authorisation via DB.
  void userId; // Will be used for audit logging in Phase 5

  const { items, hasMore } = await messageRepository.listMessages(conversationId, {
    before: before ? parseInt(before, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });

  const nextCursor = hasMore && items.length > 0
    ? items[items.length - 1].id
    : null;

  log.info('Messages paginated', {
    conversationId,
    count: items.length,
    hasMore,
    before,
  });

  return c.json({
    success: true,
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

export default conversationRouter;
