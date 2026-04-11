import { messageRepository } from '../repositories/messageRepository.js';
import { logger } from '../utils/logger.js';
import type { MetaWebhookPayload } from '../types/webhook.types.js';
import type { WorkerBindings } from '../types/bindings.js';

/**
 * Processes a validated Meta WhatsApp webhook payload.
 *
 * Runs inside the Cloudflare Queue consumer.
 *
 * Per-message failures are intentionally logged and skipped to keep processing
 * the rest of the batch. Queue-level failures (outside this function) are
 * handled by the consumer, which can call `message.retry()`.
 */
export const webhookService = {
  async processPayload(
    payload: MetaWebhookPayload,
    env?: WorkerBindings
  ): Promise<void> {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const { metadata, messages: msgList = [] } = change.value;
        const phoneNumberId = metadata.phone_number_id;

        for (const msg of msgList) {
          const customerPhone = msg.from;

          let bodyText: string | undefined;
          if (msg.type === 'text') {
            bodyText = msg.text?.body;
          } else if (msg.type === 'button') {
            bodyText = msg.button?.text;
          }

          if (!phoneNumberId || !customerPhone || !bodyText) {
            logger.debug('Skipping message with missing fields', {
              phoneNumberId,
              customerPhone,
              type: msg.type,
            });
            continue;
          }

          logger.info('Processing incoming message', { customerPhone, phoneNumberId });

          try {
            await messageRepository.processIncomingMessage(
              phoneNumberId,
              customerPhone,
              bodyText,
              msg.id  // wamid — deduplicates duplicate webhook deliveries from Meta
            );

            // Broadcast to the channel's Durable Object inbox — no cast needed
            if (env?.INBOX_SYNC) {
              const id = env.INBOX_SYNC.idFromName(phoneNumberId);
              const stub = env.INBOX_SYNC.get(id);
              await stub.fetch(
                new Request('http://internal/broadcast', {
                  method: 'POST',
                  headers: {
                    'x-internal-auth': env.META_APP_SECRET,
                  },
                  body: JSON.stringify({
                    customerPhone,
                    bodyText,
                    timestamp: new Date().toISOString(),
                    phoneNumberId,
                  }),
                })
              );
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Failed to process incoming message', {
              error: message,
              customerPhone,
              phoneNumberId,
            });
          }
        }
      }
    }
  },
};
