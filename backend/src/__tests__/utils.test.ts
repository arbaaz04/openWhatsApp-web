import { describe, it, expect, vi } from 'vitest';
import { logger, createLogger } from '../utils/logger.js';
import { ApiError, formatErrorResponse } from '../utils/errors.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { validateEnv } from '../utils/validateEnv.js';
import type { WorkerBindings } from '../types/bindings.js';

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

  describe('createLogger — request-scoped context', () => {
    it('should merge base context into every log call', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const log = createLogger({ requestId: 'test-req-123' });
      log.error('Something broke', { detail: 'disk full' });

      const logged = JSON.parse(spy.mock.calls[0][0] as string);
      expect(logged.requestId).toBe('test-req-123');
      expect(logged.detail).toBe('disk full');
      expect(logged.message).toBe('Something broke');
      spy.mockRestore();
    });

    it('should not bleed context between separate logger instances', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logA = createLogger({ requestId: 'req-A' });
      const logB = createLogger({ requestId: 'req-B' });

      logA.error('from A');
      logB.error('from B');

      const payloadA = JSON.parse(spy.mock.calls[0][0] as string);
      const payloadB = JSON.parse(spy.mock.calls[1][0] as string);

      expect(payloadA.requestId).toBe('req-A');
      expect(payloadB.requestId).toBe('req-B');
      spy.mockRestore();
    });
  });

  describe('validateEnv', () => {
    const validEnv: WorkerBindings = {
      DATABASE_URL: 'postgres://localhost/test',
      WEBHOOK_VERIFY_TOKEN: 'secret',
      META_APP_ID: 'app123',
      META_APP_SECRET: 'appsecret',
      INBOX_SYNC: {} as DurableObjectNamespace,
    };

    it('should not throw when all required bindings are present', () => {
      expect(() => validateEnv(validEnv)).not.toThrow();
    });

    it('should throw ApiError 503 when DATABASE_URL is missing', () => {
      const env = { ...validEnv, DATABASE_URL: '' };
      expect(() => validateEnv(env)).toThrow(
        expect.objectContaining({ statusCode: 503, code: 'MISCONFIGURED' })
      );
    });

    it('should list all missing bindings in the error message', () => {
      const env = { ...validEnv, META_APP_ID: '', META_APP_SECRET: '' };
      expect(() => validateEnv(env)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('META_APP_ID'),
        })
      );
    });
  });
});
