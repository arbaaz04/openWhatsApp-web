import { OpenAPIHono } from '@hono/zod-openapi';
import { createLogger, logger } from './utils/logger.js';
import { ApiError, formatErrorResponse } from './utils/errors.js';
import { createDb } from './db/index.js';
import type { DrizzleDb } from './db/index.js';
import { validateEnv } from './utils/validateEnv.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { timeout } from './middleware/timeout.js';
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
import userWebhookRouter from './routes/userWebhook.routes.js';

// ---------------------------------------------------------------------------
// Hono type extensions — Variables available on every request context
// ---------------------------------------------------------------------------
import type { AppVariables } from './types/honoContext.js';

const app = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: AppVariables }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        formatErrorResponse(new ApiError(400, 'Validation failed', 'VALIDATION_ERROR'), false),
        400
      );
    }
  },
  strict: false,
});

// ---------------------------------------------------------------------------
// Middleware — executes in order for every request
// ---------------------------------------------------------------------------

// 1. CORS — prioritize this as #1 so even early errors get correct headers
app.use('*', cors);

// 2. Timeout — catch hangs before the runtime kills the isolate
app.use('*', timeout(20000));

// 3. Assign a unique correlation ID
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  await next();
});

// 4. Security headers
app.use('*', securityHeaders);

// 5. Validate all required env bindings
app.use('*', async (c, next) => {
  validateEnv(c.env);
  await next();
});

// 6. Request body size guard — rejects payloads over 512KB to prevent memory exhaustion
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

// 7. DB initialisation via Hyperdrive — Creates a fresh DB instance for every 
//    single request. This avoids stale connection errors and is the 
//    recommended best-practice for Hyperdrive.
app.use('*', async (c, next) => {
  if (c.env?.HYPERDRIVE) {
    c.set('db', createDb(c.env.HYPERDRIVE.connectionString));
  }
  await next();
});

// 8. Structured request logging with requestId — runs after DB init so
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
  const isProd = c.env.ENVIRONMENT === 'production';
  return c.json(formatErrorResponse(err, isProd), statusCode as ContentfulStatusCode);
});

app.notFound((c) => {
  const isProd = c.env.ENVIRONMENT === 'production';
  return c.json(
    formatErrorResponse(new ApiError(404, 'Endpoint not found', 'NOT_FOUND'), isProd),
    404 as ContentfulStatusCode
  );
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.route('/api/auth', authRouter);
app.route('/api/webhooks', webhookRouter);
app.route('/api/ws', wsRouter);
app.route('/api/users', userRouter);
app.route('/api/conversations', conversationRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/teams', userWebhookRouter);

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

app.get('/api/health/minimal', (c) => c.json({ status: 'ok', db: 'skipped' }, 200));

app.get('/', (c) => c.json({ success: true, message: 'Whatflow API Online' }));

export { InboxSync } from './durable_objects/InboxSync.js';

export default {
  fetch: app.fetch,

  async queue(
    batch: MessageBatch,
    env: WorkerBindings,
    _ctx: ExecutionContext
  ): Promise<void> {
    const queueName: string = (batch as MessageBatch & { queue: string }).queue ?? '';

    // ── User webhook retry queue ──────────────────────────────────────────
    if (queueName.includes('user-webhooks')) {
      const { webhookDeliveryService } = await import('./services/webhookDeliveryService.js');
      const { createDb } = await import('./db/index.js');
      
      // Instantiate DB for this batch if Hyperdrive is available
      const db = env.HYPERDRIVE ? createDb(env.HYPERDRIVE.connectionString) : null;

      for (const message of (batch as MessageBatch<import('./types/webhook.types.js').UserWebhookJob>).messages) {
        if (!db) {
          logger.error('Database connection unavailable for webhook retry processing');
          message.retry();
          continue;
        }

        try {
          await webhookDeliveryService.deliverFromQueue(db, message.body, env);
          message.ack();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.error('User webhook retry job failed — will retry via DLQ', {
            error: errorMessage,
            webhookId: message.body.webhookId,
            attempt: message.body.attempt,
          });
          message.retry();
        }
      }
      return;
    }

    // ── Incoming Meta webhook queue ───────────────────────────────────────
    const { webhookService } = await import('./services/webhookService.js');
    const { createDb } = await import('./db/index.js');
    
    // Instantiate DB for this batch if Hyperdrive is available
    const db = env.HYPERDRIVE ? createDb(env.HYPERDRIVE.connectionString) : null;

    for (const message of (batch as MessageBatch<MetaWebhookPayload>).messages) {
      if (!db) {
        logger.error('Database connection unavailable for queue processing');
        message.retry();
        continue;
      }

      try {
        await webhookService.processPayload(db, message.body, env);
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
