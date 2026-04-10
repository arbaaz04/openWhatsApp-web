import { describe, it, expect, vi } from 'vitest';
import { logger } from './logger.js';
import { ApiError, formatErrorResponse } from './errors.js';
import { rateLimiter } from './rateLimiter.js';

describe('Global Utils Suite', () => {
  it('should successfully construct and format ApiErrors', () => {
    const error = new ApiError(403, 'Forbidden', 'AUTH_ERROR', { id: 1 });
    expect(error.statusCode).toBe(403);
    
    const fmt = formatErrorResponse(error);
    expect(fmt.success).toBe(false);
    expect((fmt.error as any).code).toBe('AUTH_ERROR');
    expect((fmt.error as any).details).toEqual({ id: 1 });

    const fallback = formatErrorResponse(new Error('Native Crash'));
    expect((fallback.error as any).code).toBe('UNKNOWN_ERROR');
  });

  it('should execute logger methods globally avoiding test-env suppression for errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('Test error trigger', { trigger: true });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    // Note: info, warn, debug naturally bypass logs inside NODE_ENV=test via early return.
    logger.info('Test info trigger');
    logger.warn('Test warn trigger');
    logger.debug('Test debug trigger');
  });

  it('should enforce rate limits correctly via in-memory blocks', async () => {
    const middleware = rateLimiter(2);
    
    const c: any = { req: { header: () => '1.1.1.1' } };
    const next = vi.fn();
    
    await middleware(c, next); // limit 1
    await middleware(c, next); // limit 2
    expect(next).toHaveBeenCalledTimes(2);
    
    await expect(middleware(c, next)).rejects.toThrow(ApiError);
  });
});
