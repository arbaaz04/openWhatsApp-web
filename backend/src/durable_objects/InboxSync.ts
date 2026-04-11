/**
 * InboxSync — Cloudflare Durable Object
 *
 * One instance per WhatsApp channel, keyed by phoneNumberId.
 * Manages real-time WebSocket connections using the Hibernation API
 * so the DO can be evicted between events without dropping connections.
 *
 * ## Connection protocol
 *
 * When a client connects, it should include a `lastSeenMessageId` query param:
 *   `wss://api/ws/inbox?phoneNumberId=<id>&lastSeenMessageId=<id>`
 *
 * If provided, the DO fetches all messages since that ID from Postgres and
 * replays them before the WebSocket enters live-broadcast mode. This gives
 * the client a seamless experience whether they were offline for 1 second or
 * 1 hour — they always receive the full gap.
 *
 * If `lastSeenMessageId` is absent (first-ever connection), the client
 * receives the in-memory buffer of recent messages instead (fast path, no DB).
 *
 * ## Hibernation API
 *
 * `ctx.acceptWebSocket()` puts the socket into hibernation mode: the DO
 * process can be fully evicted by the CF runtime between events, and
 * `ctx.getWebSockets()` re-hydrates active sessions when a broadcast arrives.
 * This means we never pay for idle CPU time.
 *
 * Compatibility requirement: Workers compatibility_date >= 2023-12-01
 */

import { createLogger } from '../utils/logger.js';
import { db } from '../db/index.js';
import { channels, conversations } from '../db/schema.js';
import { messageRepository } from '../repositories/messageRepository.js';
import { eq, desc } from 'drizzle-orm';
import type { WorkerBindings } from '../types/bindings.js';

/** How many messages to keep in the hot in-memory buffer. */
const MESSAGE_BUFFER_SIZE = 50;

/**
 * Attachment stored on each WebSocket via `ws.serializeAttachment()`.
 * Survives DO hibernation — the runtime serialises and restores it.
 */
interface WsAttachment {
  /** phoneNumberId this socket is subscribed to, for log context. */
  phoneNumberId: string;
  /** The most recent message ID the client had at connection time. */
  lastSeenMessageId: number | null;
  /** Cloudflare-assigned request ID for correlation across log entries. */
  requestId: string;
}

export class InboxSync {
  private readonly ctx: DurableObjectState;
  private readonly env: WorkerBindings;

  /**
   * Ring buffer of recent message payloads.
   * Capped at MESSAGE_BUFFER_SIZE. Resets on DO eviction — Postgres is the
   * source of truth for the full history.
   */
  private readonly recentMessages: string[] = [];

  constructor(ctx: DurableObjectState, env: WorkerBindings) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const log = createLogger({ requestId: url.searchParams.get('requestId') ?? 'do' });

    // -----------------------------------------------------------------------
    // Internal RPC — webhookService broadcasts new messages here.
    // -----------------------------------------------------------------------
    if (request.method === 'POST' && url.pathname.endsWith('/broadcast')) {
      if (request.headers.get('x-internal-auth') !== this.env.META_APP_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }

      const payload = await request.text();
      this.bufferMessage(payload);
      await this.broadcast(payload);
      return new Response('OK', { status: 200 });
    }

    // -----------------------------------------------------------------------
    // WebSocket upgrade
    // -----------------------------------------------------------------------
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const phoneNumberId = url.searchParams.get('phoneNumberId') ?? 'unknown';
    const requestId = url.searchParams.get('requestId') ?? 'do';
    const lastSeenRaw = url.searchParams.get('lastSeenMessageId');
    const lastSeenMessageId = lastSeenRaw ? parseInt(lastSeenRaw, 10) : null;

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    // Persist attachment on the socket so hibernated handlers can access it
    server.serializeAttachment({
      phoneNumberId,
      requestId,
      lastSeenMessageId,
    } satisfies WsAttachment);

    // -----------------------------------------------------------------------
    // Replay gap from Postgres (Option C — full sync on reconnect)
    // -----------------------------------------------------------------------
    if (lastSeenMessageId !== null && !isNaN(lastSeenMessageId)) {
      // Kick off DB replay without blocking the WebSocket upgrade response.
      // ctx.waitUntil keeps the DO alive until the replay finishes.
      this.ctx.waitUntil(
        this.replayFromDb(server, phoneNumberId, lastSeenMessageId, requestId)
          .catch((err: unknown) => {
            log.error('DB replay failed — client will resync on next reconnect', {
              phoneNumberId,
              lastSeenMessageId,
              error: err instanceof Error ? err.message : String(err),
            });
          })
      );
    } else {
      // First-ever connection or no cursor provided: replay the in-memory buffer.
      // This is the fast path — no DB round-trip needed.
      for (const msg of this.recentMessages) {
        try {
          server.send(msg);
        } catch {
          break; // socket not yet ready in test environments
        }
      }
    }

    log.info('WebSocket client connected', { phoneNumberId, lastSeenMessageId });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Hibernation handler — called when a client sends a message upstream.
   * Reserved for future features: read receipts, typing indicators, ping/pong.
   */
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    const log = createLogger({ requestId: attachment?.requestId ?? 'do' });

    // Respond to client-sent pings to keep idle connections alive through
    // proxies/load-balancers that close idle WebSocket connections.
    if (message === 'ping') {
      try {
        ws.send('pong');
      } catch {
        // Socket already closing — ignore
      }
      return;
    }

    log.info('Received upstream WS message', {
      phoneNumberId: attachment?.phoneNumberId,
      size: typeof message === 'string' ? message.length : message.byteLength,
    });
  }

  /**
   * Hibernation handler — called on clean client disconnect.
   * CF runtime evicts the socket from getWebSockets() automatically.
   */
  webSocketClose(ws: WebSocket): void {
    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    const log = createLogger({ requestId: attachment?.requestId ?? 'do' });
    log.info('WebSocket client disconnected', { phoneNumberId: attachment?.phoneNumberId });
  }

  /**
   * Hibernation handler — called on abnormal close (network error, etc.).
   */
  webSocketError(ws: WebSocket, error: unknown): void {
    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    const log = createLogger({ requestId: attachment?.requestId ?? 'do' });
    log.error('WebSocket error', {
      phoneNumberId: attachment?.phoneNumberId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Fetches all messages after `lastSeenMessageId` from Postgres and sends
   * them to the reconnected client. Sends a `sync_complete` sentinel so the
   * frontend knows the replay is done and live mode has begun.
   */
  private async replayFromDb(
    ws: WebSocket,
    phoneNumberId: string,
    lastSeenMessageId: number,
    requestId: string
  ): Promise<void> {
    const log = createLogger({ requestId });

    // We need the conversationId to query messages. The conversationId isn't
    // stored on the socket — we derive it from the attachment if set, or skip.
    // For now we use the phoneNumberId to look up the channel, then the most
    // recent conversation. Future: pass conversationId as a query param.
    //
    // This is intentionally simple for the initial implementation — it replays
    // the most recently active conversation. Multi-conversation replay is a
    // follow-up feature.
    const [channel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.whatsappId, phoneNumberId))
      .limit(1);

    if (!channel) {
      log.error('Channel not found during WS replay', { phoneNumberId });
      return;
    }

    // Find the most recently active conversation for this channel
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.channelId, channel.id))
      .orderBy(desc(conversations.lastCustomerMessageAt), desc(conversations.id))
      .limit(1);

    if (!conversation) return;

    const missed = await messageRepository.getMessagesSince(conversation.id, lastSeenMessageId);

    log.info('Replaying missed messages to reconnected client', {
      phoneNumberId,
      lastSeenMessageId,
      count: missed.length,
    });

    for (const msg of missed) {
      try {
        ws.send(JSON.stringify({ type: 'replay', message: msg }));
      } catch {
        return; // Socket closed mid-replay — stop
      }
    }

    // Signal the frontend that replay is complete and live mode starts now
    try {
      ws.send(JSON.stringify({ type: 'sync_complete', replayedCount: missed.length }));
    } catch {
      // Socket closed — ignore
    }
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
   * Stale sockets that throw on send are silently skipped — the CF runtime
   * evicts them from getWebSockets() automatically.
   */
  async broadcast(payload: string): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Stale socket — CF runtime will evict it automatically
      }
    }
  }
}
