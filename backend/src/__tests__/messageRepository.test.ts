import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageRepository } from '../repositories/messageRepository.js';

// Mock DB
const db = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
} as any;

// ---------------------------------------------------------------------------
// Drizzle fluent query chain helper
// Builds a mock that supports .from().where().limit() / .orderBy().limit() etc.
// ---------------------------------------------------------------------------
function makeSelectChain(result: unknown[]): any {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  };
  return vi.fn().mockReturnValue(chain);
}

function makeInsertChain(result: unknown[] = []): any {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
    onConflictDoNothing: vi.fn().mockReturnThis(),
  };
  return vi.fn().mockReturnValue(chain);
}

function makeUpdateChain(): any {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  return vi.fn().mockReturnValue(chain);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('messageRepository.listMessages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the first page with hasMore=false when results fit in limit', async () => {
    const fakeMessages = Array.from({ length: 3 }, (_, i) => ({
      id: 3 - i,
      conversationId: 1,
      body: `msg ${i}`,
      direction: 'incoming',
      status: 'delivered',
      externalId: null,
      createdAt: new Date(),
    }));

    // listMessages fetches limit+1 rows to detect hasMore
    // returning 3 rows when limit=50 → hasMore=false
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(fakeMessages),
    };
    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const result = await messageRepository.listMessages(db, 1);

    expect(result.items.length).toBe(3);
    expect(result.hasMore).toBe(false);
    expect(selectChain.orderBy).toHaveBeenCalledOnce();
    expect(selectChain.limit).toHaveBeenCalledWith(51); // 50 + 1
  });

  it('sets hasMore=true and trims to limit when extra row is present', async () => {
    // Simulate 51 rows returned when limit=50
    const extra = Array.from({ length: 51 }, (_, i) => ({
      id: 100 - i,
      conversationId: 1,
      body: `msg ${i}`,
      direction: 'incoming',
      status: 'delivered',
      externalId: null,
      createdAt: new Date(),
    }));
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(extra),
    };
    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const result = await messageRepository.listMessages(db, 1);

    expect(result.hasMore).toBe(true);
    expect(result.items.length).toBe(50); // extra row trimmed
  });

  it('respects a custom limit capped at MAX_PAGE_SIZE (200)', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(selectChain as any);

    await messageRepository.listMessages(db, 1, { limit: 9999 });

    // Should be capped at 200 + 1 = 201
    expect(selectChain.limit).toHaveBeenCalledWith(201);
  });
});

describe('messageRepository.processIncomingMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new conversation when none exists', async () => {
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: 10, whatsappId: 'phone1' }]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        }),
      insert: vi.fn()
        .mockReturnValueOnce({
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{ id: 99 }]),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{ id: 201 }]),
          onConflictDoNothing: vi.fn().mockReturnThis(),
        }),
      update: vi.fn(),
    };

    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx as any));

    const result = await messageRepository.processIncomingMessage(
      db, 'phone1', '+1234567890', 'Hello', 'ext-msg-001'
    );

    expect(result.conversationId).toBe(99);
    expect(result.messageId).toBe(201);
    expect(tx.insert).toHaveBeenCalledTimes(2); // conversation + message
  });

  it('reuses an existing conversation and refreshes the window', async () => {
    const tx = {
      select: vi.fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 10, whatsappId: 'phone1' }]),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 55 }]),
      } as any),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }),
      insert: vi.fn()
      .mockReturnValueOnce({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 201 }]),
        onConflictDoNothing: vi.fn().mockReturnThis(),
      }),
    };

    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx as any));

    const result = await messageRepository.processIncomingMessage(
      db, 'phone1', '+1234567890', 'Hi again'
    );

    expect(result.conversationId).toBe(55);
    expect(tx.update).toHaveBeenCalledOnce(); // window refresh
    expect(tx.insert).toHaveBeenCalledOnce(); // only the message
  });
});
