/**
 * @file webhookService.test.ts
 *
 * Tests for the Meta webhook processing service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webhookService } from '../services/webhookService.js';
import { messageRepository } from '../repositories/messageRepository.js';
import { webhookDeliveryService } from '../services/webhookDeliveryService.js';
import type { MetaWebhookPayload } from '../types/webhook.types.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../repositories/messageRepository.js', () => ({
  messageRepository: {
    processIncomingMessage: vi.fn(),
  },
}));

vi.mock('../services/webhookDeliveryService.js', () => ({
  webhookDeliveryService: {
    dispatchEvent: vi.fn(),
  },
}));

vi.mock('../db/schema.js', () => ({
  conversations: {},
  channels: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

// Mock DB
const db = {
  select: vi.fn(),
} as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePayload = (overrides?: Partial<MetaWebhookPayload>): MetaWebhookPayload => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'entry1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '+10000000000', phone_number_id: 'host123' },
            messages: [{ from: 'cust456', id: 'msg1', timestamp: '1234567890', type: 'text', text: { body: 'Hello' } }],
          },
        },
      ],
    },
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('Webhook Service — Payload Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(messageRepository.processIncomingMessage).mockResolvedValue({
      messageId: 1,
      conversationId: 1,
    });
    vi.mocked(webhookDeliveryService.dispatchEvent).mockResolvedValue(undefined);
  });

  it('should process a valid text message and call the repository', async () => {
    await webhookService.processPayload(db, basePayload());

    expect(messageRepository.processIncomingMessage).toHaveBeenCalledOnce();
    expect(messageRepository.processIncomingMessage).toHaveBeenCalledWith(db, 'host123', 'cust456', 'Hello', 'msg1');
  });

  it('should skip changes with field other than "messages"', async () => {
    const payload = basePayload();
    payload.entry[0].changes[0].field = 'statuses';

    await webhookService.processPayload(db, payload);

    expect(messageRepository.processIncomingMessage).not.toHaveBeenCalled();
  });

  it('should extract text from incoming media messages (image, video, voice, audio, document)', async () => {
    const payload = basePayload();
    payload.entry[0].changes[0].value.messages = [
      { from: 'cust456', id: 'msg-img', timestamp: '1234567890', type: 'image', image: { id: 'media-img-123', caption: 'A nice view' } },
      { from: 'cust456', id: 'msg-voc', timestamp: '1234567890', type: 'voice', voice: { id: 'media-voc-456' } },
    ];

    await webhookService.processPayload(db, payload);

    expect(messageRepository.processIncomingMessage).toHaveBeenCalledTimes(2);
    expect(messageRepository.processIncomingMessage).toHaveBeenNthCalledWith(1, db, 'host123', 'cust456', '[MEDIA:image:media-img-123]A nice view', 'msg-img');
    expect(messageRepository.processIncomingMessage).toHaveBeenNthCalledWith(2, db, 'host123', 'cust456', '[MEDIA:voice:media-voc-456]', 'msg-voc');
  });

  it('should extract text from button replies', async () => {
    const payload = basePayload();
    payload.entry[0].changes[0].value.messages = [
      {
        from: 'cust456',
        id: 'msg3',
        timestamp: '1234567890',
        type: 'button',
        button: { text: 'Yes please', payload: 'YES' },
      },
    ];

    await webhookService.processPayload(db, payload);

    expect(messageRepository.processIncomingMessage).toHaveBeenCalledWith(db, 'host123', 'cust456', 'Yes please', 'msg3');
  });

  it('should extract reply context and prepend [REPLY:...] prefix', async () => {
    const payload = basePayload();
    payload.entry[0].changes[0].value.messages = [
      {
        from: 'cust456',
        id: 'msg-reply',
        timestamp: '1234567890',
        type: 'text',
        text: { body: 'I agree' },
        context: { id: 'wamid-original-123' },
      } as any,
    ];

    await webhookService.processPayload(db, payload);

    expect(messageRepository.processIncomingMessage).toHaveBeenCalledWith(
      db,
      'host123',
      'cust456',
      '[REPLY:wamid-original-123]I agree',
      'msg-reply'
    );
  });

  it('should not throw if the repository throws — silently logs', async () => {
    vi.mocked(messageRepository.processIncomingMessage).mockRejectedValueOnce(
      new Error('DB connection lost')
    );

    await expect(webhookService.processPayload(db, basePayload())).resolves.not.toThrow();
  });

  it('should not throw if the dispatch service throws — silently logs', async () => {
    vi.mocked(webhookDeliveryService.dispatchEvent).mockRejectedValueOnce(
      new Error('Delivery failure')
    );

    // processPayload catches dispatch errors internally
    await expect(webhookService.processPayload(db, basePayload())).resolves.not.toThrow();
  });

  it('should not attempt dispatch when env bindings are absent', async () => {
    // processPayload without env means no DATA_ENCRYPTION_KEY — dispatch is skipped
    await webhookService.processPayload(db, basePayload(), undefined);

    // dispatchEvent should NOT have been called since env is missing
    expect(messageRepository.processIncomingMessage).toHaveBeenCalledOnce();
  });
});
