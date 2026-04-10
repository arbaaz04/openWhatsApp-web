export class InboxSync {
  state: DurableObjectState;
  sessions: Set<WebSocket>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Set();
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname.endsWith('/broadcast')) {
      const payload = await request.text();
      await this.broadcast(payload);
      return new Response('OK', { status: 200 });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());

    this.sessions.add(server);
    server.accept();

    server.addEventListener('message', () => {
      // In a broader implementation, handle client events (typing indicators, read receipts, etc.)
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Called by the webhook worker to push a newly received message to the React UI
   */
  async broadcast(messagePayload: string) {
    for (const session of this.sessions) {
      try {
        session.send(messagePayload);
      } catch {
        this.sessions.delete(session);
      }
    }
  }
}
