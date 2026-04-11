import { Hono } from 'hono';
import { createLogger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import type { WorkerBindings } from '../types/bindings.js';

type Variables = { requestId: string };

const wsRouter = new Hono<{ Bindings: WorkerBindings; Variables: Variables }>();

/**
 * WebSocket handshake for a specific channel inbox.
 *
 * Query parameters:
 * - `phoneNumberId` (required) — routes the request to the correct InboxSync DO.
 *   Must match the phoneNumberId from Meta webhook metadata.
 * - `lastSeenMessageId` (optional) — the ID of the last message the client
 *   received. If provided, the DO replays all messages after this ID from Postgres
 *   before entering live-broadcast mode (reconnect sync / "Option C").
 *   Omit on the very first connection — the DO will replay the in-memory buffer.
 *
 * @example First-ever connection
 *   ws://api/ws/inbox?phoneNumberId=1234567890
 *
 * @example Reconnect after going offline
 *   ws://api/ws/inbox?phoneNumberId=1234567890&lastSeenMessageId=4201
 */
wsRouter.get('/inbox', async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });

  if (c.req.header('Upgrade') !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  const phoneNumberId = c.req.query('phoneNumberId');
  if (!phoneNumberId) {
    throw new ApiError(
      400,
      'phoneNumberId query parameter is required to connect to the correct inbox',
      'MISSING_PHONE_NUMBER_ID'
    );
  }

  const lastSeenMessageId = c.req.query('lastSeenMessageId') ?? '';
  if (lastSeenMessageId && isNaN(parseInt(lastSeenMessageId, 10))) {
    throw new ApiError(
      400,
      'lastSeenMessageId must be a valid integer',
      'INVALID_CURSOR'
    );
  }

  // Key must match what webhookService uses: INBOX_SYNC.idFromName(phoneNumberId)
  const id = c.env.INBOX_SYNC.idFromName(phoneNumberId);
  const stub = c.env.INBOX_SYNC.get(id);

  log.info('Upgrading WebSocket connection', {
    phoneNumberId,
    hasLastSeenMessageId: !!lastSeenMessageId,
  });

  // Forward requestId and lastSeenMessageId to the DO via query params.
  // The DO reads them from the URL — clean, no custom header needed.
  const url = new URL(c.req.url);
  url.searchParams.set('requestId', c.get('requestId') ?? 'unknown');

  return stub.fetch(new Request(url.toString(), c.req.raw));
});

export default wsRouter;
