import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { type DrizzleDb } from '../db/index.js';
import { teamMembers } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { authService } from '../services/authService.js';
import type { WorkerBindings } from '../types/bindings.js';

type Variables = { requestId: string; userId: string; userEmail: string; db: DrizzleDb };

const authRouter = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: Variables }>();

authRouter.use('*', async (c, next) => {
  if (!c.get('db') && c.env?.HYPERDRIVE) {
    const { createDb } = await import('../db/index.js');
    c.set('db', createDb(c.env.HYPERDRIVE.connectionString));
  }
  await next();
});

/**
 * Validates the embedded signup callback body from the WhatsApp Embedded Signup flow.
 * Receives: code, wabaId, phoneNumberId from frontend (obtained via postMessage event)
 */
const embeddedSignupSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  teamId: z.number().int().positive('teamId must be a positive integer'),
  wabaId: z.string().min(1, 'wabaId is required'),
  phoneNumberId: z.string().min(1, 'phoneNumberId is required'),
});

const embeddedSignupRoute = createRoute({
  method: 'post',
  path: '/embedded-signup',
  request: {
    body: {
      content: { 'application/json': { schema: embeddedSignupSchema } },
    },
  },
  responses: {
    200: {
      description: 'Token exchanged and channel saved',
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
    },
    400: { description: 'Bad Request — missing or invalid fields' },
    401: { description: 'Unauthorized — missing or invalid JWT' },
    403: { description: 'Authenticated user is not a member of the provided team' },
    500: { description: 'META_APP_ID or META_APP_SECRET binding not configured' },
    502: { description: 'Upstream error from Meta Graph API' },
  },
});

authRouter.use('/embedded-signup', requireAuth);
// 20 req/min — tighter than the global limit since this hits Meta's API
authRouter.use('/embedded-signup', rateLimiter(20));

authRouter.openapi(embeddedSignupRoute, async (c) => {
  const db = c.get('db');
  const log = createLogger({ requestId: c.get('requestId') });
  const userId = c.get('userId');
  const { code, teamId, wabaId, phoneNumberId } = c.req.valid('json');

  log.info('Embedded signup callback received', { teamId, wabaId, phoneNumberId });

  const { META_APP_ID: clientId, META_APP_SECRET: clientSecret } = c.env;

  if (!clientId || !clientSecret) {
    throw new ApiError(
      500,
      'META_APP_ID or META_APP_SECRET binding is not configured',
      'MISSING_ENV_BINDINGS'
    );
  }

  const [membership] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw new ApiError(403, 'You do not have access to this team', 'FORBIDDEN');
  }

  // Exchange token using provided WABA & phone number IDs (no auto-discovery needed)
  await authService.exchangeToken(
    db,
    code,
    teamId,
    clientId,
    clientSecret,
    c.env.DATA_ENCRYPTION_KEY,
    wabaId,
    phoneNumberId
  );

  log.info('Channel connected successfully');

  return c.json(
    { success: true, message: 'WhatsApp channel connected successfully.' },
    200
  );
});

export default authRouter;
