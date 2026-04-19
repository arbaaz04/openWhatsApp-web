/**
 * @file webhookRepository.test.ts
 *
 * Unit tests for the webhookRepository. All DB calls are mocked — no
 * real database is needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webhookRepository } from '../repositories/webhookRepository.js';

// ---------------------------------------------------------------------------
// Mock the DB layer
// ---------------------------------------------------------------------------

const db = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
} as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_KEY = 'a'.repeat(64); // Valid 64-char hex key for AES-256-GCM

/** Returns a fake webhook DB row for mocking. */
function fakeRow(overrides: Partial<{
  id: number;
  teamId: number;
  channelId: number | null;
  kind: 'whatflow-web' | 'meta';
  url: string;
  encryptedSecret: string;
  events: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: 1,
    teamId: 10,
    channelId: 5,
    kind: 'whatflow-web' as const,
    url: 'https://example.com/hook',
    encryptedSecret: 'encrypted:secret',
    events: 'conversation.message.received,conversation.message.sent',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Creates the minimal Drizzle-style chain for:
 *   db.select(...).from(...).where(...).limit(...)
 *
 * The terminal call (limit) resolves with `result`.
 */
function makeSelectChain(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ limit, orderBy });
  const from = vi.fn().mockReturnValue({ where, orderBy, limit });
  return { from };
}

/**
 * Creates the minimal Drizzle-style chain for:
 *   db.select(...).from(...).where(...)  (no .limit — listActiveByChannel)
 */
function makeSelectChainDirect(result: unknown[]) {
  const where = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('webhookRepository.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a webhook and returns the row with masked secret', async () => {
    // 1st select: channel ownership check → found, same team
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ teamId: 10 }]) as any)
      // 2nd select: meta uniqueness (not called for whatflow kind, but may be called — return empty)
      .mockReturnValue(makeSelectChain([]) as any);

    const row = fakeRow();
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([row]) }),
    } as any);

    const result = await webhookRepository.create(
      db,
      {
        teamId: 10,
        channelId: 5,
        kind: 'whatflow-web',
        url: 'https://example.com/hook',
        secret: 'my-secret-key-123',
        events: ['conversation.message.received'],
      },
      HEX_KEY
    );

    expect(result.secret).toBe('***');
    expect(result.url).toBe('https://example.com/hook');
    expect(result.kind).toBe('whatflow-web');
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it('throws 422 for a non-HTTPS URL', async () => {
    await expect(
      webhookRepository.create(
        db,
        { teamId: 1, kind: 'whatflow-web', url: 'http://insecure.com/hook', secret: 'x'.repeat(16) },
        HEX_KEY
      )
    ).rejects.toMatchObject({ statusCode: 422, code: 'INVALID_WEBHOOK_URL' });
  });

  it('throws 422 for a totally invalid URL', async () => {
    await expect(
      webhookRepository.create(
        db,
        { teamId: 1, kind: 'whatflow-web', url: 'not-a-url', secret: 'x'.repeat(16) },
        HEX_KEY
      )
    ).rejects.toMatchObject({ statusCode: 422, code: 'INVALID_WEBHOOK_URL' });
  });

  it('throws 404 when channelId does not exist', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as any);

    await expect(
      webhookRepository.create(
        db,
        { teamId: 1, channelId: 999, kind: 'whatflow-web', url: 'https://ex.com', secret: 'x'.repeat(16) },
        HEX_KEY
      )
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('throws 403 when channel belongs to a different team', async () => {
    // Channel found but its teamId (99) != requesting teamId (1)
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([{ teamId: 99 }]) as any);

    await expect(
      webhookRepository.create(
        db,
        { teamId: 1, channelId: 5, kind: 'whatflow-web', url: 'https://ex.com', secret: 'x'.repeat(16) },
        HEX_KEY
      )
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('throws 409 when a meta webhook already exists for the channel', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ teamId: 10 }]) as any)  // channel OK
      .mockReturnValueOnce(makeSelectChain([{ id: 42 }]) as any);     // existing meta webhook

    await expect(
      webhookRepository.create(
        db,
        { teamId: 10, channelId: 5, kind: 'meta', url: 'https://ex.com', secret: 'x'.repeat(16) },
        HEX_KEY
      )
    ).rejects.toMatchObject({ statusCode: 409, code: 'META_WEBHOOK_EXISTS' });
  });

  it('creates a webhook without channelId (project-level)', async () => {
    // No channel ownership check when channelId is null
    const row = fakeRow({ channelId: null });
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([row]) }),
    } as any);

    const result = await webhookRepository.create(
      db,
      { teamId: 10, kind: 'whatflow-web', url: 'https://ex.com', secret: 'mysecret123456789', events: [] },
      HEX_KEY
    );

    expect(result.channelId).toBeNull();
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe('webhookRepository.listByTeam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns rows with masked secrets', async () => {
    const rows = [fakeRow({ id: 1 }), fakeRow({ id: 2 })];
    vi.mocked(db.select).mockReturnValue(makeSelectChain(rows) as any);

    const result = await webhookRepository.listByTeam(db, 10);

    expect(result).toHaveLength(2);
    result.forEach((r) => expect(r.secret).toBe('***'));
  });

  it('caps the limit at 100', async () => {
    // Build chain manually to capture the limit call
    const limitFn = vi.fn().mockResolvedValue([]);
    const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
    const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn, limit: limitFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn, orderBy: orderByFn });
    vi.mocked(db.select).mockReturnValue({ from: fromFn } as any);

    await webhookRepository.listByTeam(db, 10, 500);

    expect(limitFn).toHaveBeenCalledWith(100);
  });

  it('returns empty array when no webhooks exist', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as any);

    const result = await webhookRepository.listByTeam(db, 10);
    expect(result).toHaveLength(0);
  });
});

describe('webhookRepository.getById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the row when found and owned by team', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([fakeRow()]) as any);

    const result = await webhookRepository.getById(db, 1, 10);

    expect(result.id).toBe(1);
    expect(result.secret).toBe('***');
    expect(result.kind).toBe('whatflow-web');
  });

  it('throws 404 when not found', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as any);

    await expect(webhookRepository.getById(db, 999, 10)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});

describe('webhookRepository.listActiveByChannel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns rows with decrypted secrets', async () => {
    const { encrypt } = await import('../utils/encryption.js');
    const realSecret = 'my-real-secret-abc123';
    const encrypted = await encrypt(realSecret, HEX_KEY);
    const row = fakeRow({ encryptedSecret: encrypted });

    // listActiveByChannel: db.select().from().where()  — where() is the terminal async call
    vi.mocked(db.select).mockReturnValue(makeSelectChainDirect([row]) as any);

    const results = await webhookRepository.listActiveByChannel(db, 5, HEX_KEY);

    expect(results).toHaveLength(1);
    expect(results[0].secret).toBe(realSecret);
  });

  it('returns empty array when there are no active webhooks', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChainDirect([]) as any);

    const results = await webhookRepository.listActiveByChannel(db, 5, HEX_KEY);
    expect(results).toHaveLength(0);
  });
});

describe('webhookRepository.update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates URL and returns masked row', async () => {
    const updated = fakeRow({ url: 'https://new.example.com/hook' });
    const returningFn = vi.fn().mockResolvedValue([updated]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    vi.mocked(db.update).mockReturnValue({ set: setFn } as any);

    const result = await webhookRepository.update(db, 1, 10, { url: 'https://new.example.com/hook' }, HEX_KEY);

    expect(result.url).toBe('https://new.example.com/hook');
    expect(result.secret).toBe('***');
  });

  it('updates isActive flag', async () => {
    const updated = fakeRow({ isActive: false });
    const returningFn = vi.fn().mockResolvedValue([updated]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    vi.mocked(db.update).mockReturnValue({ set: setFn } as any);

    const result = await webhookRepository.update(db, 1, 10, { isActive: false }, HEX_KEY);
    expect(result.isActive).toBe(false);
  });

  it('throws 404 when webhook not found or not owned by team', async () => {
    const returningFn = vi.fn().mockResolvedValue([]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    vi.mocked(db.update).mockReturnValue({ set: setFn } as any);

    await expect(webhookRepository.update(db, 999, 10, { isActive: false }, HEX_KEY)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('throws 422 when updated URL is not HTTPS', async () => {
    await expect(
      webhookRepository.update(db, 1, 10, { url: 'http://insecure.com' }, HEX_KEY)
    ).rejects.toMatchObject({ statusCode: 422, code: 'INVALID_WEBHOOK_URL' });
  });

  it('re-encrypts secret when secret is updated', async () => {
    const updated = fakeRow();
    const returningFn = vi.fn().mockResolvedValue([updated]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    vi.mocked(db.update).mockReturnValue({ set: setFn } as any);

    await webhookRepository.update(db, 1, 10, { secret: 'new-secret-value-abc123' }, HEX_KEY);

    // Verify the set was called with an encryptedSecret field (should contain a colon separator from AES format)
    const setCallArg = setFn.mock.calls[0][0] as Record<string, unknown>;
    expect(setCallArg).toHaveProperty('encryptedSecret');
    expect(typeof setCallArg.encryptedSecret).toBe('string');
    expect((setCallArg.encryptedSecret as string).includes(':')).toBe(true);
  });
});

describe('webhookRepository.delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes successfully when found', async () => {
    const returningFn = vi.fn().mockResolvedValue([{ id: 1 }]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    vi.mocked(db.delete).mockReturnValue({ where: whereFn } as any);

    await expect(webhookRepository.delete(db, 1, 10)).resolves.toBeUndefined();
  });

  it('throws 404 when not found or not owned by team', async () => {
    const returningFn = vi.fn().mockResolvedValue([]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    vi.mocked(db.delete).mockReturnValue({ where: whereFn } as any);

    await expect(webhookRepository.delete(db, 999, 10)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});

describe('webhookRepository.countByTeam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the numeric count', async () => {
    // countByTeam: db.select().from().where()  — where() resolves directly
    vi.mocked(db.select).mockReturnValue(makeSelectChainDirect([{ total: 7 }]) as any);

    const total = await webhookRepository.countByTeam(db, 10);
    expect(total).toBe(7);
  });

  it('returns 0 when no webhooks exist', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChainDirect([{ total: 0 }]) as any);

    const total = await webhookRepository.countByTeam(db, 10);
    expect(total).toBe(0);
  });

  it('returns 0 when query returns empty', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChainDirect([]) as any);

    const total = await webhookRepository.countByTeam(db, 10);
    expect(total).toBe(0);
  });
});
