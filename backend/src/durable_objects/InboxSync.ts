/**
 * InboxSync — Cloudflare Durable Object
 *
 * One instance per WhatsApp channel, keyed by phoneNumberId.
 * Manages real-time WebSocket connections using the Hibernation API
 * so the DO can be evicted between events without dropping connections.
 *
 * Message replay:
 *   New connections receive the last MESSAGE_BUFFER_SIZE messages so the
 *   UI doesn't appear blank on initial connect or after a brief disconnect.
 *   The buffer lives in memory — it resets if the DO is fully evicted, which
 *   is acceptable since the full message history is in Postgres.
 *
 * Compatibility requirement: Workers compatibility_date >= 2023-12-01
 */

const MESSAGE_BUFFER_SIZE = 50;

export class InboxSync {
  private readonly ctx: DurableObjectState;

  /**
   * Ring buffer of recent message payloads.
   * Capped at MESSAGE_BUFFER_SIZE. Resets on DO eviction — Postgres is the
   * source of truth for full history.
   */
  private readonly recentMessages: string[] = [];

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal RPC from webhookService
    if (request.method === 'POST' && url.pathname.endsWith('/broadcast')) {
      const payload = await request.text();
      this.bufferMessage(payload);
      await this.broadcast(payload);
      return new Response('OK', { status: 200 });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    // Replay recent messages to the newly connected client so the UI has
    // immediate context rather than waiting for the next incoming webhook.
    for (const msg of this.recentMessages) {
      try {
        // server is not yet accepted by CF runtime outside Workers — in Node
        // tests this will throw, which is expected and caught by tests.
        server.send(msg);
      } catch {
        break;
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Hibernation handler — called when a client sends a message upstream.
   * Reserved for future features: read receipts, typing indicators.
   */
  webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {
    // intentionally empty
  }

  /**
   * Hibernation handler — called on clean client disconnect.
   * CF runtime evicts the socket from getWebSockets(); no manual cleanup needed.
   */
  webSocketClose(_ws: WebSocket): void {
    // intentionally empty
  }

  /**
   * Pushes a payload into the ring buffer, evicting the oldest entry when full.
   */
  private bufferMessage(payload: string): void {
    this.recentMessages.push(payload);
    if (this.recentMessages.length > MESSAGE_BUFFER_SIZE) {
      this.recentMessages.shift();
    }
  }

  /**
   * Broadcasts a payload to all active WebSocket sessions on this inbox.
   * Stale sockets that throw on send are silently skipped.
   */
  async broadcast(payload: string): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Stale socket — CF runtime will evict it from getWebSockets() automatically
      }
    }
  }
}
