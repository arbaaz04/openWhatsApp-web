import { db } from '../db/index.js';
import { channels, conversations, messages } from '../db/schema.js';
import { eq, and, lt, desc } from 'drizzle-orm';
import { ApiError } from '../utils/errors.js';

/** Default page size for cursor-based pagination. */
const DEFAULT_PAGE_SIZE = 50;
/** Hard cap — prevents clients requesting absurd page sizes. */
const MAX_PAGE_SIZE = 200;

/**
 * A single message row returned from the repository.
 * Uses a mapped type so consumers don't import Drizzle internals.
 */
export interface MessageRow {
  id: number;
  conversationId: number;
  body: string | null;
  direction: 'incoming' | 'outgoing' | 'echo';
  status: string | null;
  externalId: string | null;
  createdAt: Date;
}

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
   * @param externalId - The WhatsApp message ID for idempotency (deduplication)
   */
  async processIncomingMessage(
    phoneNumberId: string,
    customerNumber: string,
    body: string,
    externalId?: string
  ): Promise<{ messageId: number; conversationId: number }> {
    // 1. Resolve Channel — fail fast if not registered
    const [channel] = await db
      .select()
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

    // 2. Resolve Conversation scoped by both channel AND customer.
    //    Without channelId scope, two channels receiving the same customer number
    //    would incorrectly share a conversation record.
    const [existing] = await db
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
      // First message from this customer on this channel — create conversation
      const [inserted] = await db
        .insert(conversations)
        .values({
          channelId: channel.id,
          customerNumber,
          lastCustomerMessageAt: new Date(),
          isWindowOpen: true,
        })
        .returning({ id: conversations.id });

      conversationId = inserted.id;
    } else {
      conversationId = existing.id;

      // 3. Refresh 24-hour service window — always update on inbound message
      await db
        .update(conversations)
        .set({ lastCustomerMessageAt: new Date(), isWindowOpen: true })
        .where(eq(conversations.id, conversationId));
    }

    // 4. Persist the message record.
    //    externalId enables idempotency: the UNIQUE constraint on messages.external_id
    //    means duplicate webhook deliveries are silently ignored at the DB level.
    const [inserted] = await db
      .insert(messages)
      .values({
        conversationId,
        body,
        direction: 'incoming' as const,
        status: 'delivered' as const,
        externalId: externalId ?? null,
      })
      .onConflictDoNothing() // duplicate externalId → skip silently
      .returning({ id: messages.id });

    return { messageId: inserted?.id ?? 0, conversationId };
  },

  /**
   * Cursor-based pagination for messages within a conversation.
   *
   * Uses keyset pagination on `(id DESC)` rather than OFFSET so performance
   * stays O(log n) regardless of how many messages exist in the conversation.
   * Clients request the next page by passing the smallest `id` from
   * the previous page as the `before` cursor.
   *
   * @param conversationId - Conversation to query
   * @param options.before - Exclusive upper bound on message ID (cursor).
   *   Omit for the first page (returns the most recent messages).
   * @param options.limit - Number of messages to return (default: 50, max: 200)
   * @returns Messages in descending chronological order (newest first).
   *   The frontend should reverse this array before rendering.
   *   `hasMore` indicates whether an earlier page exists.
   *
   * @example
   * // First page — most recent 50 messages
   * const { items } = await messageRepository.listMessages(42);
   *
   * // Next page — 50 messages before the oldest one we have
   * const oldest = items[items.length - 1];
   * const { items: older } = await messageRepository.listMessages(42, { before: oldest.id });
   */
  async listMessages(
    conversationId: number,
    options: { before?: number; limit?: number } = {}
  ): Promise<{ items: MessageRow[]; hasMore: boolean }> {
    const limit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const conditions = [eq(messages.conversationId, conversationId)];
    if (options.before !== undefined) {
      conditions.push(lt(messages.id, options.before));
    }

    // Fetch one extra row to determine if there's a previous page without a
    // second COUNT(*) query.
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
   * Fetches all messages sent after a given message ID for WebSocket reconnect
   * replay. Called by InboxSync when a client reconnects with `lastSeenMessageId`.
   *
   * We use `id > lastSeenId` (not createdAt) because IDs are monotonically
   * increasing and immune to clock skew on the Postgres server.
   *
   * @param conversationId - Conversation to replay
   * @param afterMessageId - Exclusive lower bound — the client already has this message
   * @returns Messages in ascending order (oldest first) for playback order
   */
  async getMessagesSince(
    conversationId: number,
    afterMessageId: number
  ): Promise<MessageRow[]> {
    const { gt } = await import('drizzle-orm');

    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          gt(messages.id, afterMessageId)
        )
      )
      .orderBy(messages.id); // ascending — oldest first for playback

    return rows as MessageRow[];
  },
};
