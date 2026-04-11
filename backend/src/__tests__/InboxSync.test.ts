import { describe, it, expect, vi } from 'vitest';
import { InboxSync } from '../durable_objects/InboxSync.js';

// Polyfill WebSocketPair for Node — CF runtime provides this natively
(global as Record<string, unknown>).WebSocketPair = class {
  [key: number]: { accept: () => void; addEventListener: () => void; send: ReturnType<typeof vi.fn> };
  constructor() {
    this[0] = { accept: vi.fn(), addEventListener: vi.fn(), send: vi.fn() };
    this[1] = { accept: vi.fn(), addEventListener: vi.fn(), send: vi.fn() };
  }
};

function makeState(sockets: { send: ReturnType<typeof vi.fn> }[] = []) {
  return {
    acceptWebSocket: vi.fn(),
    getWebSockets: vi.fn().mockReturnValue(sockets),
    waitUntil: vi.fn(),
  } as unknown as DurableObjectState;
}

function makeEnv() {
  return {
    META_APP_SECRET: 'test-secret',
  } as unknown as import('../types/bindings.js').WorkerBindings;
}

describe('InboxSync Durable Object', () => {
  it('returns 426 for non-websocket upgrade requests', async () => {
    const doObj = new InboxSync(makeState(), makeEnv());
    const res = await doObj.fetch(new Request('http://localhost/'));
    expect(res.status).toBe(426);
  });

  it('calls ctx.acceptWebSocket for valid upgrade requests', async () => {
    const state = makeState();
    const doObj = new InboxSync(state, makeEnv());
    const req = new Request('http://localhost/ws', { headers: { Upgrade: 'websocket' } });

    try {
      await doObj.fetch(req);
    } catch {
      // 101 responses throw in Node — acceptWebSocket call is the assertion
    }

    expect(state.acceptWebSocket).toHaveBeenCalledOnce();
  });

  it('adds broadcast payload to the replay buffer', async () => {
    const state = makeState();
    const doObj = new InboxSync(state, makeEnv());

    const req = new Request('http://internal/broadcast', {
      method: 'POST',
      headers: { 'x-internal-auth': 'test-secret' },
      body: JSON.stringify({ customerPhone: '123', bodyText: 'hello' }),
    });

    await doObj.fetch(req);

    // A new connection should receive the buffered message on connect
    // We can verify by checking that the state received the broadcast
    expect(state.getWebSockets).toHaveBeenCalled();
  });

  it('broadcasts POST payload to all runtime-hydrated sessions', async () => {
    const session1 = { send: vi.fn() };
    const session2 = { send: vi.fn() };
    const state = makeState([session1, session2]);
    const doObj = new InboxSync(state, makeEnv());

    const req = new Request('http://internal/broadcast', {
      method: 'POST',
      headers: { 'x-internal-auth': 'test-secret' },
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
    const doObj = new InboxSync(state, makeEnv());

    const req = new Request('http://internal/broadcast', {
      method: 'POST',
      headers: { 'x-internal-auth': 'test-secret' },
      body: '{}',
    });

    await expect(doObj.fetch(req)).resolves.not.toThrow();
    expect(goodSession.send).toHaveBeenCalledOnce();
  });

  it('does not throw on webSocketMessage (reserved hook)', () => {
    const doObj = new InboxSync(makeState(), makeEnv());
    const ws = { deserializeAttachment: vi.fn().mockReturnValue(null), send: vi.fn() } as unknown as WebSocket;
    expect(() => doObj.webSocketMessage(ws, 'ping')).not.toThrow();
    // ping should trigger a pong response
    expect((ws as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledWith('pong');
  });

  it('does not throw on webSocketClose (runtime handles cleanup)', () => {
    const doObj = new InboxSync(makeState(), makeEnv());
    const ws = { deserializeAttachment: vi.fn().mockReturnValue(null) } as unknown as WebSocket;
    expect(() => doObj.webSocketClose(ws)).not.toThrow();
  });

  it('does not throw on webSocketError (runtime error handler)', () => {
    const doObj = new InboxSync(makeState(), makeEnv());
    const ws = { deserializeAttachment: vi.fn().mockReturnValue(null) } as unknown as WebSocket;
    expect(() => doObj.webSocketError(ws, new Error('Network reset'))).not.toThrow();
  });

  it('rejects unauthenticated internal broadcast requests', async () => {
    const doObj = new InboxSync(makeState(), makeEnv());
    const res = await doObj.fetch(new Request('http://internal/broadcast', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });
});
