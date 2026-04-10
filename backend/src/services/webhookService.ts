import { messageRepository } from '../repositories/messageRepository.js';
import { logger } from '../utils/logger.js';

/**
 * Service to process webhook payloads from Meta WhatsApp API.
 * Maps the deeply nested payload to the actual DB repository functions.
 */
export const webhookService = {
  async processPayload(payload: any, env?: any) {
    if (payload.object !== 'whatsapp_business_account') {
      logger.debug('Ignored non-whatsapp webhook payload');
      return;
    }

    const entries = payload.entry || [];
    
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === 'messages') {
          const value = change.value || {};
          const phoneNumberId = value.metadata?.phone_number_id;
          const msgList = value.messages || [];

          for (const msg of msgList) {
            const customerPhone = msg.from;
            let bodyText = '';

            if (msg.type === 'text') {
              bodyText = msg.text?.body || '';
            } else if (msg.type === 'button') {
              bodyText = msg.button?.text || '';
            }

            if (phoneNumberId && customerPhone && bodyText) {
              logger.info('Processing incoming message', { customerPhone, phoneNumberId });
              
              try {
                await messageRepository.processIncomingMessage(phoneNumberId, customerPhone, bodyText);
                
                // Real-Time Broadcast to UI using Durable Objects
                if (env && env.INBOX_SYNC) {
                   const id = env.INBOX_SYNC.idFromName('default-inbox');
                   const stub = env.INBOX_SYNC.get(id);
                   await stub.fetch(new Request('http://internal/broadcast', { 
                     method: 'POST', 
                     body: JSON.stringify({ customerPhone, bodyText, timestamp: new Date() }) 
                   }));
                }
              } catch (e: any) {
                logger.error('Message repository insertion failed', { error: e.message });
              }
            }
          }
        }
      }
    }
  }
};
