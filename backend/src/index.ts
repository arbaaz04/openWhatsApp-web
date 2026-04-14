import { OpenAPIHono } from '@hono/zod-openapi';
import { createLogger, logger } from './utils/logger.js';
import { ApiError, formatErrorResponse } from './utils/errors.js';
import { createDb, setDb } from './db/index.js';
import { validateEnv } from './utils/validateEnv.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { cors } from './middleware/cors.js';
import { swaggerUI } from '@hono/swagger-ui';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { WorkerBindings } from './types/bindings.js';
import type { MetaWebhookPayload } from './types/webhook.types.js';

import authRouter from './routes/auth.routes.js';
import webhookRouter from './routes/webhook.routes.js';
import wsRouter from './routes/ws.routes.js';
import userRouter from './routes/user.routes.js';
import conversationRouter from './routes/conversation.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';

// ---------------------------------------------------------------------------
// Hono type extensions — Variables available on every request context
// ---------------------------------------------------------------------------
type Variables = {
  /** Unique ID per request for log correlation across the entire middleware chain */
  requestId: string;
  /** Supabase user UUID — set by requireAuth */
  userId: string;
  /** Authenticated user email — set by requireAuth */
  userEmail: string;
  /** Resolved team ID — set by requireRole */
  teamId: string;
};

const app = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: Variables }>();

// ---------------------------------------------------------------------------
// Middleware — executes in order for every request
// ---------------------------------------------------------------------------

// 1. Assign a unique correlation ID before anything else runs
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  await next();
});

// 2. Security headers — applied before route handlers so they're always present
app.use('*', securityHeaders);

// 3. CORS — reject disallowed origins early, before any business logic
app.use('*', cors);

// 4. Validate all required env bindings — fail fast with 503 rather than
//    a confusing 500 deep inside a service call
app.use('*', async (c, next) => {
  validateEnv(c.env);
  await next();
});

// 5. Request body size guard — rejects payloads over 512KB to prevent memory exhaustion
app.use('*', async (c, next) => {
  const MAX_BODY_BYTES = 512 * 1024;
  const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method);

  if (!hasBody) {
    await next();
    return;
  }

  const contentLengthHeader = c.req.header('Content-Length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      throw new ApiError(400, 'Invalid Content-Length header', 'INVALID_CONTENT_LENGTH');
    }
    if (contentLength > MAX_BODY_BYTES) {
      throw new ApiError(413, 'Request body too large (max 512KB)', 'PAYLOAD_TOO_LARGE');
    }
    await next();
    return;
  }

  // Fallback when Content-Length is absent (e.g. chunked requests).
  // Clone preserves the original body stream for downstream route handlers.
  const bodyBytes = await c.req.raw.clone().arrayBuffer();
  if (bodyBytes.byteLength > MAX_BODY_BYTES) {
    throw new ApiError(413, 'Request body too large (max 512KB)', 'PAYLOAD_TOO_LARGE');
  }

  await next();
});

// 6. DB initialisation via Hyperdrive — Hyperdrive pools connections at the
//    Cloudflare edge, so cold-start latency for DB queries is drastically reduced.
app.use('*', async (c, next) => {
  if (c.env?.HYPERDRIVE) {
    setDb(createDb(c.env.HYPERDRIVE.connectionString));
  }
  await next();
});

// 7. Structured request logging with requestId — runs after DB init so
//    we can log a complete picture including durationMs on response
app.use('*', async (c, next) => {
  const log = createLogger(
    { requestId: c.get('requestId') },
    {
      environment: c.env.ENVIRONMENT,
      sinkUrl: c.env.TELEMETRY_URL,
      sinkToken: c.env.TELEMETRY_TOKEN,
    }
  );
  const start = Date.now();
  log.info('Request started', { method: c.req.method, path: c.req.path });
  await next();
  log.info('Request completed', {
    method: c.req.method,
    path: c.req.path,
    statusCode: c.res.status,
    durationMs: Date.now() - start,
  });
});

// ---------------------------------------------------------------------------
// Error handlers
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  logger.error('Unhandled exception', {
    requestId: c.get('requestId'),
    error: err.message,
    stack: err.stack,
  });
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  return c.json(formatErrorResponse(err), statusCode as ContentfulStatusCode);
});

app.notFound((c) =>
  c.json(
    formatErrorResponse(new ApiError(404, 'Endpoint not found', 'NOT_FOUND')),
    404 as ContentfulStatusCode
  )
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.route('/api/auth', authRouter);
app.route('/api/webhooks', webhookRouter);
app.route('/api/ws', wsRouter);
app.route('/api/users', userRouter);
app.route('/api/conversations', conversationRouter);
app.route('/api/dashboard', dashboardRouter);

app.doc('/doc', {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: 'WhatFlow API' },
});
app.get('/ui', swaggerUI({ url: '/doc' }));

app.get('/health/ready', (c) => {
  const checks = {
    envBindings: true,
    queueBinding: !!c.env.WEBHOOK_QUEUE,
    durableObjectBinding: !!c.env.INBOX_SYNC,
    hyperdriveBinding: !!c.env.HYPERDRIVE?.connectionString,
  };

  const allHealthy = Object.values(checks).every(Boolean);

  if (!allHealthy) {
    return c.json(
      {
        success: false,
        status: 'not_ready',
        checks,
      },
      503
    );
  }

  return c.json(
    {
      success: true,
      status: 'ready',
      checks,
      environment: c.env.ENVIRONMENT ?? 'unknown',
      timestamp: new Date().toISOString(),
    },
    200
  );
});

app.get('/', (c) => c.json({ success: true, message: 'Whatflow API Online' }));

export { InboxSync } from './durable_objects/InboxSync.js';

export default {
  fetch: app.fetch,
  
  /**
   * Cloudflare Queue consumer for async processing (e.g. Meta webhooks).
   * Webhooks are fast-acked on the HTTP layer and handled robustly here.
   */
  async queue(
    batch: MessageBatch<MetaWebhookPayload>,
    env: WorkerBindings,
    _ctx: ExecutionContext
  ): Promise<void> {
    if (env.HYPERDRIVE) {
      setDb(createDb(env.HYPERDRIVE.connectionString));
    }

    const { webhookService } = await import('./services/webhookService.js');

    for (const message of batch.messages) {
      try {
        await webhookService.processPayload(message.body, env);
        message.ack();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isClientError = err instanceof ApiError && err.statusCode >= 400 && err.statusCode < 500;

        if (isClientError) {
          logger.error('Queue message dropped due to non-retryable client error', {
            error: errorMessage,
            statusCode: err.statusCode,
            code: err.code,
          });
          message.ack();
          continue;
        }

        logger.error('Queue message processing failed - will retry via DLQ', {
          error: errorMessage,
        });
        message.retry();
      }
    }
  }
};
