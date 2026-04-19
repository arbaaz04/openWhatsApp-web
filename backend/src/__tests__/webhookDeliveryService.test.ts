/**
 * @file webhookDeliveryService.test.ts
 *
 * Unit tests for the webhook delivery service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webhookDeliveryService } from '../services/webhookDeliveryService.js';
import { webhookRepository } from '../repositories/webhookRepository.js';
import type { WebhookEventName } from '../types/webhook.types.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../repositories/webhookRepository.js', () => ({
  webhookRepository: {
    listActiveByChannel: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock DB
const db = {
  select: vi.fn(),
} as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_KEY = 'a'.repeat(64);
const TEST_SECRET = 'super-secret-key-abcdef1234567890';

function makeWebhook(overrides: Partial<{
  id: number;
  kind: 'whatflow-web' | 'meta';
  url: string;
  secret: string;
  events: WebhookEventName[];
}> = {}) {
  return {
    id: 1,
    teamId: 10,
    channelId: 5,
    kind: 'whatflow-web' as const,
    url: 'https://example.com/webhook',
    secret: TEST_SECRET,
    events: ['conversation.message.received'] as WebhookEventName[],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const MESSAGE_EVENT_DATA = {
  conversationId: 42,
  messageId: 7,
  channelId: 5,
  customerNumber: '+14155552671',
  body: 'Hello, world!',
  direction: 'incoming' as const,
  wamid: 'wamid.test.abc',
  timestamp: '2024-01-01T00:00:00Z',
};

async function verifyHmac(body: string, hexSignature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = new Uint8Array(
    hexSignature.match(/.{2}/g)!.map((b) => parseInt(b, 16))
  );
  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body));
}

// ---------------------------------------------------------------------------
// Phase 1 tests
// ---------------------------------------------------------------------------

describe('webhookDeliveryService.dispatchEvent — whatflow kind (Phase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    // Flush any lingering batch state
    return webhookDeliveryService._flushAllBatches();
  });

  afterEach(() => webhookDeliveryService._flushAllBatches());

  it('starts batch window — event not delivered until batch is flushed', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([makeWebhook()]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
      db,
    });

    // Event is buffered — not yet delivered
    expect(mockFetch).not.toHaveBeenCalled();

    // Flush triggers delivery
    await webhookDeliveryService._flushAllBatches();
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('delivers correct Content-Type and signature headers after flush', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([makeWebhook()]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
      db,
    });
    await webhookDeliveryService._flushAllBatches();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(url).toBe('https://example.com/webhook');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(headers['X-Idempotency-Key']).toBeDefined();
    expect(headers['X-Webhook-Payload-Version']).toBe('v1');
    expect(headers['X-Webhook-Batch']).toBe('true');
  });

  it('delivers a verifiable HMAC-SHA256 signature', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([makeWebhook()]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
      db,
    });
    await webhookDeliveryService._flushAllBatches();

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = init.body as string;
    const hexSig = headers['X-Webhook-Signature'].replace('sha256=', '');

    const isValid = await verifyHmac(body, hexSig, TEST_SECRET);
    expect(isValid).toBe(true);
  });

  it('delivers a WhatflowBatchEnvelope with events array', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([
      makeWebhook({ events: ['conversation.message.received'] }),
    ]);

    // Dispatch same event twice — should batch
    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
      db,
    });
    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: { ...MESSAGE_EVENT_DATA, messageId: 8 },
      encryptionKey: HEX_KEY,
      db,
    });
    await webhookDeliveryService._flushAllBatches();

    // One HTTP call (batched)
    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const batchEnvelope = JSON.parse(init.body as string);

    expect(batchEnvelope.batchSize).toBe(2);
    expect(Array.isArray(batchEnvelope.events)).toBe(true);
    expect(batchEnvelope.events).toHaveLength(2);
  });

  it('skips delivery when event is not in the subscribed list', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([
      makeWebhook({ events: ['conversation.message.sent'] }),
    ]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
      db,
    });
    await webhookDeliveryService._flushAllBatches();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('delivers one of the new events (message.delivered) correctly', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([
      makeWebhook({ events: ['message.delivered'] }),
    ]);

    const deliveredData = {
      conversationId: 43,
      messageId: 123,
      channelId: 5,
      customerNumber: '+1234567890',
      body: 'Delivered confirmation',
      direction: 'outgoing' as const,
      wamid: 'wamid.del.123',
      timestamp: new Date().toISOString(),
    };

    await webhookDeliveryService.dispatchEvent({
      eventName: 'message.delivered',
      channelId: 5,
      eventData: deliveredData,
      encryptionKey: HEX_KEY,
      db,
    });
    await webhookDeliveryService._flushAllBatches();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const envelope = JSON.parse(init.body as string);
    // In batch mode, envelope.events is an array
    expect(envelope.events[0].event).toBe('message.delivered');
    expect(envelope.events[0].data).toEqual(deliveredData);
  });

  it('does nothing when no webhooks are registered for the channel', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
      db,
    });
    await webhookDeliveryService._flushAllBatches();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw when the repository throws', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockRejectedValue(
      new Error('DB connection lost')
    );

    await expect(
      webhookDeliveryService.dispatchEvent({
        eventName: 'conversation.message.received',
        channelId: 5,
        eventData: MESSAGE_EVENT_DATA,
        encryptionKey: HEX_KEY,
        db,
      })
    ).resolves.not.toThrow();
  });
});

describe('webhookDeliveryService.dispatchEvent — meta kind (Phase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    return webhookDeliveryService._flushAllBatches();
  });

  afterEach(() => webhookDeliveryService._flushAllBatches());

  it('forwards raw payload without whatflow envelope — immediate, no batching', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([
      makeWebhook({ kind: 'meta', events: [] }),
    ]);

    const rawPayload = { object: 'whatsapp_business_account', entry: [] };

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      rawMetaPayload: rawPayload,
      encryptionKey: HEX_KEY,
      db,
    });

    // meta kind is immediate — no flush needed
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const headers = init.headers as Record<string, string>;

    expect(url).toBe('https://example.com/webhook');
    expect(body).toEqual(rawPayload);
    expect(headers['X-Webhook-Event']).toBeUndefined();
    expect(headers['X-Webhook-Signature']).toBeUndefined();
    expect(headers['X-Idempotency-Key']).toBeDefined();
  });

  it('always delivers meta webhooks regardless of subscribed events', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([
      makeWebhook({ kind: 'meta', events: [] }),
    ]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.sent',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
      db,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('does not throw when meta delivery returns non-2xx', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([
      makeWebhook({ kind: 'meta', events: [] }),
    ]);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      webhookDeliveryService.dispatchEvent({
        eventName: 'conversation.message.received',
        channelId: 5,
        eventData: MESSAGE_EVENT_DATA,
        encryptionKey: HEX_KEY,
        db,
      })
    ).resolves.not.toThrow();
  });
});

describe('webhookDeliveryService — retry on batch failure (Phase 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: false, status: 500 }); // Force failure
    return webhookDeliveryService._flushAllBatches();
  });

  afterEach(() => webhookDeliveryService._flushAllBatches());

  it('enqueues each event individually into USER_WEBHOOK_QUEUE on batch delivery failure', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([makeWebhook()]);

    const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
      db,
      env: { USER_WEBHOOK_QUEUE: mockQueue as any },
    });
    await webhookDeliveryService._flushAllBatches();

    // Delivery failed → retry job enqueued
    expect(mockQueue.send).toHaveBeenCalledOnce();
    const [job, options] = mockQueue.send.mock.calls[0] as [any, { delaySeconds: number }];
    expect(job.webhookId).toBe(1);
    expect(job.attempt).toBe(1);
    expect(job.eventName).toBe('conversation.message.received');
    expect(options.delaySeconds).toBe(10);
  });

  it('does not throw if USER_WEBHOOK_QUEUE is not provided on failure', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([makeWebhook()]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
      db,
      // No env.USER_WEBHOOK_QUEUE
    });

    await expect(webhookDeliveryService._flushAllBatches()).resolves.not.toThrow();
  });
});

describe('webhookDeliveryService.deliverFromQueue (Phase 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseJob = {
    webhookId: 1,
    encryptionKey: HEX_KEY,
    eventName: 'conversation.message.received' as const,
    eventData: MESSAGE_EVENT_DATA,
    attempt: 1,
    idempotencyKey: 'test-idem-key-abc',
  };

  it('sends retry request with X-Webhook-Retry-Attempt header on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const txDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 1,
              url: 'https://example.com/webhook',
              kind: 'whatflow-web',
              encryptedSecret: 'encrypted:secret:placeholder',
              events: 'conversation.message.received',
              isActive: true,
            }]),
          }),
        }),
      }),
    } as any;

    vi.doMock('../utils/encryption.js', () => ({
      decrypt: vi.fn().mockResolvedValue(TEST_SECRET),
    }));

    try {
      const env = {
        USER_WEBHOOK_QUEUE: { send: vi.fn() },
        DATA_ENCRYPTION_KEY: HEX_KEY,
      } as any;

      await webhookDeliveryService.deliverFromQueue(txDb, baseJob, env);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-Webhook-Retry-Attempt']).toBe('1');
      expect(headers['X-Idempotency-Key']).toBe('test-idem-key-abc');
    } finally {
      vi.doUnmock('../utils/encryption.js');
    }
  });
});

describe('webhookDeliveryService.signPayload', () => {
  it('returns sha256=<hex> format', async () => {
    const sig = await webhookDeliveryService.signPayload('{"test":true}', TEST_SECRET);
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('produces verifiable signatures', async () => {
    const body = JSON.stringify({ event: 'conversation.message.received' });
    const sig = await webhookDeliveryService.signPayload(body, TEST_SECRET);
    const hexSig = sig.replace('sha256=', '');
    const isValid = await verifyHmac(body, hexSig, TEST_SECRET);
    expect(isValid).toBe(true);
  });
});
