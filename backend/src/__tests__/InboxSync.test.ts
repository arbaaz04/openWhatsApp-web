import { describe, it, expect, vi } from 'vitest';
import { InboxSync } from '../durable_objects/InboxSync.js';

// Polyfill WebSocketPair for Node — CF runtime provides this natively
(global as Record<string, unknown>).WebSocketPair = class {
  [key: number]: { accept: () => void; addEventListener: () => void; send: () => void };
  constructor() {
    this[0] = { accept: vi.fn(), addEventListener: vi.fn(), send: vi.fn() };
    this[1] = { accept: vi.fn(), addEventListener: vi.fn(), send: vi.fn() };
  }
};

/** Build a minimal DurableObjectState stub with Hibernation API support */
function makeState(sockets: WebSocket[] = []) {
  return {
    acceptWebSocket: vi.fn(),
    getWebSockets: vi.fn().mockReturnValue(sockets),
  } as unknown as DurableObjectState;
}

describe('InboxSync Durable Object', () => {
  it('initialises with an empty local sessions set', () => {
    const doObj = new InboxSync(makeState());
    expect(doObj.sessions.size).toBe(0);
  });

  it('returns 426 for plain HTTP requests (not websocket upgrades)', async () => {
    const doObj = new InboxSync(makeState());
    const res = await doObj.fetch(new Request('http://localhost/'));
    expect(res.status).toBe(426);
  });

  it('calls ctx.acceptWebSocket for valid upgrade requests', async () => {
    const state = makeState();
    const doObj = new InboxSync(state);
    const req = new Request('http://localhost/ws', { headers: { Upgrade: 'websocket' } });

    // Node throws on 101 responses — the important thing is acceptWebSocket was called
    try {
      await doObj.fetch(req);
    } catch {
      // expected in Node test env
    }

    expect(state.acceptWebSocket).toHaveBeenCalledOnce();
  });

  it('broadcasts a POST payload to all runtime-hydrated sessions', async () => {
    const session1 = { send: vi.fn() };
    const session2 = { send: vi.fn() };
    const state = makeState([session1, session2] as unknown as WebSocket[]);
    const doObj = new InboxSync(state);

    const req = new Request('http://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message: 'new message' }),
    });

    const res = await doObj.fetch(req);

    expect(res.status).toBe(200);
    expect(session1.send).toHaveBeenCalledOnce();
    expect(session2.send).toHaveBeenCalledOnce();
  });

  it('evicts a session from the local Set when send throws', async () => {
    const goodSession = { send: vi.fn() };
    const badSession = {
      send: vi.fn().mockImplementation(() => { throw new Error('Connection reset'); }),
    };

    const state = makeState([goodSession, badSession] as unknown as WebSocket[]);
    const doObj = new InboxSync(state);
    // Inject bad session into local set to test eviction path
    doObj.sessions.add(badSession as unknown as WebSocket);

    await doObj.fetch(new Request('http://internal/broadcast', { method: 'POST', body: '{}' }));

    // badSession evicted from local set; goodSession unaffected
    expect(doObj.sessions.has(badSession as unknown as WebSocket)).toBe(false);
  });

  it('no-ops on webSocketMessage (reserved for future events)', () => {
    const doObj = new InboxSync(makeState());
    expect(() => doObj.webSocketMessage({} as WebSocket, 'ping')).not.toThrow();
  });

  it('removes a socket from the local set on webSocketClose', () => {
    const doObj = new InboxSync(makeState());
    const ws = {} as WebSocket;
    doObj.sessions.add(ws);
    doObj.webSocketClose(ws);
    expect(doObj.sessions.has(ws)).toBe(false);
  });
});
