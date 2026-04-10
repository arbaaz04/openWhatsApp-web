import {
  pgTable,
  pgEnum,
  serial,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums — enforce valid values at the DB level, not just in application code.
// ---------------------------------------------------------------------------

/** Channel type: how the WhatsApp connection is made */
export const channelTypeEnum = pgEnum('channel_type', ['sim', 'business_app']);

/** Message direction relative to the business */
export const messageDirectionEnum = pgEnum('message_direction', [
  'incoming',
  'outgoing',
  'echo',
]);

/** Message delivery status */
export const messageStatusEnum = pgEnum('message_status', [
  'sent',
  'delivered',
  'read',
  'failed',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * Channels — a registered WhatsApp number or Business App connection.
 */
export const channels = pgTable(
  'channels',
  {
    id: serial('id').primaryKey(),
    // userId will reference a users table once the auth layer is built.
    // Left nullable for now so channels can be registered without a logged-in user.
    userId: integer('user_id'),
    type: channelTypeEnum('type').notNull(),
    phoneNumber: varchar('phone_number', { length: 20 }),
    whatsappId: text('whatsapp_phone_number_id'),
    wabaId: text('waba_id'),
    accessToken: text('access_token').notNull(),
    status: varchar('status').default('active'),
  },
  (t) => ({
    whatsappIdIdx: uniqueIndex('channels_whatsapp_id_idx').on(t.whatsappId),
  })
);

/**
 * Conversations — a messaging thread between a channel and a customer.
 * The 24-hour service window is tracked here.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id').references(() => channels.id),
    customerNumber: varchar('customer_number').notNull(),
    lastCustomerMessageAt: timestamp('last_customer_message_at'),
    isWindowOpen: boolean('is_window_open').default(false),
  },
  (t) => ({
    // Composite index covering the exact WHERE clause in messageRepository:
    // WHERE channel_id = ? AND customer_number = ?
    channelCustomerIdx: index('conversations_channel_customer_idx').on(
      t.channelId,
      t.customerNumber
    ),
  })
);

/**
 * Messages — individual WhatsApp messages in both directions.
 */
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id').references(() => conversations.id),
    body: text('body'),
    direction: messageDirectionEnum('direction'),
    status: messageStatusEnum('status'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    conversationIdIdx: index('messages_conversation_id_idx').on(t.conversationId),
  })
);
