import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageRepository } from '../repositories/messageRepository.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

/** Helper to build a mock Drizzle select chain */
function mockSelect(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  vi.mocked(db.select).mockReturnValue(chain as never);
  return chain;
}

describe('Message Repository — processIncomingMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should throw ApiError 404 if channel is not found', async () => {
    mockSelect([]); // channel lookup returns empty

    await expect(
      messageRepository.processIncomingMessage('ghost_phone', 'cust1', 'Hi')
    ).rejects.toMatchObject({ statusCode: 404, code: 'CHANNEL_NOT_FOUND' });
  });

  it('should create a new conversation scoped by channelId when none exists', async () => {
    // First select => channel found
    const channelChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 10 }]) };
    // Second select => no conversation
    const convChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
    vi.mocked(db.select)
      .mockReturnValueOnce(channelChain as never)
      .mockReturnValueOnce(convChain as never);

    const insertReturning = vi.fn().mockResolvedValue([{ id: 100 }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);

    await messageRepository.processIncomingMessage('phone1', 'cust1', 'Hello');

    // Two inserts: conversation + message
    expect(db.insert).toHaveBeenCalledTimes(2);
    // Verify conversation was scoped with channelId
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 10, customerNumber: 'cust1' })
    );
  });

  it('should update an existing conversation and refresh the 24h window', async () => {
    const channelChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 10 }]) };
    const convChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 200, isWindowOpen: false }]) };
    vi.mocked(db.select)
      .mockReturnValueOnce(channelChain as never)
      .mockReturnValueOnce(convChain as never);

    const updateWhere = vi.fn().mockResolvedValue([]);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as never);

    const insertValues = vi.fn().mockResolvedValue([]);
    vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);

    await messageRepository.processIncomingMessage('phone1', 'cust1', 'Again');

    // Update conversation, then insert message — no new conversation row
    expect(db.update).toHaveBeenCalledOnce();
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ isWindowOpen: true }));
    expect(db.insert).toHaveBeenCalledOnce(); // only the message
  });
});
