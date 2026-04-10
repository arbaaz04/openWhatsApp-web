import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webhookService } from './webhookService.js';
import { messageRepository } from '../repositories/messageRepository.js';

// Fully mock the underlying database logic relay
vi.mock('../repositories/messageRepository.js', () => ({
  messageRepository: {
    processIncomingMessage: vi.fn(),
  }
}));

describe('Webhook Payload Execution Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should silently ignore non-whatsapp_business_account payloads without fault', async () => {
    const res = await webhookService.processPayload({ object: 'instagram_page' });
    expect(res).toBeUndefined();
    expect(messageRepository.processIncomingMessage).not.toHaveBeenCalled();
  });

  it('should iterate deeply nested meta webhook JSON extracting precise customer logic', async () => {
    const mockPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'hostPhone123' },
                messages: [
                  { from: 'customerPhone456', type: 'text', text: { body: 'Hello' } }
                ]
              }
            }
          ]
        }
      ]
    };

    await webhookService.processPayload(mockPayload);
    
    expect(messageRepository.processIncomingMessage).toHaveBeenCalledOnce();
    expect(messageRepository.processIncomingMessage).toHaveBeenCalledWith('hostPhone123', 'customerPhone456', 'Hello');
  });

  it('should gracefully handle unexpected missing payload bounds', async () => {
    const brokenPayload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [] }]
    };

    // Should natively fall back against optional chaining bounds silently avoiding crashes
    await expect(webhookService.processPayload(brokenPayload)).resolves.not.toThrow();
  });
});
