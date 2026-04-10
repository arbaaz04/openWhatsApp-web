import { OpenAPIHono } from '@hono/zod-openapi';
import { logger } from './utils/logger.js';
import { ApiError, formatErrorResponse } from './utils/errors.js';
import { createDb, setDb } from './db/index.js';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import authRouter from './routes/auth.routes.js';
import webhookRouter from './routes/webhook.routes.js';
import wsRouter from './routes/ws.routes.js';
import { swaggerUI } from '@hono/swagger-ui';

// ---------------------------------------------------------------------------
// Cloudflare Workers environment bindings type
// ---------------------------------------------------------------------------
interface WorkerEnv {
  DATABASE_URL: string;
  INBOX_SYNC: DurableObjectNamespace;
  RATE_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}

// ---------------------------------------------------------------------------
// Application router
// ---------------------------------------------------------------------------
const app = new OpenAPIHono<{ Bindings: WorkerEnv }>();

// Request logging middleware
app.use('*', async (c, next) => {
  logger.info('Incoming Request', { method: c.req.method, path: c.req.path });
  await next();
});

// DB initialisation middleware — runs on every request.
// In a warm isolate the Proxy forwards to the same already-set instance.
// Guards against missing env so unit tests using app.request() don't crash.
app.use('*', async (c, next) => {
  if (c.env?.DATABASE_URL) {
    setDb(createDb(c.env.DATABASE_URL));
  }
  await next();
});

// Global error handler
app.onError((err, c) => {
  logger.error('Unhandled Exception', { error: err.message, stack: err.stack });
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  return c.json(formatErrorResponse(err), statusCode as ContentfulStatusCode);
});

// 404 handler
app.notFound((c) =>
  c.json(
    formatErrorResponse(new ApiError(404, 'Endpoint not found', 'NOT_FOUND')),
    404 as ContentfulStatusCode
  )
);

// Routes
app.route('/api/auth', authRouter);
app.route('/api/webhooks', webhookRouter);
app.route('/api/ws', wsRouter);

// OpenAPI docs
app.doc('/doc', {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: 'WhatFlow API' },
});
app.get('/ui', swaggerUI({ url: '/doc' }));

app.get('/', (c) => c.json({ success: true, message: 'Whatflow API Online' }));

export { InboxSync } from './durable_objects/InboxSync.js';
export default app;
