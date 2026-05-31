import { type DrizzleDb } from '../db/index.js';
import { channels, conversations, messages } from '../db/schema.js';
import { eq, and, lt, desc, gt, asc } from 'drizzle-orm';
import { ApiError } from '../utils/errors.js';

/** Default page size for cursor-based pagination. */
const DEFAULT_PAGE_SIZE = 50;
/** Hard cap — prevents clients requesting absurd page sizes. */
const MAX_PAGE_SIZE = 200;
/** Replay page cap for reconnect catch-up to avoid unbounded memory usage. */
const REPLAY_PAGE_SIZE = 500;

/**
 * A single message row returned from the repository.
 */
export interface MessageRow {
  id: number;
  conversationId: number;
  body: string | null;
  direction: 'incoming' | 'outgoing' | 'echo';
  status: string | null;
  sentBy: string | null;
  externalId: string | null;
  createdAt: Date;
}

export const messageRepository = {
  /**
   * Processes an incoming WhatsApp message end-to-end.
   */
  async processIncomingMessage(
    db: DrizzleDb,
    phoneNumberId: string,
    customerNumber: string,
    body: string,
    externalId?: string
  ): Promise<{ messageId: number; conversationId: number }> {
    return db.transaction(async (tx) => {
      // 1. Resolve Channel
      const [channel] = await tx
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.whatsappId, phoneNumberId))
        .limit(1);

      if (!channel) {
        throw new ApiError(
          404,
          `Channel not found for phone_number_id: ${phoneNumberId}`,
          'CHANNEL_NOT_FOUND'
        );
      }

      // 2. Resolve Conversation
      const [existing] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.channelId, channel.id),
            eq(conversations.customerNumber, customerNumber)
          )
        )
        .limit(1);

      let conversationId: number;

      if (!existing) {
        const [insertedConversation] = await tx
          .insert(conversations)
          .values({
            channelId: channel.id,
            customerNumber,
            lastCustomerMessageAt: new Date(),
            isWindowOpen: true,
          })
          .returning({ id: conversations.id });

        conversationId = insertedConversation.id;
      } else {
        conversationId = existing.id;
        await tx
          .update(conversations)
          .set({ lastCustomerMessageAt: new Date(), isWindowOpen: true })
          .where(eq(conversations.id, conversationId));
      }

      // 4. Persist the message record
      const [insertedMessage] = await tx
        .insert(messages)
        .values({
          conversationId,
          body,
          direction: 'incoming' as const,
          status: 'delivered' as const,
          externalId: externalId ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: messages.id });

      if (insertedMessage?.id) {
        return { messageId: insertedMessage.id, conversationId };
      }

      if (externalId) {
        const [existingMessage] = await tx
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.externalId, externalId))
          .limit(1);

        if (existingMessage) {
          return { messageId: existingMessage.id, conversationId };
        }
      }

      return { messageId: 0, conversationId };
    });
  },

  /**
   * Cursor-based pagination for messages within a conversation.
   */
  async listMessages(
    db: DrizzleDb,
    conversationId: number,
    options: { before?: number; limit?: number } = {}
  ): Promise<{ items: MessageRow[]; hasMore: boolean }> {
    const limit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const conditions = [eq(messages.conversationId, conversationId)];
    if (options.before !== undefined) {
      conditions.push(lt(messages.id, options.before));
    }

    const rows = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: items as MessageRow[],
      hasMore,
    };
  },

  /**
   * Persists a successfully sent outbound message.
   */
  async createOutboundMessage(
    db: DrizzleDb,
    conversationId: number,
    body: string,
    wamid: string,
    sentBy: string
  ): Promise<{ messageId: number }> {
    const [inserted] = await db
      .insert(messages)
      .values({
        conversationId,
        body,
        direction: 'outgoing' as const,
        status: 'sent' as const,
        sentBy,
        externalId: wamid,
      })
      .returning({ id: messages.id });

    return { messageId: inserted.id };
  },

  /**
   * Fetches all messages after a given ID for WebSocket reconnect replay.
   */
  async getMessagesSince(
    db: DrizzleDb,
    conversationId: number,
    afterMessageId: number,
    options: { limit?: number } = {}
  ): Promise<{ items: MessageRow[]; hasMore: boolean; nextCursor: number | null }> {
    const limit = Math.min(options.limit ?? REPLAY_PAGE_SIZE, REPLAY_PAGE_SIZE);

    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          gt(messages.id, afterMessageId)
        )
      )
      .orderBy(asc(messages.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows) as MessageRow[];
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    return { items, hasMore, nextCursor };
  },

  /**
   * Updates the delivery/read status of an outbound message by its external ID (wamid).
   */
  async updateMessageStatus(
    db: DrizzleDb,
    wamid: string,
    status: 'sent' | 'delivered' | 'read' | 'failed'
  ): Promise<{ messageId: number; conversationId: number } | null> {
    const [updated] = await db
      .update(messages)
      .set({ status })
      .where(eq(messages.externalId, wamid))
      .returning({ id: messages.id, conversationId: messages.conversationId });

    return updated ? { messageId: updated.id, conversationId: updated.conversationId } : null;
  },

  /**
   * Marks all incoming messages in a conversation as read in the database.
   */
  async markIncomingMessagesAsRead(
    db: DrizzleDb,
    conversationId: number
  ): Promise<void> {
    await db
      .update(messages)
      .set({ status: 'read' as const })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.direction, 'incoming' as const)
        )
      );
  },

  /**
   * Fetches the latest incoming message in a conversation.
   */
  async getLatestIncomingMessage(
    db: DrizzleDb,
    conversationId: number
  ): Promise<MessageRow | null> {
    const [msg] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.direction, 'incoming' as const)
        )
      )
      .orderBy(desc(messages.id))
      .limit(1);

    return (msg as MessageRow) || null;
  },
};
