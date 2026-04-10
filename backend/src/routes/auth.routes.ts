import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ApiError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { authService } from '../services/authService.js';

const authRouter = new OpenAPIHono();

/**
 * Zod Schema strictly validating the Embedded Signup Callback body
 */
const embeddedSignupSchema = z.object({
  code: z.string().min(1, 'Token code is required'),
  wabaId: z.string().min(1, 'WABA ID is required'),
  phoneNumberId: z.string().min(1, 'Phone Number ID is required'),
});

/**
 * OpenAPI Route Definition for Embedded Signup (Token Exchange)
 */
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
      description: 'Exchange initiated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    400: { description: 'Bad Request' },
    500: { description: 'Internal Server Error' },
  },
});

/**
 * Endpoint to handle the Meta Embedded Signup token exchange callback
 * Enforces rate limiting heavily as this is an auth endpoint.
 */
authRouter.openapi(embeddedSignupRoute, async (c) => {
  const { code, wabaId, phoneNumberId } = c.req.valid('json');

  logger.info('Embedded signup callback received', { code, wabaId, phoneNumberId });

  try {
    // Phase 2 Logic: Retrieve long-lived token via Meta Graph API using the temporary `code`.
    await authService.exchangeToken(
      code,
      wabaId,
      phoneNumberId,
      process.env.META_APP_ID || '',
      process.env.META_APP_SECRET || ''
    );

    return c.json(
      { success: true, message: 'WhatsApp account connection initiated. This may take a moment.' },
      200
    );
  } catch (error: unknown) {
    const errObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed token exchange', { error: errObj.message, wabaId });
    throw new ApiError(
      500,
      'Failed to initiate WhatsApp account connection',
      'TOKEN_EXCHANGE_FAILED'
    );
  }
});

// Apply rate limiting specifically to this auth endpoint
authRouter.use('/embedded-signup', rateLimiter(20));

export default authRouter;
