import { OpenAPIHono } from '@hono/zod-openapi';
import { logger } from './utils/logger.js';
import { ApiError, formatErrorResponse } from './utils/errors.js';
import { createDb, setDb } from './db/index.js';
import { swaggerUI } from '@hono/swagger-ui';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { WorkerBindings } from './types/bindings.js';

import authRouter from './routes/auth.routes.js';
import webhookRouter from './routes/webhook.routes.js';
import wsRouter from './routes/ws.routes.js';

const app = new OpenAPIHono<{ Bindings: WorkerBindings }>();

// Request logging
app.use('*', async (c, next) => {
  logger.info('Incoming Request', { method: c.req.method, path: c.req.path });
  await next();
});

// DB initialisation — guards against missing binding so app.fetch() works in tests
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
