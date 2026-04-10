import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webhookService } from '../services/webhookService.js';
import { messageRepository } from '../repositories/messageRepository.js';
import type { MetaWebhookPayload } from '../types/webhook.types.js';

vi.mock('../repositories/messageRepository.js', () => ({
  messageRepository: {
    processIncomingMessage: vi.fn(),
  },
}));

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

describe('Webhook Service — Payload Processing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should process a valid text message and call the repository', async () => {
    await webhookService.processPayload(basePayload());

    expect(messageRepository.processIncomingMessage).toHaveBeenCalledOnce();
    expect(messageRepository.processIncomingMessage).toHaveBeenCalledWith('host123', 'cust456', 'Hello');
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

    expect(messageRepository.processIncomingMessage).toHaveBeenCalledWith('host123', 'cust456', 'Yes please');
  });

  it('should not throw if the repository throws — silently logs', async () => {
    vi.mocked(messageRepository.processIncomingMessage).mockRejectedValueOnce(
      new Error('DB connection lost')
    );

    await expect(webhookService.processPayload(basePayload())).resolves.not.toThrow();
  });
});
