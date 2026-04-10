import { Hono } from 'hono';
import { logger } from '../utils/logger.js';

const wsRouter = new Hono<{ Bindings: { INBOX_SYNC: DurableObjectNamespace } }>();

/**
 * WebSocket handshake endpoint.
 * Upgrades the connection and hands it over to the InboxSync Durable Object.
 */
wsRouter.get('/inbox', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  // Use a singleton instance of the DO for the current WABA/Channel if we want scoping.
  // For standard Kapso multi-tenant clones, we derive the DO ID from the channel ID.
  // For now, we will use a global 'default' inbox.
  const id = c.env.INBOX_SYNC.idFromName('default-inbox');
  const stub = c.env.INBOX_SYNC.get(id);

  logger.info('Upgrading WebSocket connection to Durable Object');
  return stub.fetch(c.req.raw);
});

export default wsRouter;
