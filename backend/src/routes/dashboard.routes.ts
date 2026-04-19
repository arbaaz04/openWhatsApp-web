import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLogger } from '../utils/logger.js';
import { type DrizzleDb } from '../db/index.js';
import { messages, conversations, channels, teamMembers } from '../db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import type { WorkerBindings } from '../types/bindings.js';

type Variables = { requestId: string; userId: string; userEmail: string; teamId: string; db: DrizzleDb };

const dashboardRouter = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: Variables }>();

dashboardRouter.use('*', requireAuth);
dashboardRouter.use('*', async (c, next) => {
  // If db isn't set by the parent app, initialize it locally
  if (!c.get('db') && c.env?.HYPERDRIVE) {
    const { createDb } = await import('../db/index.js');
    c.set('db', createDb(c.env.HYPERDRIVE.connectionString));
  }
  await next();
});

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
  const db = c.get('db');
  const log = createLogger({ requestId: c.get('requestId') });
  const userId = c.get('userId');

  /**
   * Helper to execute a query with an individual timeout.
   * Ensures one slow query doesn't sink the entire dashboard.
   */
  const withTimeout = async <T>(promise: Promise<T>, label: string): Promise<T | null> => {
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        log.warn(`Query timed out: ${label}`);
        resolve(null);
      }, 12000)
    );
    return Promise.race([promise, timeoutPromise]);
  };

  try {
    log.info('Fetching dashboard stats in parallel...');

    // Execute all counters in parallel to minimize total latency
    const results = await Promise.allSettled([
      withTimeout(
        db
          .select({ count: sql<number>`cast(count(*) as integer)` })
          .from(channels)
          .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
          .where(eq(teamMembers.userId, userId)),
        'numbersCount'
      ),
      withTimeout(
        db
          .select({ count: sql<number>`cast(count(*) as integer)` })
          .from(conversations)
          .innerJoin(channels, eq(channels.id, conversations.channelId))
          .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
          .where(eq(teamMembers.userId, userId)),
        'conversationsCount'
      ),
      withTimeout(
        db
          .select({
            count: sql<number>`cast(count(*) as integer)`,
          })
          .from(conversations)
          .innerJoin(channels, eq(channels.id, conversations.channelId))
          .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
          .where(and(eq(teamMembers.userId, userId), eq(conversations.isWindowOpen, true))),
        'activeConversationsCount'
      ),
      withTimeout(
        db
          .select({
            total: sql<number>`cast(count(*) as integer)`,
            inbound: sql<number>`cast(count(case when ${messages.direction} = 'incoming' then 1 end) as integer)`,
            outbound: sql<number>`cast(count(case when ${messages.direction} = 'outgoing' then 1 end) as integer)`,
          })
          .from(messages)
          .innerJoin(conversations, eq(conversations.id, messages.conversationId))
          .innerJoin(channels, eq(channels.id, conversations.channelId))
          .innerJoin(teamMembers, eq(teamMembers.teamId, channels.teamId))
          .where(eq(teamMembers.userId, userId)),
        'messageStats'
      ),
    ]);

    // Extract values with safe fallbacks for failures or timeouts
    const [numbersRes, convsRes, activeConvsRes, messageStatsRes] = results;

    const stats = {
      numbersCount: (numbersRes.status === 'fulfilled' ? numbersRes.value?.[0]?.count : 0) ?? 0,
      conversationsCount: (convsRes.status === 'fulfilled' ? convsRes.value?.[0]?.count : 0) ?? 0,
      activeConversationsCount:
        (activeConvsRes.status === 'fulfilled' ? activeConvsRes.value?.[0]?.count : 0) ?? 0,
      messagesCount:
        (messageStatsRes.status === 'fulfilled' ? messageStatsRes.value?.[0]?.total : 0) ?? 0,
      inboundCount:
        (messageStatsRes.status === 'fulfilled' ? messageStatsRes.value?.[0]?.inbound : 0) ?? 0,
      outboundCount:
        (messageStatsRes.status === 'fulfilled' ? messageStatsRes.value?.[0]?.outbound : 0) ?? 0,
    };

    log.info('Dashboard stats served', { userId, stats });
    return c.json({ success: true, stats }, 200);
  } catch (err) {
    log.error('Critical failure in dashboard stats', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });

    return c.json(
      {
        success: true,
        stats: {
          numbersCount: 0,
          messagesCount: 0,
          inboundCount: 0,
          outboundCount: 0,
          conversationsCount: 0,
          activeConversationsCount: 0,
        },
      },
      200
    );
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
  const db = c.get('db');
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
