/**
 * @file webhookDeliveryService.ts
 *
 * Dispatches outbound webhook events to user-registered HTTPS endpoints.
 *
 * ## Delivery guarantee (Phase 1)
 * Fire-and-forget: one attempt per endpoint. Failures are logged and discarded.
 * Phase 2 will layer retries via a Cloudflare Queue job.
 *
 * ## Security
 * For `whatflow`-kind webhooks, every request is signed with HMAC-SHA256
 * using the user's stored secret. Receivers should validate the
 * `X-Webhook-Signature` header before trusting the payload.
 *
 * For `meta`-kind webhooks the raw Meta payload is forwarded verbatim plus
 * an `X-Idempotency-Key` header for deduplication.
 *
 * ## Timeout
 * Every outbound fetch is wrapped in a 10-second `AbortController` to
 * prevent a slow user endpoint from eating the Worker's CPU budget.
 *
 * ## Calling convention
 * Always call via:
 *   executionCtx.waitUntil(webhookDeliveryService.dispatchEvent(...))
 * This keeps delivery non-blocking relative to the main response path.
 */

import { webhookRepository } from '../repositories/webhookRepository.js';
import { logger } from '../utils/logger.js';
import type { WhatflowWebhookEnvelope, WebhookEventName, MessageEventData, WindowEventData } from '../types/webhook.types.js';

/** Delivery timeout in milliseconds. */
const DELIVERY_TIMEOUT_MS = 10_000;

/** Maximum size for a user payload — we won't POST anything larger. */
const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB

// ---------------------------------------------------------------------------
// Internal: HMAC-SHA256 signing
// ---------------------------------------------------------------------------

/**
 * Computes HMAC-SHA256 over a JSON string using the provided secret.
 * Returns the hex digest (no `sha256=` prefix — callers add that).
 */
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
// Internal: single-endpoint delivery
// ---------------------------------------------------------------------------

interface DeliveryTarget {
  id: number;
  url: string;
  kind: 'whatflow' | 'meta';
  secret: string;
  events: WebhookEventName[];
}

/**
 * Delivers a whatflow-kind webhook POST to a single endpoint.
 * Returns `true` on HTTP 2xx, `false` on any failure.
 */
async function deliverWhatflow(
  target: DeliveryTarget,
  envelope: WhatflowWebhookEnvelope
): Promise<boolean> {
  const body = JSON.stringify(envelope);

  if (new TextEncoder().encode(body).byteLength > MAX_PAYLOAD_BYTES) {
    logger.warn('Webhook payload exceeds size limit — skipped', {
      webhookId: target.id,
      eventName: envelope.event,
    });
    return false;
  }

  const hmac = await computeHmac(body, target.secret);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const res = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': envelope.event,
        'X-Webhook-Signature': `sha256=${hmac}`,
        'X-Idempotency-Key': envelope.idempotencyKey,
        'X-Webhook-Payload-Version': envelope.version,
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn('Webhook endpoint returned non-2xx', {
        webhookId: target.id,
        url: target.url,
        status: res.status,
        event: envelope.event,
      });
      return false;
    }

    logger.info('Webhook delivered', {
      webhookId: target.id,
      url: target.url,
      event: envelope.event,
      idempotencyKey: envelope.idempotencyKey,
    });
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Webhook delivery failed', {
      webhookId: target.id,
      url: target.url,
      event: envelope.event,
      error: message,
      timedOut: message.includes('abort') || message.includes('AbortError'),
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Delivers a meta-kind webhook — forwards the raw Meta payload verbatim.
 */
async function deliverMeta(
  target: DeliveryTarget,
  rawMetaPayload: unknown,
  idempotencyKey: string
): Promise<boolean> {
  const body = JSON.stringify(rawMetaPayload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const res = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn('Meta webhook endpoint returned non-2xx', {
        webhookId: target.id,
        url: target.url,
        status: res.status,
      });
      return false;
    }

    logger.info('Meta webhook delivered', {
      webhookId: target.id,
      url: target.url,
      idempotencyKey,
    });
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Meta webhook delivery failed', {
      webhookId: target.id,
      url: target.url,
      error: message,
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DispatchEventInput {
  /** The subscribable event name. */
  eventName: WebhookEventName;
  /** The channel that generated the event — used to look up active webhooks. */
  channelId: number;
  /** Typed event payload. */
  eventData: MessageEventData | WindowEventData;
  /**
   * The raw Meta payload — only used for `meta`-kind webhook forwarding.
   * Pass `null` when dispatching non-Meta-triggered events.
   */
  rawMetaPayload?: unknown;
  /** `DATA_ENCRYPTION_KEY` from Worker bindings. */
  encryptionKey: string;
}

export const webhookDeliveryService = {
  /**
   * Dispatches an event to all active webhooks registered for the given channel.
   *
   * This is a fire-and-forget operation: all failures are logged and never
   * re-thrown. The caller should invoke this via `executionCtx.waitUntil()`
   * so it does not block the response path.
   *
   * @example
   * executionCtx.waitUntil(
   *   webhookDeliveryService.dispatchEvent({ eventName, channelId, eventData, encryptionKey })
   * );
   */
  async dispatchEvent(input: DispatchEventInput): Promise<void> {
    const { eventName, channelId, eventData, rawMetaPayload, encryptionKey } = input;

    let targets: Array<DeliveryTarget>;

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

    const deliveries: Promise<boolean>[] = [];

    for (const target of targets) {
      if (target.kind === 'whatflow') {
        // Event filtering: only dispatch events the webhook has subscribed to
        if (!target.events.includes(eventName)) {
          logger.debug('Skipping webhook — event not subscribed', {
            webhookId: target.id,
            eventName,
            subscribedEvents: target.events,
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

        deliveries.push(deliverWhatflow(target, envelope));
      } else {
        // meta kind — forward raw payload if provided
        const payload = rawMetaPayload ?? eventData;
        const idempotencyKey = crypto.randomUUID();
        deliveries.push(deliverMeta(target, payload, idempotencyKey));
      }
    }

    // Run all deliveries concurrently — failures are caught inside helpers
    await Promise.allSettled(deliveries);
  },

  /**
   * Exposed for unit testing: computes the HMAC-SHA256 signature
   * exactly as it would appear in the `X-Webhook-Signature` header.
   * Signature format: `sha256=<hex-digest>`.
   */
  async signPayload(body: string, secret: string): Promise<string> {
    return `sha256=${await computeHmac(body, secret)}`;
  },
};
