import { db } from '../db/index.js';
import { channels, conversations, messages } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { ApiError } from '../utils/errors.js';

export const messageRepository = {
  /**
   * Processes an incoming WhatsApp message:
   * 1. Finds the channel
   * 2. Finds or creates the conversation
   * 3. Opens the 24-hour service window
   * 4. Logs the message
   * 
   * @param phoneNumberId - Phone Number ID from Meta webhook
   * @param customerNumber - The WhatsApp number of the customer who sent the message
   * @param body - Message text body
   */
  async processIncomingMessage(phoneNumberId: string, customerNumber: string, body: string) {
    // 1. Resolve Channel
    const channelRes = await db
      .select()
      .from(channels)
      .where(eq(channels.whatsappId, phoneNumberId))
      .limit(1);

    const channel = channelRes[0];
    if (!channel) {
      throw new ApiError(404, 'Channel not found', 'CHANNEL_NOT_FOUND');
    }

    // 2. Resolve Conversation
    let conversationRes = await db
      .select()
      .from(conversations)
      .where(eq(conversations.customerNumber, customerNumber))
      .limit(1);

    let conversationId: number;

    if (!conversationRes[0]) {
      const inserted = await db.insert(conversations).values({
        channelId: channel.id,
        customerNumber,
        lastCustomerMessageAt: new Date(),
        isWindowOpen: true,
      }).returning({ id: conversations.id });
      conversationId = inserted[0].id;
    } else {
      conversationId = conversationRes[0].id;
      // 3. Open 24h Window
      await db.update(conversations)
        .set({ 
          lastCustomerMessageAt: new Date(), 
          isWindowOpen: true 
        })
        .where(eq(conversations.id, conversationId));
    }

    // 4. Insert Message
    await db.insert(messages).values({
      conversationId,
      body,
      direction: 'incoming',
      status: 'delivered',
    });
  }
};
