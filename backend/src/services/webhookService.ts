import { messageRepository } from '../repositories/messageRepository.js';
import { logger } from '../utils/logger.js';

/**
 * Service to process webhook payloads from Meta WhatsApp API.
 * Maps the deeply nested payload to the actual DB repository functions.
 */
export const webhookService = {
  async processPayload(payload: Record<string, unknown>, env?: Record<string, unknown>) {
    if (payload.object !== 'whatsapp_business_account') {
      logger.debug('Ignored non-whatsapp webhook payload');
      return;
    }

    const entries = (payload.entry as Record<string, unknown>[]) || [];

    for (const entry of entries) {
      const changes = (entry.changes as Record<string, unknown>[]) || [];
      for (const change of changes) {
        if (change.field === 'messages') {
          const value = (change.value as Record<string, unknown>) || {};
          const phoneNumberId = (value.metadata as Record<string, string>)?.phone_number_id;
          const msgList = (value.messages as Record<string, unknown>[]) || [];

          for (const msg of msgList) {
            const customerPhone = msg.from as string;
            let bodyText = '';

            if (msg.type === 'text') {
              bodyText = (msg.text as Record<string, string>)?.body || '';
            } else if (msg.type === 'button') {
              bodyText = (msg.button as Record<string, string>)?.text || '';
            }

            if (phoneNumberId && customerPhone && bodyText) {
              logger.info('Processing incoming message', { customerPhone, phoneNumberId });

              try {
                await messageRepository.processIncomingMessage(
                  phoneNumberId,
                  customerPhone,
                  bodyText
                );

                // Real-Time Broadcast to UI using Durable Objects
                if (env && env.INBOX_SYNC) {
                  const syncEnv = env as { INBOX_SYNC: DurableObjectNamespace };
                  const id = syncEnv.INBOX_SYNC.idFromName('default-inbox');
                  const stub = syncEnv.INBOX_SYNC.get(id);
                  await stub.fetch(
                    new Request('http://internal/broadcast', {
                      method: 'POST',
                      body: JSON.stringify({ customerPhone, bodyText, timestamp: new Date() }),
                    })
                  );
                }
              } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                logger.error('Message repository insertion failed', { error: errorMessage });
              }
            }
          }
        }
      }
    }
  },
};
