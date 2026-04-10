import { messageRepository } from '../repositories/messageRepository.js';
import { logger } from '../utils/logger.js';
import type { MetaWebhookPayload } from '../types/webhook.types.js';

/**
 * Processes a validated Meta WhatsApp webhook payload.
 * Iterates over the entry → changes → messages structure and persists each
 * incoming message via the repository layer.
 *
 * Designed to run inside Cloudflare's waitUntil() — never throws to the caller.
 * All errors are caught, logged, and dropped so the 200 ack is never delayed.
 */
export const webhookService = {
  async processPayload(
    payload: MetaWebhookPayload,
    env?: Record<string, unknown>
  ): Promise<void> {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const { metadata, messages: msgList = [] } = change.value;
        const phoneNumberId = metadata.phone_number_id;

        for (const msg of msgList) {
          const customerPhone = msg.from;

          // Extract text body based on message type
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
              bodyText
            );

            // Real-time broadcast via Durable Object
            if (env?.INBOX_SYNC) {
              const doNamespace = env.INBOX_SYNC as DurableObjectNamespace;
              // Scope the DO instance to the receiving channel, not a global default.
              // This ensures each channel's inbox is isolated.
              const id = doNamespace.idFromName(phoneNumberId);
              const stub = doNamespace.get(id);
              await stub.fetch(
                new Request('http://internal/broadcast', {
                  method: 'POST',
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
            // Log the failure but never re-throw — webhook ack must have already
            // been sent and we must not crash the isolate for one bad message.
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
