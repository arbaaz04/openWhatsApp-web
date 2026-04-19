import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLogger } from '../utils/logger.js';
import { db } from '../db/index.js';
import { messages, conversations, channels, teamMembers } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import type { WorkerBindings } from '../types/bindings.js';

type Variables = { requestId: string; userId: string; userEmail: string; teamId: string };

const dashboardRouter = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: Variables }>();

dashboardRouter.use('*', requireAuth);

// ---------------------------------------------------------------------------
// GET /api/dashboard/stats — aggregate metrics for the dashboard
// ---------------------------------------------------------------------------
const statsRoute = createRoute({
  method: 'get',
  path: '/stats',
  responses: {
    200: {
      description: 'Aggregate dashboard statistics',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            stats: z.object({
              numbersCount: z.number(),
              messagesCount: z.number(),
              inboundCount: z.number(),
              outboundCount: z.number(),
              conversationsCount: z.number(),
              activeConversationsCount: z.number(),
            }),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
});

dashboardRouter.openapi(statsRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const userId = c.get('userId');

  try {
    // Consolidated stats query — executing everything in a single database round-trip
    // to reduce overhead and connection drop risk in Staging.
    const result = await db.select({
      numbersCount: sql<number>`(
        SELECT cast(count(*) as integer)
        FROM "channels"
        INNER JOIN "team_members" ON "team_members"."team_id" = "channels"."team_id"
        WHERE "team_members"."user_id" = ${userId}
      )`,
      conversationsCount: sql<number>`(
        SELECT cast(count(*) as integer)
        FROM "conversations"
        INNER JOIN "channels" ON "channels"."id" = "conversations"."channel_id"
        INNER JOIN "team_members" ON "team_members"."team_id" = "channels"."team_id"
        WHERE "team_members"."user_id" = ${userId}
      )`,
      activeConversationsCount: sql<number>`(
        SELECT cast(count(*) as integer)
        FROM "conversations"
        INNER JOIN "channels" ON "channels"."id" = "conversations"."channel_id"
        INNER JOIN "team_members" ON "team_members"."team_id" = "channels"."team_id"
        WHERE "team_members"."user_id" = ${userId} AND "conversations"."is_window_open" = true
      )`,
      totalMessages: sql<number>`(
        SELECT cast(count(*) as integer)
        FROM "messages"
        INNER JOIN "conversations" ON "conversations"."id" = "messages"."conversation_id"
        INNER JOIN "channels" ON "channels"."id" = "conversations"."channel_id"
        INNER JOIN "team_members" ON "team_members"."team_id" = "channels"."team_id"
        WHERE "team_members"."user_id" = ${userId}
      )`,
      inboundCount: sql<number>`(
        SELECT cast(count(*) as integer)
        FROM "messages"
        INNER JOIN "conversations" ON "conversations"."id" = "messages"."conversation_id"
        INNER JOIN "channels" ON "channels"."id" = "conversations"."channel_id"
        INNER JOIN "team_members" ON "team_members"."team_id" = "channels"."team_id"
        WHERE "team_members"."user_id" = ${userId} AND "messages"."direction" = 'incoming'
      )`,
      outboundCount: sql<number>`(
        SELECT cast(count(*) as integer)
        FROM "messages"
        INNER JOIN "conversations" ON "conversations"."id" = "messages"."conversation_id"
        INNER JOIN "channels" ON "channels"."id" = "conversations"."channel_id"
        INNER JOIN "team_members" ON "team_members"."team_id" = "channels"."team_id"
        WHERE "team_members"."user_id" = ${userId} AND "messages"."direction" = 'outgoing'
      )`,
    }).from(sql`(SELECT 1) as dual`);

    const stats = {
      numbersCount: result[0]?.numbersCount ?? 0,
      conversationsCount: result[0]?.conversationsCount ?? 0,
      activeConversationsCount: result[0]?.activeConversationsCount ?? 0,
      messagesCount: result[0]?.totalMessages ?? 0,
      inboundCount: result[0]?.inboundCount ?? 0,
      outboundCount: result[0]?.outboundCount ?? 0,
    };

    log.info('Dashboard stats served', { userId, stats });
    return c.json({ success: true, stats }, 200);
  } catch (err) {
    log.error('Failed to fetch dashboard stats; returning fallback zeros', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    
    // Return zeros so the frontend doesn't crash on DB hiccups
    return c.json({
      success: true,
      stats: {
        numbersCount: 0,
        messagesCount: 0,
        inboundCount: 0,
        outboundCount: 0,
        conversationsCount: 0,
        activeConversationsCount: 0,
      }
    }, 200);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/recent-messages — last 10 messages across all channels
// ---------------------------------------------------------------------------
const recentMessagesRoute = createRoute({
  method: 'get',
  path: '/recent-messages',
  responses: {
    200: {
      description: 'Recent message list',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            messages: z.array(z.object({
              id: z.number(),
              phone: z.string(),
              contact: z.string(),
              direction: z.string(),
              status: z.string().nullable(),
              content: z.string().nullable(),
              createdAt: z.string(),
            })),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
});

dashboardRouter.openapi(recentMessagesRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const userId = c.get('userId');

  try {
    const rows = await db
      .select({
        id: messages.id,
        phone: channels.phoneNumber,
        contact: conversations.customerNumber,
        direction: messages.direction,
        status: messages.status,
        content: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .innerJoin(channels, eq(channels.id, conversations.channelId))
      .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
      .where(eq(teamMembers.userId, userId))
      .orderBy(desc(messages.createdAt))
      .limit(10);

    log.info('Recent messages served', { userId, count: rows.length });

    return c.json({
      success: true,
      messages: rows.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        phone: r.phone ?? 'N/A',
      }))
    }, 200);
  } catch (err) {
    log.error('Failed to fetch recent messages', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ success: true, messages: [] }, 200);
  }
});

export default dashboardRouter;
