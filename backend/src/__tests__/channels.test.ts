import { describe, it, expect, vi, beforeEach } from 'vitest';
import channelRouter from '../routes/channel.routes.js';
import { Hono } from 'hono';

// Mock the dependencies
vi.mock('../middleware/requireAuth.js', () => ({
  requireAuth: async (c: any, next: any) => {
    c.set('userId', 'user-123');
    await next();
  },
}));

vi.mock('../middleware/requireRole.js', () => ({
  requireRole: (...roles: string[]) => async (c: any, next: any) => {
    await next();
  },
}));

vi.mock('../db/index.js', () => ({
  createDb: vi.fn(),
}));

// Mock Drizzle
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([
    {
      id: 1,
      teamId: 10,
      type: 'business_app',
      phoneNumber: '+1234567890',
      businessName: 'Test Business',
      whatsappId: 'phone-id-abc',
      wabaId: 'waba-id-123',
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
  ]),
};

describe('Channel Routes', () => {
  let app: Hono<any>;

  beforeEach(() => {
    app = new Hono();
    // Inject mock DB, requestId and mock env into context
    app.use('*', async (c, next) => {
      c.set('db', mockDb as any);
      c.set('requestId', 'test-request-id');
      (c as any).env = {
        ENVIRONMENT: 'test',
        DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };
      await next();
    });

    app.route('/api/teams', channelRouter);

    app.onError((err, c) => {
      console.error('TEST APP ERROR:', err.message, err.stack);
      return c.text(err.message, 500);
    });
  });

  it('GET /api/teams/:teamId/channels returns a list of channels', async () => {
    const res = await app.request('/api/teams/10/channels', {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.channels).toHaveLength(1);
    expect(body.channels[0].phoneNumber).toBe('+1234567890');
    expect(body.channels[0].businessName).toBe('Test Business');
  });
});
