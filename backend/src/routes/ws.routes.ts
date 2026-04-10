import { Hono } from 'hono';
import { createLogger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import type { WorkerBindings } from '../types/bindings.js';

type Variables = { requestId: string };

const wsRouter = new Hono<{ Bindings: WorkerBindings; Variables: Variables }>();

/**
 * WebSocket handshake for a specific channel inbox.
 *
 * Requires `?phoneNumberId=<id>` — this is the key used to look up the
 * InboxSync Durable Object instance. It must match the phoneNumberId from
 * the Meta webhook metadata, which is the same key webhookService uses when
 * broadcasting incoming messages. Without this, clients would connect to a
 * different DO instance and never receive anything.
 *
 * @example ws://api/ws/inbox?phoneNumberId=1234567890
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

  // Key must match what webhookService uses: INBOX_SYNC.idFromName(phoneNumberId)
  // Using any other key (e.g. 'default-inbox') would silently connect the client
  // to a DO instance that receives no broadcasts.
  const id = c.env.INBOX_SYNC.idFromName(phoneNumberId);
  const stub = c.env.INBOX_SYNC.get(id);

  log.info('Upgrading WebSocket connection', { phoneNumberId });

  return stub.fetch(c.req.raw);
});

export default wsRouter;
