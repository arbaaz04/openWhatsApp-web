/**
 * @file Meta WhatsApp Business API Cloud client.
 *
 * Centralises all HTTP communication with the Meta Graph API so the rest of
 * the codebase never constructs raw `fetch` calls. Every request is:
 *   - Authenticated with a Bearer token
 *   - Automatically retried on transient 5xx and network errors
 *   - Mapped to typed error classes so callers can pattern-match on failure
 *
 * Supported API version: v21.0  (update META_API_VERSION below to bump)
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

import { ApiError } from './errors.js';
import { createLogger } from './logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Bump this to adopt a newer Graph API version. */
const META_API_VERSION = 'v25.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * How long to wait for a Meta API response before treating it as a failure.
 * Cloud API p99 latency is ~2s; 10s leaves enough headroom for bursts.
 */
const REQUEST_TIMEOUT_MS = 10_000;

/** Retry budget for transient 5xx / network failures. */
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A successfully sent WhatsApp message. */
export interface SentMessage {
  /** The WhatsApp message ID (wamid) — stored as `externalId` in the DB. */
  wamid: string;
  /** Confirmed E.164 number of the recipient (may differ from input). */
  recipientWaId: string;
}

/** Structured error codes returned by Meta. */
export interface MetaApiErrorDetail {
  code: number;
  message: string;
  type?: string;
  fbtrace_id?: string;
}

/**
 * Thrown when the Meta Graph API returns an error payload.
 * Maps Meta error codes to HTTP status codes so callers can surface them
 * correctly to the frontend without leaking the raw Meta error.
 */
export class MetaApiError extends ApiError {
  /** Raw Meta error code — useful for logging and feature branching. */
  public readonly metaCode: number;
  /** Meta's trace ID — include in support requests. */
  public readonly fbtrace_id: string | undefined;

  constructor(detail: MetaApiErrorDetail) {
    super(
      metaCodeToHttpStatus(detail.code),
      metaCodeToMessage(detail.code, detail.message),
      'META_API_ERROR'
    );
    this.metaCode = detail.code;
    this.fbtrace_id = detail.fbtrace_id;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a rich WhatsApp message via the Cloud API (text, media, interactive, etc).
 *
 * @param options.phoneNumberId   - The sender's WhatsApp phone number ID (from your Meta App)
 * @param options.accessToken     - The decrypted channel access token
 * @param options.recipientNumber - Recipient in E.164 format (e.g. "+14155551234")
 * @param options.type            - Message type ('text', 'image', 'interactive', 'template', etc)
 * @param options.messagePayload  - The type-specific payload object (e.g. { text: { body: "hi" } } or { interactive: { ... } })
 * @returns Resolved wamid and confirmed wa_id once Meta has accepted the message
 *
 * @throws {MetaApiError}  Meta returned an error response (window closed, rate limit, etc.)
 * @throws {ApiError 503}  Network failure persists after all retries
 */
export async function sendWhatsAppMessage(options: {
  phoneNumberId: string;
  accessToken: string;
  recipientNumber: string;
  type: string;
  messagePayload: Record<string, unknown>;
}): Promise<SentMessage> {
  const { phoneNumberId, accessToken, recipientNumber, type, messagePayload } = options;
  const log = createLogger({ requestId: 'meta-api' });

  const url = `${META_GRAPH_BASE}/${phoneNumberId}/messages`;

  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientNumber,
    type,
    ...messagePayload,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let backoffMs = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);

    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      const json = await response.json() as Record<string, unknown>;

      if (!response.ok) {
        const err = extractMetaError(json);
        
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            backoffMs = parseInt(retryAfter, 10) * 1000;
          } else {
            backoffMs = Math.max(backoffMs, 2000); // minimum 2s backoff for 429s without header
          }
          lastError = new MetaApiError(err);
          log.warn('Meta API rate limited (429) — will back off and retry', {
            attempt,
            backoffMs,
            metaCode: err.code,
          });
        } else if (response.status < 500) {
          // 4xx errors are deterministic — retrying won't help.
          throw new MetaApiError(err);
        } else {
          // 5xx — fall through to retry
          lastError = new MetaApiError(err);
          log.warn('Meta API 5xx — will retry', {
            attempt,
            status: response.status,
            metaCode: err.code,
          });
        }
      } else {
        return parseSentMessage(json);
      }
    } catch (err) {
      if (err instanceof MetaApiError && err.statusCode < 500 && err.statusCode !== 429) {
        // Deterministic 4xx from Meta — retrying won't help.
        throw err;
      }
      if (err instanceof ApiError) {
        // Our own ApiErrors (504 timeout, 502 unexpected response) — surface immediately.
        throw err;
      }
      // Pure network failure or rate limit — retryable
      lastError = err;
      log.warn('Meta API request failed — will retry', {
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (attempt < MAX_RETRIES) {
      await sleep(backoffMs);
    }
  }

  log.error('Meta API max retries exhausted', {
    phoneNumberId,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  // If the last error was a MetaApiError, re-throw it preserving the code
  if (lastError instanceof MetaApiError) throw lastError;

  throw new ApiError(503, 'Unable to reach the Meta WhatsApp API after multiple attempts. Try again shortly.', 'META_UNAVAILABLE');
}

/**
 * Fetches all approved message templates for a WhatsApp Business Account (WABA).
 *
 * @param options.wabaId      - The WhatsApp Business Account ID (WABA ID)
 * @param options.accessToken - The decrypted channel access token
 * @returns Array of templates from Meta
 */
export async function getTemplates(options: {
  wabaId: string;
  accessToken: string;
}): Promise<any[]> {
  const { wabaId, accessToken } = options;
  const log = createLogger({ requestId: 'meta-api-templates' });

  const url = `${META_GRAPH_BASE}/${wabaId}/message_templates?limit=500`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const backoffMs = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);

    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const json = await response.json() as Record<string, any>;

      if (!response.ok) {
        const err = extractMetaError(json);
        if (response.status < 500 && response.status !== 429) {
          throw new MetaApiError(err);
        }
      } else {
        return (json.data as any[]) || [];
      }
    } catch (err) {
      if (err instanceof MetaApiError && err.statusCode < 500 && err.statusCode !== 429) {
        throw err;
      }
      log.warn('Meta API templates request failed — will retry', {
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (attempt < MAX_RETRIES) {
      await sleep(backoffMs);
    }
  }

  throw new ApiError(503, 'Unable to fetch templates from Meta API.', 'META_UNAVAILABLE');
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Wraps `fetch` with an AbortController timeout so hung connections don't
 * exhaust the Worker's CPU budget.
 */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const isAbortError =
      (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError');

    if (isAbortError) {
      throw new ApiError(504, 'Meta API request timed out', 'META_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Extracts the Meta error detail from a Graph API error envelope. */
function extractMetaError(json: Record<string, unknown>): MetaApiErrorDetail {
  const error = (json.error as Record<string, unknown> | undefined) ?? {};
  return {
    code: typeof error.code === 'number' ? error.code : 0,
    message: typeof error.message === 'string' ? error.message : 'Unknown Meta API error',
    type: typeof error.type === 'string' ? error.type : undefined,
    fbtrace_id: typeof error.fbtrace_id === 'string' ? error.fbtrace_id : undefined,
  };
}

/** Parses the successful messages response envelope. */
function parseSentMessage(json: Record<string, unknown>): SentMessage {
  const messages = (json.messages as { id?: string }[] | undefined) ?? [];
  const contacts = (json.contacts as { wa_id?: string }[] | undefined) ?? [];

  const wamid = messages[0]?.id;
  const recipientWaId = contacts[0]?.wa_id;

  if (!wamid) {
    throw new ApiError(502, 'Meta API returned success but no message ID — possible API change', 'META_UNEXPECTED_RESPONSE');
  }

  return { wamid, recipientWaId: recipientWaId ?? '' };
}

/**
 * Maps known Meta error codes to appropriate HTTP status codes.
 * Only lists codes that require distinct client-facing behaviour.
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
function metaCodeToHttpStatus(code: number): number {
  switch (code) {
    // Authentication / token issues
    case 190:  // Token expired or invalid
    case 102:  // Session key invalid
      return 401;

    // Business rule violations (client must correct)
    case 131026: // Cannot send message — outside 24-hour service window
    case 131047: // Re-engagement message — must use a template
    case 131056: // Pair rate limit exceeded
      return 422;

    // Rate limiting
    case 130429: // Cloud API rate limit
    case 131048: // Spam rate limit
    case 80007:  // App rate limit
    case 4:      // Application request limit
      return 429;

    // Recipient errors (number invalid / unreachable)
    case 131021: // Recipient not valid
    case 131051: // Unsupported message type for this recipient
      return 400;

    // Meta server errors
    case 131000: // Generic error
    case 130472: // User number part of an experiment
      return 502;

    default:
      return code >= 500 ? 502 : 422;
  }
}

/** Maps Meta error codes to user-readable messages (no raw Meta text sent to clients). */
function metaCodeToMessage(code: number, rawMessage: string): string {
  switch (code) {
    case 131026: return 'Cannot send message — the 24-hour customer service window has closed. Send a template message to re-engage.';
    case 131047: return 'This conversation requires a pre-approved message template.';
    case 130429:
    case 131048:
    case 80007:
    case 4:      return 'Rate limit reached. Please wait before sending another message.';
    case 131021: return 'The recipient\'s WhatsApp number is not valid or not registered on WhatsApp.';
    case 190:    return 'The WhatsApp access token has expired. Please reconnect your channel.';
    default:     return `Message could not be delivered: ${rawMessage}`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
