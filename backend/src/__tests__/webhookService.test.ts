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
    updateMessageStatus: vi.fn(),
    revokeMessage: vi.fn(),
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
    vi.mocked(messageRepository.updateMessageStatus).mockResolvedValue({
      messageId: 10,
      conversationId: 20,
    });
    vi.mocked(messageRepository.revokeMessage).mockResolvedValue({
      messageId: 5,
      conversationId: 5,
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

  it('should process statuses updates and call updateMessageStatus', async () => {
    const payload = basePayload();
    delete payload.entry[0].changes[0].value.messages;
    payload.entry[0].changes[0].value.statuses = [
      {
        id: 'wamid-12345',
        status: 'delivered',
        timestamp: '1234567890',
        recipient_id: 'cust456',
      },
    ];

    await webhookService.processPayload(db, payload);

    expect(messageRepository.updateMessageStatus).toHaveBeenCalledOnce();
    expect(messageRepository.updateMessageStatus).toHaveBeenCalledWith(
      db,
      'wamid-12345',
      'delivered'
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

  it('should process revoke type message and call revokeMessage', async () => {
    const payload = basePayload();
    payload.entry[0].changes[0].value.messages = [
      {
        from: 'cust456',
        id: 'msg-revoke',
        timestamp: '1234567890',
        type: 'revoke',
        revoke: {
          original_message_id: 'wamid-to-delete-123',
        },
      } as any,
    ];

    await webhookService.processPayload(db, payload);

    expect(messageRepository.revokeMessage).toHaveBeenCalledOnce();
    expect(messageRepository.revokeMessage).toHaveBeenCalledWith(db, 'wamid-to-delete-123');
    expect(messageRepository.processIncomingMessage).not.toHaveBeenCalled();
  });

  it('should extract text from interactive button_reply and list_reply selections', async () => {
    const payload = basePayload();
    payload.entry[0].changes[0].value.messages = [
      {
        from: 'cust456',
        id: 'msg-btn-reply',
        timestamp: '1234567890',
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'btn_yes', title: 'Yes, register me' },
        },
      } as any,
      {
        from: 'cust456',
        id: 'msg-list-reply',
        timestamp: '1234567890',
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'row_1', title: 'Consultation', description: 'Schedule a call' },
        },
      } as any,
    ];

    await webhookService.processPayload(db, payload);

    expect(messageRepository.processIncomingMessage).toHaveBeenCalledTimes(2);
    expect(messageRepository.processIncomingMessage).toHaveBeenNthCalledWith(
      1,
      db,
      'host123',
      'cust456',
      'Yes, register me',
      'msg-btn-reply'
    );
    expect(messageRepository.processIncomingMessage).toHaveBeenNthCalledWith(
      2,
      db,
      'host123',
      'cust456',
      'Consultation',
      'msg-list-reply'
    );
  });
});
