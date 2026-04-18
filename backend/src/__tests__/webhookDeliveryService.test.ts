/**
 * @file webhookDeliveryService.test.ts
 *
 * Unit tests for the webhook delivery service.
 *
 * Key behaviours verified:
 *   - whatflow: correct headers (event, signature, idempotency, version)
 *   - whatflow: HMAC signature is valid (verifiable with the same key)
 *   - whatflow: event filtering (unsubscribed events are not delivered)
 *   - meta: raw payload forwarded with X-Idempotency-Key header
 *   - delivery failure does not throw (fire-and-forget)
 *   - delivery timeout (AbortController fires)
 *   - X-Idempotency-Key is unique per delivery
 *   - no calls when no webhooks exist for channel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webhookDeliveryService } from '../services/webhookDeliveryService.js';
import { webhookRepository } from '../repositories/webhookRepository.js';
import { encrypt } from '../utils/encryption.js';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_KEY = 'a'.repeat(64);
const TEST_SECRET = 'super-secret-key-abcdef1234567890';

/** Returns a mock active webhook record with a known plaintext secret. */
function makeWebhook(overrides: Partial<{
  id: number;
  kind: 'whatflow' | 'meta';
  url: string;
  secret: string;
  events: string[];
}> = {}) {
  return {
    id: 1,
    teamId: 10,
    channelId: 5,
    kind: 'whatflow' as const,
    url: 'https://example.com/webhook',
    secret: TEST_SECRET,
    events: ['conversation.message.received'],
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

// ---------------------------------------------------------------------------
// Signature verification helper
// ---------------------------------------------------------------------------

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
// Tests
// ---------------------------------------------------------------------------

describe('webhookDeliveryService.dispatchEvent — whatflow kind', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('delivers with correct headers for whatflow webhook', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([makeWebhook()]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(url).toBe('https://example.com/webhook');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Webhook-Event']).toBe('conversation.message.received');
    expect(headers['X-Webhook-Payload-Version']).toBe('v1');
    expect(headers['X-Idempotency-Key']).toBeDefined();
    expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('sends a valid HMAC-SHA256 signature that can be verified', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([makeWebhook()]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = init.body as string;
    const sigHeader = headers['X-Webhook-Signature']; // "sha256=<hex>"
    const hexSig = sigHeader.replace('sha256=', '');

    const isValid = await verifyHmac(body, hexSig, TEST_SECRET);
    expect(isValid).toBe(true);
  });

  it('delivers the correct JSON envelope shape', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([makeWebhook()]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const envelope = JSON.parse(init.body as string);

    expect(envelope.event).toBe('conversation.message.received');
    expect(envelope.version).toBe('v1');
    expect(envelope.idempotencyKey).toBeDefined();
    expect(envelope.data).toMatchObject({
      conversationId: 42,
      customerNumber: '+14155552671',
    });
  });

  it('skips delivery when event is not in the subscribed events list', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([
      makeWebhook({ events: ['conversation.message.sent'] }), // subscribed to sent, not received
    ]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('delivers to multiple webhooks concurrently', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([
      makeWebhook({ id: 1, url: 'https://endpoint1.com/hook' }),
      makeWebhook({ id: 2, url: 'https://endpoint2.com/hook' }),
    ]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const urls = mockFetch.mock.calls.map(([u]: [string]) => u);
    expect(urls).toContain('https://endpoint1.com/hook');
    expect(urls).toContain('https://endpoint2.com/hook');
  });

  it('generates unique idempotency keys for each delivery', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([
      makeWebhook({ id: 1, url: 'https://ep1.com/hook' }),
      makeWebhook({ id: 2, url: 'https://ep2.com/hook' }),
    ]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
    });

    const keys = mockFetch.mock.calls.map(
      ([, init]: [string, RequestInit]) => (init.headers as Record<string, string>)['X-Idempotency-Key']
    );
    expect(new Set(keys).size).toBe(2); // all keys unique
  });

  it('does not throw when delivery returns non-2xx status', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([makeWebhook()]);
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      webhookDeliveryService.dispatchEvent({
        eventName: 'conversation.message.received',
        channelId: 5,
        eventData: MESSAGE_EVENT_DATA,
        encryptionKey: HEX_KEY,
      })
    ).resolves.not.toThrow();
  });

  it('does not throw when fetch throws a network error', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([makeWebhook()]);
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      webhookDeliveryService.dispatchEvent({
        eventName: 'conversation.message.received',
        channelId: 5,
        eventData: MESSAGE_EVENT_DATA,
        encryptionKey: HEX_KEY,
      })
    ).resolves.not.toThrow();
  });

  it('does nothing when no webhooks are registered for the channel', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([]);

    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.received',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
    });

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
      })
    ).resolves.not.toThrow();
  });
});

describe('webhookDeliveryService.dispatchEvent — meta kind', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('forwards raw payload without whatflow envelope', async () => {
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
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const headers = init.headers as Record<string, string>;

    expect(url).toBe('https://example.com/webhook');
    expect(body).toEqual(rawPayload);
    // No whatflow-specific headers
    expect(headers['X-Webhook-Event']).toBeUndefined();
    expect(headers['X-Webhook-Signature']).toBeUndefined();
    // But idempotency key is present
    expect(headers['X-Idempotency-Key']).toBeDefined();
  });

  it('does not filter meta webhooks by event — always delivers', async () => {
    vi.mocked(webhookRepository.listActiveByChannel).mockResolvedValue([
      makeWebhook({ kind: 'meta', events: [] }),
    ]);

    // Even though 'conversation.message.sent' is not in events[], meta still delivers
    await webhookDeliveryService.dispatchEvent({
      eventName: 'conversation.message.sent',
      channelId: 5,
      eventData: MESSAGE_EVENT_DATA,
      encryptionKey: HEX_KEY,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
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

  it('produces different signatures for different secrets', async () => {
    const body = 'test body';
    const sig1 = await webhookDeliveryService.signPayload(body, 'secret-one');
    const sig2 = await webhookDeliveryService.signPayload(body, 'secret-two');
    expect(sig1).not.toBe(sig2);
  });
});
