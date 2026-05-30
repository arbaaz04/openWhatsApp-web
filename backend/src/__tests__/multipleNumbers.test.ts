import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageRepository } from '../repositories/messageRepository.js';
import conversationRouter from '../routes/conversation.routes.js';
import { sendWhatsAppMessage } from '../utils/metaApiClient.js';
import { Hono } from 'hono';

// Mock encryption module
vi.mock('../utils/encryption.js', () => ({
  encrypt: vi.fn((val) => `encrypted-${val}`),
  decrypt: vi.fn((val) => `decrypted-${val}`),
}));

// Mock metaApiClient's sendWhatsAppMessage
vi.mock('../utils/metaApiClient.js', () => ({
  sendWhatsAppMessage: vi.fn(),
}));

// Mock requireAuth middleware
vi.mock('../middleware/requireAuth.js', () => ({
  requireAuth: async (c: any, next: any) => {
    c.set('userId', 'user-123');
    await next();
  },
}));

const getValues = (sqlObj: any): any[] => {
  if (!sqlObj) return [];
  const chunks = sqlObj.queryChunks || [];
  let values: any[] = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    if (chunk.value !== undefined && !Array.isArray(chunk.value)) {
      values.push(chunk.value);
    } else if (chunk.queryChunks) {
      values.push(...getValues(chunk));
    }
  }
  return values;
};

describe('Multi-Number / Multi-Channel Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Incoming Message Routing (messageRepository.processIncomingMessage)', () => {
    it('should route incoming messages to the correct channel and conversation', async () => {
      // Mock two channels in the database
      const channelA = { id: 101, whatsappId: 'phone_A', phoneNumber: '+111111111' };
      const channelB = { id: 102, whatsappId: 'phone_B', phoneNumber: '+222222222' };

      const mockDb = {
        transaction: vi.fn().mockImplementation(async (callback: any) => {
          const tx = {
            select: vi.fn().mockImplementation(() => {
              const chain: any = {
                from: vi.fn().mockImplementation(() => chain),
                where: vi.fn().mockImplementation((condition: any) => {
                  const vals = getValues(condition);
                  if (vals.includes('phone_A')) {
                    chain.rows = [channelA];
                  } else if (vals.includes('phone_B')) {
                    chain.rows = [channelB];
                  } else {
                    chain.rows = []; // empty conversation/channel
                  }
                  return chain;
                }),
                limit: vi.fn().mockImplementation(() => chain),
                then: (resolve: any) => resolve(chain.rows || []),
              };
              return chain;
            }),
            insert: vi.fn().mockImplementation(() => {
              const chain = {
                values: vi.fn().mockImplementation(() => chain),
                returning: vi.fn().mockImplementation(() => chain),
                onConflictDoNothing: vi.fn().mockImplementation(() => chain),
                then: (resolve: any) => resolve([{ id: 999 }]),
              };
              return chain;
            }),
            update: vi.fn().mockImplementation(() => {
              const chain = {
                set: vi.fn().mockImplementation(() => chain),
                where: vi.fn().mockImplementation(() => chain),
                then: (resolve: any) => resolve([]),
              };
              return chain;
            }),
          };
          return callback(tx);
        }),
      } as any;

      // Process message on phone_A
      const resultA = await messageRepository.processIncomingMessage(
        mockDb,
        'phone_A',
        '+99999999',
        'Hello on A',
        'wamid-A'
      );
      expect(resultA.conversationId).toBe(999);

      // Process message on phone_B
      const resultB = await messageRepository.processIncomingMessage(
        mockDb,
        'phone_B',
        '+99999999',
        'Hello on B',
        'wamid-B'
      );
      expect(resultB.conversationId).toBe(999);
    });
  });

  describe('Outbound Message Routing (POST /api/conversations/:id/messages)', () => {
    it('should reply using the correct credentials and number mapped to the conversation', async () => {
      // Mock metaApiClient reply response
      vi.mocked(sendWhatsAppMessage).mockResolvedValue({
        wamid: 'meta-wamid-response',
        recipientWaId: '+99999999',
      });

      // Conversation 1 is mapped to Channel 1 (phone_A)
      // Conversation 2 is mapped to Channel 2 (phone_B)
      const mockConversations = {
        1: {
          id: 1,
          teamId: 10,
          channelId: 101,
          customerNumber: '+99999999',
          whatsappId: 'phone_A',
          accessToken: 'encrypted-token-A',
          lastCustomerMessageAt: new Date(),
          channelPhoneNumber: '+111111111',
          channelBusinessName: 'Business A',
        },
        2: {
          id: 2,
          teamId: 10,
          channelId: 102,
          customerNumber: '+99999999',
          whatsappId: 'phone_B',
          accessToken: 'encrypted-token-B',
          lastCustomerMessageAt: new Date(),
          channelPhoneNumber: '+222222222',
          channelBusinessName: 'Business B',
        },
      } as Record<number, any>;

      const mockDb = {
        select: vi.fn().mockImplementation(() => {
          const chain: any = {
            from: vi.fn().mockImplementation((table: any) => {
              chain.tableName = table?.className || table?.name;
              return chain;
            }),
            innerJoin: vi.fn().mockImplementation(() => chain),
            where: vi.fn().mockImplementation((condition: any) => {
              const vals = getValues(condition);

              if (chain.tableName === 'memberships') {
                // Return valid membership
                chain.rows = [{ teamId: 10 }];
              } else {
                // Conversation query
                const convId = vals.some(v => String(v) === '2') ? 2 : 1;
                chain.rows = [mockConversations[convId]];
              }
              return chain;
            }),
            limit: vi.fn().mockImplementation(() => chain),
            then: (resolve: any) => resolve(chain.rows || []),
          };
          return chain;
        }),
        insert: vi.fn().mockImplementation(() => {
          const chain = {
            values: vi.fn().mockImplementation(() => chain),
            returning: vi.fn().mockImplementation(() => chain),
            then: (resolve: any) => resolve([{ id: 888 }]),
          };
          return chain;
        }),
      } as any;

      const app = new Hono<any>();
      app.use('*', async (c, next) => {
        c.set('db', mockDb);
        c.set('requestId', 'test-request-id');
        (c as any).env = {
          ENVIRONMENT: 'local',
          DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        };
        // Mock executionCtx to prevent Hono from throwing when accessed in test environments
        Object.defineProperty(c, 'executionCtx', {
          value: {
            waitUntil: () => {},
          },
          writable: true,
          configurable: true,
        });
        await next();
      });

      app.onError((err, c) => {
        console.error('TEST ERROR:', err.message, err.stack);
        return c.text(err.message, 500);
      });

      app.route('/api/conversations', conversationRouter);

      // 1. Reply to Conversation 1 (belonging to Channel A)
      const res1 = await app.request('/api/conversations/1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Reply from A', type: 'text' }),
      });

      expect(res1.status).toBe(201);
      expect(sendWhatsAppMessage).toHaveBeenLastCalledWith({
        phoneNumberId: 'phone_A',
        accessToken: 'decrypted-encrypted-token-A',
        recipientNumber: '+99999999',
        type: 'text',
        messagePayload: { text: { body: 'Reply from A', preview_url: false } },
      });

      // 2. Reply to Conversation 2 (belonging to Channel B)
      const res2 = await app.request('/api/conversations/2/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Reply from B', type: 'text' }),
      });

      expect(res2.status).toBe(201);
      expect(sendWhatsAppMessage).toHaveBeenLastCalledWith({
        phoneNumberId: 'phone_B',
        accessToken: 'decrypted-encrypted-token-B',
        recipientNumber: '+99999999',
        type: 'text',
        messagePayload: { text: { body: 'Reply from B', preview_url: false } },
      });
    });
  });
});

