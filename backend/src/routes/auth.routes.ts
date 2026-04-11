import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { authService } from '../services/authService.js';
import type { WorkerBindings } from '../types/bindings.js';

type Variables = { requestId: string };

const authRouter = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: Variables }>();

/**
 * Validates the embedded signup callback body from the Meta JS SDK.
 */
const embeddedSignupSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  wabaId: z.string().min(1, 'WABA ID is required'),
  phoneNumberId: z.string().min(1, 'Phone Number ID is required'),
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
    500: { description: 'META_APP_ID or META_APP_SECRET binding not configured' },
    502: { description: 'Upstream error from Meta Graph API' },
  },
});

authRouter.openapi(embeddedSignupRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const { code, wabaId, phoneNumberId } = c.req.valid('json');

  log.info('Embedded signup callback received', { wabaId, phoneNumberId });

  const { META_APP_ID: clientId, META_APP_SECRET: clientSecret } = c.env;

  if (!clientId || !clientSecret) {
    throw new ApiError(
      500,
      'META_APP_ID or META_APP_SECRET binding is not configured',
      'MISSING_ENV_BINDINGS'
    );
  }

  await authService.exchangeToken(
    code,
    wabaId,
    phoneNumberId,
    clientId,
    clientSecret,
    c.env.DATA_ENCRYPTION_KEY
  );

  log.info('Channel connected successfully', { wabaId, phoneNumberId });

  return c.json(
    { success: true, message: 'WhatsApp channel connected successfully.' },
    200
  );
});

// 20 req/min — tighter than the global limit since this hits Meta's API
authRouter.use('/embedded-signup', rateLimiter(20));

export default authRouter;
