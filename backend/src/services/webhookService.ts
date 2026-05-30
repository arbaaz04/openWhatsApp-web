import { logger } from '../utils/logger.js';
import { type DrizzleDb } from '../db/index.js';
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
 *
 * After each successful message ingestion, a `conversation.message.received`
 * event is dispatched to all active user webhooks for the channel (fire-and-forget).
 */
export const webhookService = {
  async processPayload(
    db: DrizzleDb,
    payload: MetaWebhookPayload,
    env?: WorkerBindings
  ): Promise<void> {
    const { messageRepository } = await import('../repositories/messageRepository.js');
    const { webhookDeliveryService } = await import('./webhookDeliveryService.js');
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
          } else if (msg.type === 'image' && msg.image?.id) {
            bodyText = `[MEDIA:image:${msg.image.id}]${msg.image.caption || ''}`;
          } else if (msg.type === 'video' && msg.video?.id) {
            bodyText = `[MEDIA:video:${msg.video.id}]${msg.video.caption || ''}`;
          } else if (msg.type === 'voice' && msg.voice?.id) {
            bodyText = `[MEDIA:voice:${msg.voice.id}]`;
          } else if (msg.type === 'audio' && msg.audio?.id) {
            bodyText = `[MEDIA:audio:${msg.audio.id}]`;
          } else if (msg.type === 'document' && msg.document?.id) {
            bodyText = `[MEDIA:document:${msg.document.id}]${msg.document.filename || ''}`;
          } else if (msg.type) {
            bodyText = `[${msg.type.charAt(0).toUpperCase() + msg.type.slice(1)} Message]`;
          }

          if (bodyText && msg.context?.id) {
            bodyText = `[REPLY:${msg.context.id}]${bodyText}`;
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
            const { messageId, conversationId } = await messageRepository.processIncomingMessage(
              db,
              phoneNumberId,
              customerPhone,
              bodyText,
              msg.id  // wamid — deduplicates duplicate webhook deliveries from Meta
            );

            // ── Broadcast to InboxSync Durable Object (real-time UI) ──────────
            if (env?.INBOX_SYNC) {
              const id = env.INBOX_SYNC.idFromName(phoneNumberId);
              const stub = env.INBOX_SYNC.get(id);
              try {
                const broadcastRes = await stub.fetch(
                  new Request('http://internal/broadcast', {
                    method: 'POST',
                    headers: {
                      'x-internal-auth': env.META_APP_SECRET,
                    },
                    body: JSON.stringify({
                      type: 'incoming',
                      messageId,
                      conversationId,
                      customerPhone,
                      bodyText,
                      timestamp: new Date().toISOString(),
                      phoneNumberId,
                      wamid: msg.id,
                    }),
                  })
                );
                if (!broadcastRes.ok) {
                  logger.error('Durable Object WS broadcast failed', {
                    status: broadcastRes.status,
                    body: await broadcastRes.text()
                  });
                } else {
                  logger.info('Durable Object WS broadcast succeeded');
                }
              } catch (err) {
                logger.error('Durable Object fetch crashed during broadcast', {
                  error: err instanceof Error ? err.message : String(err)
                });
              }
            }

            // ── Dispatch user webhooks (fire-and-forget) ────────────────────
            // If DATA_ENCRYPTION_KEY is not available (e.g. test env) we skip.
            if (env?.DATA_ENCRYPTION_KEY && conversationId) {
              try {
                const { conversations } = await import('../db/schema.js');
                const { eq } = await import('drizzle-orm');

                const [convRow] = await db
                  .select({ channelId: conversations.channelId })
                  .from(conversations)
                  .where(eq(conversations.id, conversationId))
                  .limit(1);

                if (convRow) {
                  // We don't await — fire and forget
                  void webhookDeliveryService.dispatchEvent({
                    eventName: 'conversation.message.received',
                    channelId: convRow.channelId,
                    eventData: {
                      conversationId,
                      messageId,
                      channelId: convRow.channelId,
                      customerNumber: customerPhone,
                      body: bodyText,
                      direction: 'incoming',
                      wamid: msg.id,
                      timestamp: new Date().toISOString(),
                    },
                    rawMetaPayload: payload,
                    encryptionKey: env.DATA_ENCRYPTION_KEY,
                    db,
                    env,
                  });
                }
              } catch (err: unknown) {
                logger.warn('Failed to dispatch user webhooks for incoming message', {
                  conversationId,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
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
