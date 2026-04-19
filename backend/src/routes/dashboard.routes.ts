import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLogger } from '../utils/logger.js';
import { db } from '../db/index.js';
import { messages, conversations, channels, teamMembers } from '../db/schema.js';
import { eq, and, desc, sql, count } from 'drizzle-orm';
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

  // Enforce team-based visibility: User can see stats for all teams they belong to.
  // We'll simplify for now: assume user wants stats for ALL their teams.
  
  // 1. Count phone numbers (channels)
  log.info('Fetching numbersCount...');
  const [numbers] = await db
    .select({ count: count() })
    .from(channels)
    .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
    .where(eq(teamMembers.userId, userId));

  // 2. Count conversations
  log.info('Fetching conversationsCount...');
  const [convs] = await db
    .select({ count: count() })
    .from(conversations)
    .innerJoin(channels, eq(channels.id, conversations.channelId))
    .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
    .where(eq(teamMembers.userId, userId));

  // 3. Count active conversations (window open)
  log.info('Fetching activeConversationsCount...');
  const [activeConvs] = await db
    .select({ count: count() })
    .from(conversations)
    .innerJoin(channels, eq(channels.id, conversations.channelId))
    .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
    .where(and(eq(teamMembers.userId, userId), eq(conversations.isWindowOpen, true)));

  // 4. Count messages (total, inbound, outbound)
  log.info('Fetching messageStats...');
  const messageStats = await db
    .select({
      total: count(),
      inbound: sql<number>`cast(count(case when ${messages.direction} = 'incoming' then 1 end) as integer)`,
      outbound: sql<number>`cast(count(case when ${messages.direction} = 'outgoing' then 1 end) as integer)`,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .innerJoin(channels, eq(channels.id, conversations.channelId))
    .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
    .where(eq(teamMembers.userId, userId));

  const stats = {
    numbersCount: Number(numbers?.count ?? 0),
    conversationsCount: Number(convs?.count ?? 0),
    activeConversationsCount: Number(activeConvs?.count ?? 0),
    messagesCount: Number(messageStats[0]?.total ?? 0),
    inboundCount: Number(messageStats[0]?.inbound ?? 0),
    outboundCount: Number(messageStats[0]?.outbound ?? 0),
  };

  log.info('Dashboard stats served', { userId, stats });

  return c.json({ success: true, stats }, 200);
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
});

export default dashboardRouter;
