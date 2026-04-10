import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { authService } from '../services/authService.js';

interface AuthBindings {
  META_APP_ID: string;
  META_APP_SECRET: string;
}

const authRouter = new OpenAPIHono<{ Bindings: AuthBindings }>();

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
    502: { description: 'Upstream error from Meta Graph API' },
    500: { description: 'Internal Server Error' },
  },
});

authRouter.openapi(embeddedSignupRoute, async (c) => {
  const { code, wabaId, phoneNumberId } = c.req.valid('json');

  logger.info('Embedded signup callback received', { wabaId, phoneNumberId });

  // Credentials come from Cloudflare env bindings — never hardcoded or process.env
  const clientId = c.env.META_APP_ID;
  const clientSecret = c.env.META_APP_SECRET;

  if (!clientId || !clientSecret) {
    throw new ApiError(
      500,
      'META_APP_ID or META_APP_SECRET binding is not configured',
      'MISSING_ENV_BINDINGS'
    );
  }

  await authService.exchangeToken(code, wabaId, phoneNumberId, clientId, clientSecret);

  return c.json(
    { success: true, message: 'WhatsApp channel connected successfully.' },
    200
  );
});

// Rate-limit the auth endpoint — 20 req/min per IP
authRouter.use('/embedded-signup', rateLimiter(20));

export default authRouter;
