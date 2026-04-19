/**
 * @file webhookDeliveryService.ts
 *
 * Dispatches outbound webhook events to user-registered HTTPS endpoints.
 *
 * ## Phase 2 — Retry Policy
 * On first delivery failure the job is enqueued in `USER_WEBHOOK_QUEUE`.
 * The queue consumer calls `deliverFromQueue()` which reattempts delivery.
 * Exponential back-off is handled by the queue's native `delaySeconds`:
 *   attempt 1 → +10 s
 *   attempt 2 → +40 s
 *   attempt 3 → +90 s
 *   attempt 4+ → native DLQ (max_retries in wrangler.json)
 *
 * ## Phase 2 — Event Batching
 * Events for the same `webhookId` that arrive within `BATCH_WINDOW_MS` are
 * accumulated in an in-memory buffer and delivered as a single POST containing
 * a `WhatflowBatchEnvelope`. This cuts per-webhook HTTP overhead considerably.
 *
 * Batching is applied at the `dispatchEvent` layer (initial delivery to
 * whatflow-kind endpoints). Retried jobs are always delivered individually so
 * that per-event idempotency keys are preserved.
 *
 * ## Security
 * For `whatflow`-kind webhooks, every request is signed with HMAC-SHA256
 * using the user's stored secret. Receivers should validate the
 * `X-Webhook-Signature` header before trusting the payload.
 *
 * For `meta`-kind webhooks the raw Meta payload is forwarded verbatim with an
 * `X-Idempotency-Key` header for deduplication.
 *
 * ## Timeout
 * Every outbound fetch is wrapped in a 10-second `AbortController`.
 *
 * ## Calling convention
 * Always call `dispatchEvent` via:
 *   executionCtx.waitUntil(webhookDeliveryService.dispatchEvent(...))
 */

import { webhookRepository } from '../repositories/webhookRepository.js';
import { logger } from '../utils/logger.js';
import type {
  WebhookEventName,
  MessageEventData,
  WindowEventData,
  ConversationLifecycleEventData,
  MessageStatusEventData,
  UserWebhookJob,
} from '../types/webhook.types.js';
import type { WorkerBindings } from '../types/bindings.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Per-delivery HTTP timeout in milliseconds. */
const DELIVERY_TIMEOUT_MS = 10_000;

/** Maximum payload size we will POST (512 KB). */
const MAX_PAYLOAD_BYTES = 512 * 1024;

/** Max attempts before the Cloudflare Queue's DLQ catches remaining failures. */
const MAX_DELIVERY_ATTEMPTS = 3;

/**
 * Event batching window in milliseconds.
 * Events for the same webhookId that arrive within this window are coalesced.
 */
const BATCH_WINDOW_MS = 5_000;

/** Maximum number of events in a single batch before it is flushed early. */
const MAX_BATCH_SIZE = 10;

// ---------------------------------------------------------------------------
// Internal: HMAC-SHA256 signing
// ---------------------------------------------------------------------------

async function computeHmac(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Internal: in-memory batch buffer
// ---------------------------------------------------------------------------

interface BatchEntry {
  envelope: WhatflowWebhookEnvelope;
  target: DeliveryTarget;
}

/**
 * Per-webhookId batch buffer.
 * Key: webhookId; Value: accumulated envelopes + flush timer handle.
 */
const batchBuffer = new Map<number, {
  entries: BatchEntry[];
  timer: ReturnType<typeof setTimeout>;
  encryptionKey: string;
  queueBinding?: Queue<UserWebhookJob>;
}>();

async function flushBatch(webhookId: number): Promise<void> {
  const batch = batchBuffer.get(webhookId);
  if (!batch || batch.entries.length === 0) {
    batchBuffer.delete(webhookId);
    return;
  }

  batchBuffer.delete(webhookId);

  const { entries, encryptionKey, queueBinding } = batch;
  const target = entries[0].target;

  const batchEnvelope: WhatflowBatchEnvelope = {
    version: 'v1',
    batchSize: entries.length,
    events: entries.map((e) => e.envelope),
  };

  const body = JSON.stringify(batchEnvelope);
  if (new TextEncoder().encode(body).byteLength > MAX_PAYLOAD_BYTES) {
    logger.warn('Batched webhook payload exceeds size limit — skipped', { webhookId });
    return;
  }

  const hmac = await computeHmac(body, target.secret);
  const idempotencyKey = crypto.randomUUID(); // one key for the whole batch

  const success = await deliverHttp(target.url, body, {
    'Content-Type': 'application/json',
    'X-Webhook-Batch': 'true',
    'X-Webhook-Signature': `sha256=${hmac}`,
    'X-Idempotency-Key': idempotencyKey,
    'X-Webhook-Payload-Version': 'v1',
  });

  if (!success && queueBinding) {
    // On batch failure, re-enqueue each event individually so retries preserve idempotencyKey
    for (const entry of entries) {
      const job: UserWebhookJob = {
        webhookId: target.id,
        encryptionKey,
        eventName: entry.envelope.event,
        eventData: entry.envelope.data as MessageEventData | WindowEventData | ConversationLifecycleEventData | MessageStatusEventData,
        attempt: 1,
        idempotencyKey: entry.envelope.idempotencyKey,
      };
      try {
        await queueBinding.send(job, { delaySeconds: 10 });
      } catch (err: unknown) {
        logger.error('Failed to enqueue retry job after batch failure', {
          webhookId: target.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Internal: HTTP delivery primitive
// ---------------------------------------------------------------------------

async function deliverHttp(
  url: string,
  body: string,
  headers: Record<string, string>
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn('Webhook endpoint returned non-2xx', { url, status: res.status });
      return false;
    }

    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Webhook HTTP delivery failed', {
      url,
      error: message,
      timedOut: message.includes('abort') || message.includes('AbortError'),
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Internal: delivery targets
// ---------------------------------------------------------------------------

interface DeliveryTarget {
  id: number;
  url: string;
  kind: 'whatflow-web' | 'meta';
  secret: string;
  events: WebhookEventName[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DispatchEventInput {
  eventName: WebhookEventName;
  channelId: number;
  eventData: MessageEventData | WindowEventData | ConversationLifecycleEventData | MessageStatusEventData;
  rawMetaPayload?: unknown;
  encryptionKey: string;
  /** Optional — provide to enable retry enqueuing on failure. */
  env?: Pick<WorkerBindings, 'USER_WEBHOOK_QUEUE'>;
}

export const webhookDeliveryService = {
  /**
   * Dispatches an event to all active webhooks registered for the given channel.
   *
   * **Batching (whatflow kind):** Events for the same webhook within
   * `BATCH_WINDOW_MS` (5 s) are accumulated and delivered as a single POST.
   * If the batch is already full (`MAX_BATCH_SIZE`) it is flushed immediately.
   *
   * **Retry (on failure):** If delivery fails and `env.USER_WEBHOOK_QUEUE` is
   * provided, a retry job is enqueued with a 10-second delay.
   *
   * **Meta kind:** Bypass batching — forwarded immediately with no retry.
   *
   * Fire-and-forget: call via `executionCtx.waitUntil(...)`.
   */
  async dispatchEvent(input: DispatchEventInput): Promise<void> {
    const { eventName, channelId, eventData, rawMetaPayload, encryptionKey, env } = input;

    let targets: DeliveryTarget[];

    try {
      const webhooks = await webhookRepository.listActiveByChannel(channelId, encryptionKey);
      targets = webhooks.map((wh) => ({
        id: wh.id,
        url: wh.url,
        kind: wh.kind,
        secret: wh.secret,
        events: wh.events,
      }));
    } catch (err: unknown) {
      logger.error('Failed to load webhooks for dispatch', {
        channelId,
        eventName,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (targets.length === 0) return;

    for (const target of targets) {
      if (target.kind === 'whatflow-web') {
        // Event filtering
        if (!target.events.includes(eventName)) {
          logger.debug('Skipping webhook — event not subscribed', {
            webhookId: target.id,
            eventName,
          });
          continue;
        }

        const idempotencyKey = crypto.randomUUID();
        const envelope: WhatflowWebhookEnvelope = {
          event: eventName,
          version: 'v1',
          idempotencyKey,
          timestamp: new Date().toISOString(),
          data: eventData,
        };

        // ── Batching ──────────────────────────────────────────────────────
        const existing = batchBuffer.get(target.id);
        if (existing) {
          existing.entries.push({ envelope, target });
          if (existing.entries.length >= MAX_BATCH_SIZE) {
            clearTimeout(existing.timer);
            void flushBatch(target.id);
          }
          continue;
        }

        // Start a new batch window
        const timer = setTimeout(() => void flushBatch(target.id), BATCH_WINDOW_MS);
        batchBuffer.set(target.id, {
          entries: [{ envelope, target }],
          timer,
          encryptionKey,
          queueBinding: env?.USER_WEBHOOK_QUEUE,
        });
      } else {
        // ── Meta kind: immediate, no batching ────────────────────────────
        const payload = rawMetaPayload ?? eventData;
        const idempotencyKey = crypto.randomUUID();
        const body = JSON.stringify(payload);

        const success = await deliverHttp(target.url, body, {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        });

        if (!success) {
          logger.warn('Meta webhook delivery failed — not retried', {
            webhookId: target.id,
            url: target.url,
          });
        }
      }
    }
  },

  /**
   * Processes a single `UserWebhookJob` from the `USER_WEBHOOK_QUEUE`.
   *
   * Called by the queue consumer in `index.ts`. Attempts delivery and
   * re-enqueues with increased `attempt` and delay on failure, up to
   * `MAX_DELIVERY_ATTEMPTS`. Beyond that, lets the native DLQ handle it.
   */
  async deliverFromQueue(
    job: UserWebhookJob,
    env: Pick<WorkerBindings, 'USER_WEBHOOK_QUEUE' | 'DATA_ENCRYPTION_KEY'>
  ): Promise<void> {
    const { webhookId, eventName, eventData, rawMetaPayload, attempt, idempotencyKey } = job;

    // Look up the webhook — if deleted, silently discard
    let target: DeliveryTarget | null = null;
    try {
      const rows = await webhookRepository.listActiveByChannel(-1, env.DATA_ENCRYPTION_KEY);
      // Fallback: look up directly by ID — we need a dedicated repo method
      // The repo's getById requires teamId; for queue consumer we use the stored ID directly.
      // We query from userWebhooks where id = webhookId
      const { db } = await import('../db/index.js');
      const { userWebhooks } = await import('../db/schema.js');
      const { eq } = await import('drizzle-orm');
      const { decrypt } = await import('../utils/encryption.js');

      const [row] = await db
        .select()
        .from(userWebhooks)
        .where(eq(userWebhooks.id, webhookId))
        .limit(1);

      if (!row || !row.isActive) {
        logger.info('Webhook deleted or inactive — discarding retry job', { webhookId, attempt });
        return;
      }

      const secret = await decrypt(row.encryptedSecret, env.DATA_ENCRYPTION_KEY);
      target = {
        id: row.id,
        url: row.url,
        kind: row.kind,
        secret,
        events: row.events.split(',').filter(Boolean) as WebhookEventName[],
      };

      // Suppress unused variable warning (rows was fetched then replaced)
      void rows;
    } catch (err: unknown) {
      logger.error('Failed to load webhook for retry delivery', {
        webhookId,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err; // Let the Queue automatically retry the consumer invocation
    }

    let success = false;

    if (target.kind === 'whatflow-web') {
      const envelope: WhatflowWebhookEnvelope = {
        event: eventName,
        version: 'v1',
        idempotencyKey, // same key as original attempt — receiver can deduplicate
        timestamp: new Date().toISOString(),
        data: eventData,
      };

      const body = JSON.stringify(envelope);
      const hmac = await computeHmac(body, target.secret);

      success = await deliverHttp(target.url, body, {
        'Content-Type': 'application/json',
        'X-Webhook-Event': eventName,
        'X-Webhook-Signature': `sha256=${hmac}`,
        'X-Idempotency-Key': idempotencyKey,
        'X-Webhook-Payload-Version': 'v1',
        'X-Webhook-Retry-Attempt': String(attempt),
      });
    } else {
      const payload = rawMetaPayload ?? eventData;
      const body = JSON.stringify(payload);

      success = await deliverHttp(target.url, body, {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
        'X-Webhook-Retry-Attempt': String(attempt),
      });
    }

    if (success) {
      logger.info('Webhook retry delivery succeeded', { webhookId, attempt, url: target.url });
      return;
    }

    // Still failing — enqueue next retry if under the attempt cap
    if (attempt < MAX_DELIVERY_ATTEMPTS) {
      const backoffSeconds = [10, 40, 90][attempt - 1] ?? 90;
      const nextJob: UserWebhookJob = { ...job, attempt: attempt + 1 };

      try {
        await env.USER_WEBHOOK_QUEUE.send(nextJob, { delaySeconds: backoffSeconds });
        logger.info('Webhook retry re-enqueued', {
          webhookId,
          nextAttempt: attempt + 1,
          backoffSeconds,
        });
      } catch (err: unknown) {
        logger.error('Failed to re-enqueue webhook retry job', {
          webhookId,
          attempt,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err; // Re-throw so Queue retries the consumer message
      }
    } else {
      logger.error('Webhook delivery exhausted all retry attempts — dropping to DLQ', {
        webhookId,
        attempt,
        url: target.url,
      });
      // Throw so Queue's native DLQ handles it
      throw new Error(`Webhook delivery failed after ${attempt} attempts`);
    }
  },

  /**
   * Exposed for unit testing: computes the HMAC-SHA256 signature exactly as it
   * would appear in the `X-Webhook-Signature` header.
   * Format: `sha256=<hex-digest>`.
   */
  async signPayload(body: string, secret: string): Promise<string> {
    return `sha256=${await computeHmac(body, secret)}`;
  },

  /**
   * Exposed for testing: flush all pending batch buffers immediately.
   * Not for production use.
   */
  async _flushAllBatches(): Promise<void> {
    for (const webhookId of batchBuffer.keys()) {
      const batch = batchBuffer.get(webhookId);
      if (batch) clearTimeout(batch.timer);
      await flushBatch(webhookId);
    }
  },
};
