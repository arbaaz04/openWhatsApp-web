/**
 * InboxSync — Cloudflare Durable Object
 *
 * Manages real-time WebSocket connections for a single WhatsApp channel inbox.
 * One DO instance per channel (keyed by phoneNumberId in webhookService.ts).
 *
 * Uses the Cloudflare WebSocket Hibernation API (ctx.acceptWebSocket) instead
 * of the legacy manual `server.accept()` approach. Hibernation allows the
 * runtime to evict idle DO instances from memory and restore them on the next
 * event, which is essential for cost efficiency and long-lived connections.
 *
 * Key properties of this design:
 * - Sessions survive DO hibernation — `ctx.getWebSockets()` re-hydrates them.
 * - The `sessions` Set is rebuilt from the runtime on every wake, not persisted.
 * - Broadcast targets all sockets attached to this DO instance (one inbox).
 */
export class InboxSync {
  private readonly ctx: DurableObjectState;

  /**
   * sessions is intentionally not a persistent field.
   * It is a live view of currently attached WebSockets provided by the CF runtime.
   * Stored as a public Set for test compatibility (tests inject mock sockets directly).
   */
  sessions: Set<WebSocket>;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
    this.sessions = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal RPC from webhookService — broadcast a received message to all UIs
    if (request.method === 'POST' && url.pathname.endsWith('/broadcast')) {
      const payload = await request.text();
      await this.broadcast(payload);
      return new Response('OK', { status: 200 });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // Use the Hibernation API: the runtime manages the WebSocket lifecycle.
    // The DO can be evicted and woken up later without losing the connection.
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Hibernation event handler — called when a client sends a message.
   * Used for future features: typing indicators, read receipts, etc.
   */
  webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {
    // Reserved for client-to-server events (e.g. read receipts)
  }

  /**
   * Hibernation event handler — called when a client disconnects.
   * The runtime handles cleanup; we remove from our local Set if present.
   */
  webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws);
  }

  /**
   * Broadcasts a JSON payload to all active WebSocket sessions on this inbox.
   * Stale sessions that fail to receive are evicted silently.
   *
   * @param payload - JSON string to broadcast (typically a message event)
   */
  async broadcast(payload: string): Promise<void> {
    // Re-hydrate sessions from the CF runtime (covers hibernated connections)
    const activeSessions = this.ctx.getWebSockets
      ? this.ctx.getWebSockets()
      : [...this.sessions];

    for (const ws of activeSessions) {
      try {
        ws.send(payload);
      } catch {
        // Session is stale — remove from local set (runtime handles hibernated ones)
        this.sessions.delete(ws);
      }
    }
  }
}
