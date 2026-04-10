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

/** Build a DurableObjectState stub with Hibernation API support */
function makeState(sockets: { send: ReturnType<typeof vi.fn> }[] = []) {
  return {
    acceptWebSocket: vi.fn(),
    getWebSockets: vi.fn().mockReturnValue(sockets),
  } as unknown as DurableObjectState;
}

describe('InboxSync Durable Object', () => {
  it('returns 426 for non-websocket upgrade requests', async () => {
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

  it('broadcasts POST payload to all runtime-hydrated sessions', async () => {
    const session1 = { send: vi.fn() };
    const session2 = { send: vi.fn() };
    const state = makeState([session1, session2]);
    const doObj = new InboxSync(state);

    const req = new Request('http://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({ customerPhone: '123', bodyText: 'hi' }),
    });

    const res = await doObj.fetch(req);

    expect(res.status).toBe(200);
    expect(session1.send).toHaveBeenCalledOnce();
    expect(session2.send).toHaveBeenCalledOnce();
  });

  it('silently skips stale sessions that throw on send', async () => {
    const goodSession = { send: vi.fn() };
    const badSession = {
      send: vi.fn().mockImplementation(() => { throw new Error('Connection reset'); }),
    };

    const state = makeState([goodSession, badSession]);
    const doObj = new InboxSync(state);

    const req = new Request('http://internal/broadcast', { method: 'POST', body: '{}' });

    // Should not throw — stale socket errors are swallowed
    await expect(doObj.fetch(req)).resolves.not.toThrow();
    expect(goodSession.send).toHaveBeenCalledOnce();
  });

  it('does not throw on webSocketMessage (reserved for future events)', () => {
    const doObj = new InboxSync(makeState());
    expect(() => doObj.webSocketMessage({} as WebSocket, 'ping')).not.toThrow();
  });

  it('does not throw on webSocketClose (runtime handles cleanup)', () => {
    const doObj = new InboxSync(makeState());
    expect(() => doObj.webSocketClose({} as WebSocket)).not.toThrow();
  });
});
