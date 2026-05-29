import { describe, it, expect, vi, beforeEach } from 'vitest';
import conversationRouter from '../routes/conversation.routes.js';
import { Hono } from 'hono';
import { ApiError } from '../utils/errors.js';

// Mock middleware
vi.mock('../middleware/requireAuth.js', () => ({
  requireAuth: async (c: any, next: any) => {
    c.set('userId', 'user-123');
    await next();
  },
}));

vi.mock('../db/index.js', () => ({
  createDb: vi.fn(),
}));

vi.mock('../utils/metaApiClient.js', () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue({ wamid: 'wamid-mock-123', recipientWaId: '12345' }),
}));

vi.mock('../utils/encryption.js', () => ({
  decrypt: vi.fn().mockResolvedValue('decrypted-token'),
}));

vi.mock('../repositories/messageRepository.js', () => ({
  messageRepository: {
    createOutboundMessage: vi.fn().mockResolvedValue({ messageId: 456 }),
    listMessages: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
  },
}));

// Mock DB queries
const mockDb = {
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
} as any;

describe('Conversation Window Expiration', () => {
  let app: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();

    app.use('*', async (c, next) => {
      c.set('db', mockDb as any);
      c.set('requestId', 'test-request-id');
      (c as any).env = {
        ENVIRONMENT: 'local',
        DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };
      await next();
    });

    app.route('/api/conversations', conversationRouter);

    app.onError((err, c) => {
      const statusCode = err instanceof ApiError ? err.statusCode : 500;
      return c.json({ success: false, error: { code: err instanceof ApiError ? err.code : 'INTERNAL_ERROR', message: err.message } }, statusCode as any);
    });
  });

  it('GET /api/conversations calculates isWindowOpen dynamically based on lastCustomerMessageAt', async () => {
    const recentDate = new Date();
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

    const mockRows = [
      {
        id: 1,
        channelId: 10,
        customerNumber: '+16315551181',
        whatsappId: 'phone-1',
        lastCustomerMessageAt: recentDate,
        createdAt: new Date(),
      },
      {
        id: 2,
        channelId: 10,
        customerNumber: '+16315551182',
        whatsappId: 'phone-1',
        lastCustomerMessageAt: oldDate,
        createdAt: new Date(),
      },
    ];

    const limitMock = vi.fn().mockResolvedValue(mockRows);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const innerJoinMock2 = vi.fn().mockReturnValue({ where: whereMock });
    const innerJoinMock1 = vi.fn().mockReturnValue({ innerJoin: innerJoinMock2 });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock1 });
    mockDb.select.mockReturnValue({ from: fromMock });

    const req = new Request('http://localhost/api/conversations?limit=50', { method: 'GET' });
    const ctx = { waitUntil: vi.fn() } as any;
    const res = await app.fetch(req, {}, ctx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.conversations).toHaveLength(2);
    expect(data.conversations[0].customerNumber).toBe('+16315551181');
    expect(data.conversations[1].customerNumber).toBe('+16315551182');
    expect(data.conversations[0].isWindowOpen).toBe(true);
    expect(data.conversations[1].isWindowOpen).toBe(false);
  });

  it('POST /api/conversations/:id/messages rejects non-template messages when window is closed', async () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const mockAuthorizeRow = {
      id: 1,
      teamId: 1,
      channelId: 10,
      customerNumber: '+16315551181',
      whatsappId: 'phone-1',
      accessToken: 'token-abc',
      lastCustomerMessageAt: oldDate,
    };

    const limitMock = vi.fn().mockResolvedValue([mockAuthorizeRow]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const innerJoinMock2 = vi.fn().mockReturnValue({ where: whereMock });
    const innerJoinMock1 = vi.fn().mockReturnValue({ innerJoin: innerJoinMock2 });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock1 });
    mockDb.select.mockReturnValue({ from: fromMock });

    const req = new Request('http://localhost/api/conversations/1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'text', body: 'Hello' }),
    });
    const ctx = { waitUntil: vi.fn() } as any;
    const res = await app.fetch(req, {}, ctx);

    expect(res.status).toBe(422);
    const err = (await res.json()) as any;
    expect(err.error.code).toBe('WINDOW_CLOSED');
  });

  it('POST /api/conversations/:id/messages allows template messages even when window is closed', async () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const mockAuthorizeRow = {
      id: 1,
      teamId: 1,
      channelId: 10,
      customerNumber: '+16315551181',
      whatsappId: 'phone-1',
      accessToken: 'token-abc',
      lastCustomerMessageAt: oldDate,
    };

    const limitMock = vi.fn().mockResolvedValue([mockAuthorizeRow]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const innerJoinMock2 = vi.fn().mockReturnValue({ where: whereMock });
    const innerJoinMock1 = vi.fn().mockReturnValue({ innerJoin: innerJoinMock2 });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock1 });
    mockDb.select.mockReturnValue({ from: fromMock });

    const req = new Request('http://localhost/api/conversations/1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'template', body: 'Hello template', payload: { template: { name: 'hello_world' } } }),
    });
    const ctx = { waitUntil: vi.fn() } as any;
    const res = await app.fetch(req, {}, ctx);

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.wamid).toBe('wamid-mock-123');
  });

  it('GET /api/conversations/:id returns conversation details', async () => {
    const mockAuthorizeRow = {
      id: 1,
      teamId: 1,
      channelId: 10,
      customerNumber: '+16315551181',
      whatsappId: 'phone-1',
      accessToken: 'token-abc',
      lastCustomerMessageAt: new Date(),
    };

    const limitMock = vi.fn().mockResolvedValue([mockAuthorizeRow]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const innerJoinMock2 = vi.fn().mockReturnValue({ where: whereMock });
    const innerJoinMock1 = vi.fn().mockReturnValue({ innerJoin: innerJoinMock2 });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock1 });
    mockDb.select.mockReturnValue({ from: fromMock });

    const req = new Request('http://localhost/api/conversations/1', { method: 'GET' });
    const ctx = { waitUntil: vi.fn() } as any;
    const res = await app.fetch(req, {}, ctx);

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.conversation.customerNumber).toBe('+16315551181');
    expect(data.conversation.isWindowOpen).toBe(true);
  });
});
