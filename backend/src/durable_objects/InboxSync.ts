/**
 * InboxSync — Cloudflare Durable Object
 *
 * Manages real-time WebSocket connections for a single WhatsApp channel inbox.
 * One DO instance per channel, keyed by phoneNumberId.
 *
 * Uses the Cloudflare WebSocket Hibernation API exclusively:
 * - `ctx.acceptWebSocket(server)` replaces the legacy `server.accept()`.
 * - `ctx.getWebSockets()` replaces any local in-memory session tracking.
 * - The DO can hibernate between events with zero connection loss.
 *
 * Compatibility requirement: Workers compatibility_date >= 2023-12-01
 * (Hibernation API is stable since then).
 */
export class InboxSync {
  private readonly ctx: DurableObjectState;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal RPC from webhookService — push a received message to all UIs
    if (request.method === 'POST' && url.pathname.endsWith('/broadcast')) {
      const payload = await request.text();
      await this.broadcast(payload);
      return new Response('OK', { status: 200 });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // Hibernation API — the CF runtime owns and tracks this WebSocket.
    // Sessions survive isolate eviction and are re-hydrated by ctx.getWebSockets().
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Hibernation event handler — called when a connected client sends a message.
   * Reserved for future client-to-server events (typing indicators, read receipts).
   */
  webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {
    // intentionally empty — client-to-server events not yet implemented
  }

  /**
   * Hibernation event handler — called when a client disconnects cleanly.
   * The CF runtime already removes the socket from getWebSockets(); this is a hook
   * for any cleanup work we may need later (metrics, presence updates, etc.).
   */
  webSocketClose(_ws: WebSocket): void {
    // intentionally empty — runtime handles cleanup
  }

  /**
   * Broadcasts a JSON payload to all sessions attached to this DO instance.
   * Stale sockets that throw on send are silently skipped — the runtime will
   * remove them from getWebSockets() on the next call automatically.
   */
  async broadcast(payload: string): Promise<void> {
    const activeSessions = this.ctx.getWebSockets();

    for (const ws of activeSessions) {
      try {
        ws.send(payload);
      } catch {
        // Send failed — socket is stale. CF runtime evicts it; we do nothing.
      }
    }
  }
}
