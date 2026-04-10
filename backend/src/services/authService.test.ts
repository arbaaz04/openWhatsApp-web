import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './authService.js';
import { db } from '../db/index.js';

// Mock DB native queries to prevent test hanging on Neon SQL
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  }
}));

describe('Auth Service Token Exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully establish new waba relationships into db mock', async () => {
    // Stage mock so select().from().where().limit() chains cleanly
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as any);

    // Stage insert value chain
    const valuesMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as any);

    const result = await authService.exchangeToken('mockCode', 'waba123', 'phone123', 'cl1', 'sec1');
    
    expect(result.success).toBe(true);
    expect(result.accessToken).toBeDefined();
    
    // Assert strictly new channel inserts dynamically fired
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it('should update existing records dynamically avoiding collision inserts', async () => {
    const limitMock = vi.fn().mockResolvedValue([{ id: 1, wabaId: 'waba123' }]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as any);

    const setWhereMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    const setMock = vi.fn().mockReturnValue({ where: setWhereMock });
    vi.mocked(db.update).mockReturnValue({ set: setMock } as unknown as any);

    const result = await authService.exchangeToken('mockCode', 'waba456', 'phone123', 'cl1', 'sec1');
    
    expect(result.success).toBe(true);
    expect(db.update).toHaveBeenCalledOnce();
    expect(db.insert).not.toHaveBeenCalled();
  });
});
