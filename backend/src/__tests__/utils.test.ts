import { describe, it, expect, vi } from 'vitest';
import { logger } from '../utils/logger.js';
import { ApiError, formatErrorResponse } from '../utils/errors.js';
import { rateLimiter } from '../utils/rateLimiter.js';

describe('Utils Suite', () => {
  describe('ApiError + formatErrorResponse', () => {
    it('should produce a structured error response for ApiError', () => {
      const err = new ApiError(403, 'Forbidden', 'AUTH_ERROR', { userId: 42 });
      expect(err.statusCode).toBe(403);

      const fmt = formatErrorResponse(err);
      expect(fmt.success).toBe(false);
      const error = fmt.error as { code: string; message: string; details: unknown };
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.message).toBe('Forbidden');
      expect(error.details).toEqual({ userId: 42 });
    });

    it('should produce UNKNOWN_ERROR for plain Error objects', () => {
      const fmt = formatErrorResponse(new Error('Something failed'));
      const error = fmt.error as { code: string };
      expect(error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Logger', () => {
    it('should write ERROR level logs even in test environment', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('Test error', { key: 'value' });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should suppress INFO/WARN/DEBUG in test environment', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Should be suppressed');
      logger.warn('Also suppressed');
      logger.debug('Also suppressed');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Rate Limiter — local in-memory mode', () => {
    it('should pass requests within limit', async () => {
      const middleware = rateLimiter(3);
      const c = { req: { header: () => '10.0.0.1' }, env: {} } as never;
      const next = vi.fn();

      await middleware(c, next);
      await middleware(c, next);
      await middleware(c, next);

      expect(next).toHaveBeenCalledTimes(3);
    });

    it('should throw ApiError 429 when limit is exceeded', async () => {
      const middleware = rateLimiter(2);
      const c = { req: { header: () => '10.0.0.2' }, env: {} } as never;
      const next = vi.fn();

      await middleware(c, next);
      await middleware(c, next);

      await expect(middleware(c, next)).rejects.toMatchObject({
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    });

    it('should delegate to Cloudflare binding when RATE_LIMITER is present', async () => {
      const middleware = rateLimiter(100);
      const cfLimiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
      const c = { req: { header: () => '10.0.0.3' }, env: { RATE_LIMITER: cfLimiter } } as never;
      const next = vi.fn();

      await middleware(c, next);

      expect(cfLimiter.limit).toHaveBeenCalledWith({ key: '10.0.0.3' });
      expect(next).toHaveBeenCalledOnce();
    });

    it('should throw 429 when Cloudflare binding returns success: false', async () => {
      const middleware = rateLimiter(100);
      const cfLimiter = { limit: vi.fn().mockResolvedValue({ success: false }) };
      const c = { req: { header: () => '10.0.0.4' }, env: { RATE_LIMITER: cfLimiter } } as never;
      const next = vi.fn();

      await expect(middleware(c, next)).rejects.toMatchObject({ statusCode: 429 });
    });
  });
});
