import { OpenAPIHono } from '@hono/zod-openapi';
import { createLogger, logger } from './utils/logger.js';
import { ApiError, formatErrorResponse } from './utils/errors.js';
import { createDb, setDb } from './db/index.js';
import { validateEnv } from './utils/validateEnv.js';
import { swaggerUI } from '@hono/swagger-ui';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { WorkerBindings } from './types/bindings.js';

import authRouter from './routes/auth.routes.js';
import webhookRouter from './routes/webhook.routes.js';
import wsRouter from './routes/ws.routes.js';

// ---------------------------------------------------------------------------
// Hono type extensions
// ---------------------------------------------------------------------------
type Variables = {
  requestId: string;
};

const app = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: Variables }>();

// ---------------------------------------------------------------------------
// Middleware — runs in order on every request
// ---------------------------------------------------------------------------

// 1. Assign a unique ID to this request for log correlation
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  await next();
});

// 2. Validate all required bindings are present — fail fast with 503
app.use('*', async (c, next) => {
  if (c.env?.DATABASE_URL) {
    // Only validate when env is present (skips test env where app.fetch has no env)
    validateEnv(c.env);
  }
  await next();
});

// 3. DB initialisation — safe to call on every request (Proxy is idempotent)
app.use('*', async (c, next) => {
  if (c.env?.DATABASE_URL) {
    setDb(createDb(c.env.DATABASE_URL));
  }
  await next();
});

// 4. Structured request logging with correlation ID
app.use('*', async (c, next) => {
  const log = createLogger({ requestId: c.get('requestId') });
  log.info('Incoming Request', { method: c.req.method, path: c.req.path });
  await next();
});

// ---------------------------------------------------------------------------
// Error handlers
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  const requestId = c.get('requestId');
  logger.error('Unhandled Exception', {
    requestId,
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

app.doc('/doc', {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: 'WhatFlow API' },
});
app.get('/ui', swaggerUI({ url: '/doc' }));
app.get('/', (c) => c.json({ success: true, message: 'Whatflow API Online' }));

export { InboxSync } from './durable_objects/InboxSync.js';
export default app;
