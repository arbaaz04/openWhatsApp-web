import { z } from 'zod';

// ---------------------------------------------------------------------------
// Meta WhatsApp Cloud API — Webhook Payload Shape
// Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
// ---------------------------------------------------------------------------

const MetaTextMessageSchema = z.object({
  body: z.string(),
});

const MetaButtonPayloadSchema = z.object({
  text: z.string(),
  payload: z.string(),
});

const MetaMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.enum(['text', 'button', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contacts', 'interactive', 'order', 'system', 'unknown']),
  text: MetaTextMessageSchema.optional(),
  button: MetaButtonPayloadSchema.optional(),
});

const MetaMetadataSchema = z.object({
  display_phone_number: z.string(),
  phone_number_id: z.string(),
});

const MetaChangeValueSchema = z.object({
  messaging_product: z.string(),
  metadata: MetaMetadataSchema,
  messages: z.array(MetaMessageSchema).optional(),
  statuses: z.array(z.record(z.string(), z.unknown())).optional(),
  errors: z.array(z.record(z.string(), z.unknown())).optional(),
});

const MetaChangeSchema = z.object({
  value: MetaChangeValueSchema,
  field: z.string(),
});

const MetaEntrySchema = z.object({
  id: z.string(),
  changes: z.array(MetaChangeSchema),
});

export const MetaWebhookPayloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(MetaEntrySchema),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types — single source of truth, no duplication
// ---------------------------------------------------------------------------
export type MetaWebhookPayload = z.infer<typeof MetaWebhookPayloadSchema>;
export type MetaEntry = z.infer<typeof MetaEntrySchema>;
export type MetaChange = z.infer<typeof MetaChangeSchema>;
export type MetaChangeValue = z.infer<typeof MetaChangeValueSchema>;
export type MetaMessage = z.infer<typeof MetaMessageSchema>;

// ---------------------------------------------------------------------------
// Outbound webhook event types — sent FROM WhatFlow TO user endpoints
// ---------------------------------------------------------------------------

/** All subscribable event names. Must mirror `webhookEventEnum` in schema.ts. */
export type WebhookEventName =
  | 'conversation.message.received'
  | 'conversation.message.sent'
  | 'conversation.window.opened'
  | 'conversation.window.closed';

/** Payload for message-received and message-sent events. */
export interface MessageEventData {
  conversationId: number;
  messageId: number;
  channelId: number;
  /** Customer's WhatsApp number in E.164 format */
  customerNumber: string;
  /** Message body text */
  body: string;
  /** `incoming` for received, `outgoing` for sent */
  direction: 'incoming' | 'outgoing';
  /** WhatsApp message ID (wamid) for deduplication */
  wamid?: string | null;
  timestamp: string; // ISO-8601
}

/** Payload for window-opened and window-closed events. */
export interface WindowEventData {
  conversationId: number;
  channelId: number;
  customerNumber: string;
  timestamp: string; // ISO-8601
}

/**
 * Discriminated union for all outbound webhook event payloads.
 * Ensures callers can type-narrow on `event` to access the correct `data` shape.
 */
export type WhatflowWebhookEvent =
  | { event: 'conversation.message.received'; data: MessageEventData }
  | { event: 'conversation.message.sent'; data: MessageEventData }
  | { event: 'conversation.window.opened'; data: WindowEventData }
  | { event: 'conversation.window.closed'; data: WindowEventData };

/** The full envelope shape posted to user endpoints for `whatflow`-kind webhooks. */
export interface WhatflowWebhookEnvelope {
  event: WebhookEventName;
  version: 'v1';
  /** UUID per delivery for deduplication and audit */
  idempotencyKey: string;
  timestamp: string; // ISO-8601
  data: MessageEventData | WindowEventData;
}

/**
 * Batched envelope — sent when multiple events accumulate within the batch window.
 * Receivers MUST check for `events` array (batch) vs. individual event fields.
 */
export interface WhatflowBatchEnvelope {
  version: 'v1';
  /** Total number of events in this batch */
  batchSize: number;
  events: WhatflowWebhookEnvelope[];
}

// ---------------------------------------------------------------------------
// Queue job types — for the USER_WEBHOOK_QUEUE retry mechanism
// ---------------------------------------------------------------------------

/**
 * A job enqueued in `USER_WEBHOOK_QUEUE` for async delivery / retry.
 *
 * On first failure, attempt=1 is enqueued. The queue consumer tries delivery
 * and re-enqueues with attempt++ on failure. After MAX_DELIVERY_ATTEMPTS the
 * queue's native DLQ catches it.
 */
export interface UserWebhookJob {
  /** ID of the user_webhooks row — used to look up URL + secret + kind */
  webhookId: number;
  /** AES-256-GCM encryption key — needed to decrypt the stored secret */
  encryptionKey: string;
  /** Event name that triggered this delivery */
  eventName: WebhookEventName;
  /** Typed event payload */
  eventData: MessageEventData | WindowEventData;
  /**
   * Raw Meta payload — forwarded verbatim for `meta`-kind webhooks.
   * Null for non-Meta-triggered events.
   */
  rawMetaPayload?: unknown;
  /**
   * Which attempt this is (1-indexed).
   * attempt=1 = first retry (delivery already failed once in dispatchEvent).
   */
  attempt: number;
  /**
   * Pre-computed idempotencyKey from the original delivery attempt.
   * Preserved across retries so the receiver can deduplicate correctly.
   */
  idempotencyKey: string;
}
