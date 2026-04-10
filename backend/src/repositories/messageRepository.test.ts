import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageRepository } from './messageRepository.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  }
}));

// Provide basic Date mocks for predictable 24-hour window asserts
const MOCK_DATE = new Date('2026-04-10T12:00:00Z');

describe('Message Repository Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: MOCK_DATE });
  });

  it('should successfully establish inbound customer communication branches', async () => {
    // Stage channel lookups
    const limitMock = vi.fn().mockResolvedValue([{ id: 10 }]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as any);

    // Stage conversation lookups
    const convLimitMock = vi.fn().mockResolvedValue([]);
    const convWhereMock = vi.fn().mockReturnValue({ limit: convLimitMock });
    const convFromMock = vi.fn().mockReturnValue({ where: convWhereMock });
    vi.mocked(db.select).mockReturnValueOnce({ from: fromMock } as unknown as any)
                        .mockReturnValueOnce({ from: convFromMock } as unknown as any); // Second call for conv

    // Stage inserts
    const insertReturningMock = vi.fn()
       .mockResolvedValueOnce([{ id: 100 }]) // new conversation returned
       .mockResolvedValueOnce([{ id: 1000 }]); // new message returned
    const insertValuesMock = vi.fn().mockReturnValue({ returning: insertReturningMock });
    vi.mocked(db.insert).mockReturnValue({ values: insertValuesMock } as unknown as any);

    await messageRepository.processIncomingMessage('host123', 'cust456', 'Hello World');

    // Assert that conversation window was newly established and messages explicitly stored
    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it('should gracefully renew 24h window windows dynamically off returning customers', async () => {
    const limitMock = vi.fn().mockResolvedValue([{ id: 10 }]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    
    // Existing conversation lookup returning a stale closed window
    const convLimitMock = vi.fn().mockResolvedValue([{ 
      id: 100, 
      lastCustomerMessageAt: new Date('2026-04-01T12:00:00Z'), // Way past 24 hours 
      isWindowOpen: false 
    }]);
    const convWhereMock = vi.fn().mockReturnValue({ limit: convLimitMock });
    const convFromMock = vi.fn().mockReturnValue({ where: convWhereMock });
    
    vi.mocked(db.select).mockReturnValueOnce({ from: fromMock } as unknown as any)
                        .mockReturnValueOnce({ from: convFromMock } as unknown as any);

    const updateWhereMock = vi.fn().mockResolvedValue([{ id: 100 }]);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    vi.mocked(db.update).mockReturnValue({ set: updateSetMock } as unknown as any);

    const insertReturningMock = vi.fn().mockResolvedValue([{ id: 1000 }]);
    const insertValuesMock = vi.fn().mockReturnValue({ returning: insertReturningMock });
    vi.mocked(db.insert).mockReturnValue({ values: insertValuesMock } as unknown as any);

    await messageRepository.processIncomingMessage('host123', 'cust456', 'Follow up');
    
    expect(db.update).toHaveBeenCalledOnce();
    expect(db.insert).toHaveBeenCalledOnce(); // Only the message was inserted, conv was updated
  });
});
