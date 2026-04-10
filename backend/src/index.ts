import { OpenAPIHono } from '@hono/zod-openapi'
import { logger } from './utils/logger.js'
import { ApiError, formatErrorResponse } from './utils/errors.js'

/**
 * Main application router incorporating OpenAPI auto-docs
 */
const app = new OpenAPIHono()

// Basic Request Logging Middleware
app.use('*', async (c, next) => {
  logger.info('Incoming Request', { 
    method: c.req.method, 
    path: c.req.path 
  });
  await next();
});

// Global Error Handler maintaining structured error response format
app.onError((err, c) => {
  logger.error('Unhandled Exception', { error: err.message, stack: err.stack });
  
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  return c.json(formatErrorResponse(err), statusCode);
});

// Global 404 Handler
app.notFound((c) => {
  return c.json(formatErrorResponse(new ApiError(404, 'Endpoint not found', 'NOT_FOUND')), 404);
});

app.get('/', (c) => {
  return c.json({ success: true, message: 'Whatflow API Online' });
});

export default app
