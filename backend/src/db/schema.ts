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
// Webhook enums — added for user-registered outbound webhook support
// ---------------------------------------------------------------------------

/**
 * Payload format for outbound user webhooks.
 * - `whatflow` — structured, event-based envelope with HMAC signature
 * - `meta`     — raw Meta payload forwarding with idempotency key
 */
export const webhookKindEnum = pgEnum('webhook_kind', ['whatflow-web', 'meta']);

/**
 * Subscribable event types for `whatflow`-kind webhooks.
 * `meta`-kind webhooks receive all events, no filtering.
 */
export const webhookEventEnum = pgEnum('webhook_event', [
  'conversation.message.received',
  'conversation.message.sent',
  'conversation.window.opened',
  'conversation.window.closed',
]);

// ---------------------------------------------------------------------------
// Enums — enforce valid values at the database level.
// ---------------------------------------------------------------------------

/** WhatsApp channel connection type. */
export const channelTypeEnum = pgEnum('channel_type', ['sim', 'business_app']);

/** Message direction relative to the business. */
export const messageDirectionEnum = pgEnum('message_direction', [
  'incoming',
  'outgoing',
  'echo',
]);

/** Message delivery status. */
export const messageStatusEnum = pgEnum('message_status', [
  'sent',
  'delivered',
  'read',
  'failed',
]);

/** Channel lifecycle status. */
export const channelStatusEnum = pgEnum('channel_status', [
  'active',
  'paused',
  'disabled',
]);

/** Team member access level. */
export const teamRoleEnum = pgEnum('team_role', [
  'admin',
  'developer',
  'subordinate',
]);

// ---------------------------------------------------------------------------
// Auth / tenancy tables
// ---------------------------------------------------------------------------

/**
 * Local mirror of the Supabase auth.users record.
 * Populated on first sign-in via a user.routes.ts handler.
 * The `id` is the Supabase user UUID — used as the foreign key everywhere.
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),     // Supabase UUID — e.g. "550e8400-e29b-41d4..."
  email: varchar('email', { length: 320 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * A business account (tenant).
 * One business owner creates a team; all their channels and conversations
 * are scoped under this team. Other users can be invited as members.
 */
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Junction table linking users to teams with a role.
 *
 * - `admin`       — full access to all settings and data
 * - `developer`   — developer settings + integrations + read inbox
 * - `subordinate` — inbox and conversations only
 *
 * A user can belong to multiple teams (e.g. a freelancer managing several clients),
 * each with a different role.
 */
export const teamMembers = pgTable(
  'team_members',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: teamRoleEnum('role').notNull(),
    invitedBy: text('invited_by').references(() => users.id),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => ({
    // One membership per user per team
    uniqueMembership: uniqueIndex('team_members_unique_idx').on(t.teamId, t.userId),
    // Fast lookup: "what teams does this user belong to?"
    userTeamsIdx: index('team_members_user_id_idx').on(t.userId),
  })
);

// ---------------------------------------------------------------------------
// WhatsApp channel tables
// ---------------------------------------------------------------------------

/**
 * A registered WhatsApp number or Business App connection.
 * Scoped to a team — all queries must filter by teamId.
 *
 * `accessToken` is stored AES-256-GCM encrypted — see utils/encryption.ts.
 */
export const channels = pgTable(
  'channels',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    type: channelTypeEnum('type').notNull(),
    phoneNumber: varchar('phone_number', { length: 20 }),
    whatsappId: text('whatsapp_phone_number_id'),
    wabaId: text('waba_id'),
    /** AES-256-GCM encrypted WhatsApp access token. Never stored in plaintext. */
    accessToken: text('access_token').notNull(),
    status: channelStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    // Each phone number ID is globally unique across all WhatsApp channels
    whatsappIdIdx: uniqueIndex('channels_whatsapp_id_idx').on(t.whatsappId),
    // Fast lookup by team (the most common query shape)
    teamIdx: index('channels_team_id_idx').on(t.teamId),
  })
);

/**
 * A messaging thread between a channel and a customer.
 * Tracks the 24-hour WhatsApp service window.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id')
      .notNull()
      .references(() => channels.id),
    customerNumber: varchar('customer_number', { length: 20 }).notNull(),
    lastCustomerMessageAt: timestamp('last_customer_message_at'),
    isWindowOpen: boolean('is_window_open').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    // Composite index matching the exact WHERE in messageRepository
    channelCustomerIdx: index('conversations_channel_customer_idx').on(
      t.channelId,
      t.customerNumber
    ),
  })
);

/**
 * Individual WhatsApp messages — both directions.
 * Ordered by `createdAt` for pagination. Full history retained indefinitely.
 */
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id),
    body: text('body'),
    direction: messageDirectionEnum('direction').notNull(),
    status: messageStatusEnum('status'),
    /** Supabase user UUID of the agent who sent this outbound message. */
    sentBy: text('sent_by').references(() => users.id),
    externalId: varchar('external_id', { length: 100 }).unique(), // WhatsApp message ID
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    // Primary pagination index: "messages for conversation ordered by time"
    conversationTimeIdx: index('messages_conversation_created_idx').on(
      t.conversationId,
      t.createdAt
    ),
  })
);

// ---------------------------------------------------------------------------
// User webhook registrations
// ---------------------------------------------------------------------------

/**
 * User-registered outbound webhook endpoints.
 *
 * When an event occurs (message received, sent, etc.) WhatFlow dispatches
 * an HTTP POST to each active endpoint registered for the relevant channel.
 *
 * Two kinds are available:
 *   - `whatflow` — structured event envelope, HMAC-signed, event-filtered
 *   - `meta`     — raw Meta payload forwarded verbatim; one per channel
 *
 * `encryptedSecret` stores the HMAC signing secret AES-256-GCM encrypted
 * with `DATA_ENCRYPTION_KEY` — identical scheme to channel access tokens.
 *
 * `channelId` is nullable to support future project-level webhooks that
 * span all channels owned by a team.
 */
export const userWebhooks = pgTable(
  'user_webhooks',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    /** Null = project-level webhook; non-null = scoped to a single channel */
    channelId: integer('channel_id').references(() => channels.id, { onDelete: 'cascade' }),
    kind: webhookKindEnum('kind').notNull().default('whatflow-web'),
    /** Validated HTTPS endpoint URL */
    url: text('url').notNull(),
    /**
     * AES-256-GCM encrypted signing secret.
     * Decrypted on the fly during delivery — never returned in plaintext via API.
     */
    encryptedSecret: text('encrypted_secret').notNull(),
    /**
     * Subscribed events for `whatflow`-kind webhooks.
     * Stored as a comma-separated string of webhook_event enum values.
     * For `meta`-kind webhooks this column is ignored.
     */
    events: text('events').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    // Fast lookup by team — the primary access pattern for list endpoints
    teamIdx: index('user_webhooks_team_id_idx').on(t.teamId),
    // Fast lookup by channel — used at dispatch time to find active endpoints
    channelIdx: index('user_webhooks_channel_id_idx').on(t.channelId),
    // One meta webhook per channel — enforced at the service layer since
    // the nullable channelId makes a standard UNIQUE index impractical.
    // A partial unique index would work for non-null values but is DB-specific.
  })
);
