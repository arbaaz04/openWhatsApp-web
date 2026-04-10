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
