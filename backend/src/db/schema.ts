import { pgTable, serial, text, timestamp, varchar, integer, boolean } from 'drizzle-orm/pg-core';

/**
 * Channels Table
 * Represents a connected mobile number or business app connection.
 */
export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'sim' | 'business_app'
  phoneNumber: varchar('phone_number', { length: 20 }),
  whatsappId: text('whatsapp_phone_number_id'),
  wabaId: text('waba_id'),
  accessToken: text('access_token'),
  status: varchar('status').default('active'),
});

/**
 * Conversations Table
 * Groups messages between a channel and a specific customer.
 * Used heavily for the 24-hour window logic.
 */
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  channelId: integer('channel_id').references(() => channels.id),
  customerNumber: varchar('customer_number').notNull(),
  lastCustomerMessageAt: timestamp('last_customer_message_at'), // Used to check 24h window
  isWindowOpen: boolean('is_window_open').default(false),
});

/**
 * Messages Table
 * Direct mapping of incoming and outgoing WhatsApp messages.
 */
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id),
  body: text('body'),
  direction: varchar('direction'), // 'incoming' | 'outgoing' | 'echo'
  status: varchar('status'), // 'sent' | 'delivered' | 'read'
  createdAt: timestamp('created_at').defaultNow(),
});
