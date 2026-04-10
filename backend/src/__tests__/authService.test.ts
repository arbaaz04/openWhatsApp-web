import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../services/authService.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock fetch globally — authService calls Meta Graph API
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Auth Service — Token Exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call Meta Graph API and insert a new channel record', async () => {
    // Meta OAuth returns a valid token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'EAAreal_token', token_type: 'bearer' }),
    });

    // DB: no existing channel
    const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) };
    vi.mocked(db.select).mockReturnValue(selectChain as never);

    const insertChain = { values: vi.fn().mockResolvedValue([{ id: 1 }]) };
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    const result = await authService.exchangeToken('code123', 'waba1', 'phone1', 'appId', 'appSecret');

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('graph.facebook.com');
    expect(calledUrl).toContain('client_id=appId');
    expect(calledUrl).toContain('code=code123');

    expect(result).toEqual({ success: true });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it('should update an existing channel record instead of inserting', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'EAArotated_token', token_type: 'bearer' }),
    });

    const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 5 }]) }) }) };
    vi.mocked(db.select).mockReturnValue(selectChain as never);

    const updateChain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    const result = await authService.exchangeToken('code456', 'waba2', 'phone2', 'appId', 'appSecret');

    expect(result).toEqual({ success: true });
    expect(db.update).toHaveBeenCalledOnce();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('should throw ApiError 502 when Meta returns a non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":{"message":"Invalid code"}}',
    });

    await expect(
      authService.exchangeToken('bad_code', 'waba3', 'phone3', 'appId', 'appSecret')
    ).rejects.toMatchObject({ statusCode: 502, code: 'META_TOKEN_EXCHANGE_FAILED' });
  });

  it('should throw ApiError 502 when Meta returns no access_token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token_type: 'bearer' }), // missing access_token
    });

    await expect(
      authService.exchangeToken('code789', 'waba4', 'phone4', 'appId', 'appSecret')
    ).rejects.toMatchObject({ statusCode: 502, code: 'META_MISSING_ACCESS_TOKEN' });
  });
});
