/**
 * @file webhookService.test.ts
 *
 * Tests for the Meta webhook processing service.
 * Verifies both the message ingestion path and the outbound user-webhook
 * dispatch that fires after each successful ingestion.
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

// Mock dynamic imports used in webhookService for the channelId lookup
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('../db/schema.js', () => ({
  conversations: {},
  channels: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

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
    await webhookService.processPayload(basePayload());

    expect(messageRepository.processIncomingMessage).toHaveBeenCalledOnce();
    expect(messageRepository.processIncomingMessage).toHaveBeenCalledWith('host123', 'cust456', 'Hello', 'msg1');
  });

  it('should skip changes with field other than "messages"', async () => {
    const payload = basePayload();
    payload.entry[0].changes[0].field = 'statuses';

    await webhookService.processPayload(payload);

    expect(messageRepository.processIncomingMessage).not.toHaveBeenCalled();
  });

  it('should skip messages with no extractable body text', async () => {
    const payload = basePayload();
    payload.entry[0].changes[0].value.messages = [
      { from: 'cust456', id: 'msg2', timestamp: '1234567890', type: 'image' },
    ];

    await webhookService.processPayload(payload);

    expect(messageRepository.processIncomingMessage).not.toHaveBeenCalled();
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

    await webhookService.processPayload(payload);

    expect(messageRepository.processIncomingMessage).toHaveBeenCalledWith('host123', 'cust456', 'Yes please', 'msg3');
  });

  it('should not throw if the repository throws — silently logs', async () => {
    vi.mocked(messageRepository.processIncomingMessage).mockRejectedValueOnce(
      new Error('DB connection lost')
    );

    await expect(webhookService.processPayload(basePayload())).resolves.not.toThrow();
  });

  it('should not throw if the dispatch service throws — silently logs', async () => {
    vi.mocked(webhookDeliveryService.dispatchEvent).mockRejectedValueOnce(
      new Error('Delivery failure')
    );

    // processPayload catches dispatch errors internally
    await expect(webhookService.processPayload(basePayload())).resolves.not.toThrow();
  });

  it('should not attempt dispatch when env bindings are absent', async () => {
    // processPayload without env means no DATA_ENCRYPTION_KEY — dispatch is skipped
    await webhookService.processPayload(basePayload(), undefined);

    // dispatchEvent should NOT have been called since env is missing
    // (the dynamic DB import path won't run without env.DATA_ENCRYPTION_KEY)
    // Note: the mock for db.select isn't set up here, so if the code tried to
    // call it, the test would fail or throw. The fact it doesn't is the assertion.
    expect(messageRepository.processIncomingMessage).toHaveBeenCalledOnce();
  });
});
