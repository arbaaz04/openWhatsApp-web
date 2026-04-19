import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../services/authService.js';

// Mock fetch globally — authService calls Meta Graph API
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Valid 64-char hex key for AES-256-GCM encryption in tests */
const TEST_ENCRYPTION_KEY = 'a'.repeat(64);

// Mock DB
const db = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
} as any;

describe('Auth Service — Token Exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call Meta Graph API and insert a new channel record', async () => {
    // 1. Mock token exchange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'EAAreal_token', token_type: 'bearer' }),
    });
    // 2. Mock WABA fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'waba1' }] }),
    });
    // 3. Mock Phone fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'phone1', display_phone_number: '+12345', status: 'CONNECTED' }] }),
    });
    // 4. Mock Subscribe
    mockFetch.mockResolvedValueOnce({ ok: true });
    // 5. Mock Register
    mockFetch.mockResolvedValueOnce({ ok: true });

    const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) };
    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const insertChain = { values: vi.fn().mockResolvedValue([{ id: 1 }]) };
    vi.mocked(db.insert).mockReturnValue(insertChain as any);

    const result = await authService.exchangeToken(
      db, 'code123', 1, 'appId', 'appSecret', TEST_ENCRYPTION_KEY
    );

    expect(mockFetch).toHaveBeenCalledTimes(5);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('oauth/access_token');
    expect(calledUrl).toContain('code=code123');

    expect(result).toEqual({ success: true });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it('should update an existing channel record instead of inserting', async () => {
    // 1. Mock token exchange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'EAArotated_token', token_type: 'bearer' }),
    });
    // 2. Mock WABA fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'waba2' }] }),
    });
    // 3. Mock Phone fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'phone2', display_phone_number: '+12345', status: 'CONNECTED' }] }),
    });
    // 4. Mock Subscribe
    mockFetch.mockResolvedValueOnce({ ok: true });
    // 5. Mock Register
    mockFetch.mockResolvedValueOnce({ ok: true });

    const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 5, teamId: 1 }]) }) }) };
    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const updateChain = { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
    vi.mocked(db.update).mockReturnValue(updateChain as any);

    const result = await authService.exchangeToken(
      db, 'code456', 1, 'appId', 'appSecret', TEST_ENCRYPTION_KEY
    );

    expect(result).toEqual({ success: true });
    expect(db.update).toHaveBeenCalledOnce();
  });

  it('should throw ApiError 502 when Meta returns a non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":{"message":"Invalid code"}}',
    });

    await expect(
      authService.exchangeToken(db, 'bad_code', 1, 'appId', 'appSecret', TEST_ENCRYPTION_KEY)
    ).rejects.toMatchObject({ statusCode: 502, code: 'META_TOKEN_EXCHANGE_FAILED' });
  });

  it('should throw ApiError 502 when Meta returns no access_token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token_type: 'bearer' }), // missing access_token
    });

    await expect(
      authService.exchangeToken(db, 'code789', 1, 'appId', 'appSecret', TEST_ENCRYPTION_KEY)
    ).rejects.toMatchObject({ statusCode: 502, code: 'META_MISSING_ACCESS_TOKEN' });
  });

  it('should reject rotating a channel token across teams', async () => {
    // 1. Mock token exchange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'EAArotated_token', token_type: 'bearer' }),
    });
    // 2. Mock WABA fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'waba2' }] }),
    });
    // 3. Mock Phone fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'phone2', display_phone_number: '+12345', status: 'CONNECTED' }] }),
    });
    // 4. Mock Subscribe
    mockFetch.mockResolvedValueOnce({ ok: true });
    // 5. Mock Register
    mockFetch.mockResolvedValueOnce({ ok: true });

    const selectChain = { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 5, teamId: 99 }]) }) }) };
    vi.mocked(db.select).mockReturnValue(selectChain as any);

    await expect(
      authService.exchangeToken(db, 'code999', 1, 'appId', 'appSecret', TEST_ENCRYPTION_KEY)
    ).rejects.toMatchObject({ statusCode: 409, code: 'CHANNEL_TEAM_MISMATCH' });
  });

  it('should decrypt a token stored using getDecryptedToken', async () => {
    const { encrypt } = await import('../utils/encryption.js');
    const original = 'EAA_some_real_token';
    const encrypted = await encrypt(original, TEST_ENCRYPTION_KEY);

    const decrypted = await authService.getDecryptedToken(encrypted, TEST_ENCRYPTION_KEY);
    expect(decrypted).toBe(original);
  });
});
