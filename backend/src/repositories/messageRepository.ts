import { db } from '../db/index.js';
import { channels, conversations, messages } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { ApiError } from '../utils/errors.js';

export const messageRepository = {
  /**
   * Processes an incoming WhatsApp message end-to-end:
   * 1. Resolves the channel by phone_number_id
   * 2. Finds or creates a conversation scoped to (channel_id + customer_number)
   * 3. Refreshes the 24-hour service window timestamp
   * 4. Persists the message record
   *
   * @param phoneNumberId - The receiving phone number ID from Meta webhook metadata
   * @param customerNumber - The sender's WhatsApp number (E.164 format)
   * @param body - Decoded message body text
   */
  async processIncomingMessage(
    phoneNumberId: string,
    customerNumber: string,
    body: string
  ): Promise<void> {
    // 1. Resolve Channel — fail fast if not registered
    const channelRes = await db
      .select()
      .from(channels)
      .where(eq(channels.whatsappId, phoneNumberId))
      .limit(1);

    const channel = channelRes[0];
    if (!channel) {
      throw new ApiError(404, `Channel not found for phone_number_id: ${phoneNumberId}`, 'CHANNEL_NOT_FOUND');
    }

    // 2. Resolve Conversation scoped by both channel AND customer
    //    Without channelId scope, two channels receiving the same customer number
    //    would incorrectly share a conversation record.
    const conversationRes = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.channelId, channel.id),
          eq(conversations.customerNumber, customerNumber)
        )
      )
      .limit(1);

    let conversationId: number;

    if (!conversationRes[0]) {
      // First message from this customer on this channel — create conversation
      const inserted = await db
        .insert(conversations)
        .values({
          channelId: channel.id,
          customerNumber,
          lastCustomerMessageAt: new Date(),
          isWindowOpen: true,
        })
        .returning({ id: conversations.id });

      conversationId = inserted[0].id;
    } else {
      conversationId = conversationRes[0].id;

      // 3. Refresh 24-hour service window — always update on inbound message
      await db
        .update(conversations)
        .set({
          lastCustomerMessageAt: new Date(),
          isWindowOpen: true,
        })
        .where(eq(conversations.id, conversationId));
    }

    // 4. Persist the message record
    await db.insert(messages).values({
      conversationId,
      body,
      direction: 'incoming' as const,
      status: 'delivered' as const,
    });
  },
};
