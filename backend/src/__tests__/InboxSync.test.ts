import { describe, it, expect, vi } from 'vitest';
import { InboxSync } from '../durable_objects/InboxSync.js';

// Polyfill WebSocketPair for Node.js — Cloudflare Workers provides this natively
(global as Record<string, unknown>).WebSocketPair = class {
  [key: number]: { accept: () => void; addEventListener: () => void; send: () => void };
  constructor() {
    this[0] = { accept: vi.fn(), addEventListener: vi.fn(), send: vi.fn() };
    this[1] = { accept: vi.fn(), addEventListener: vi.fn(), send: vi.fn() };
  }
};

describe('InboxSync Durable Object', () => {
  it('should initialise with an empty sessions set', () => {
    const doObj = new InboxSync({} as DurableObjectState);
    expect(doObj.sessions.size).toBe(0);
  });

  it('should broadcast a POST payload to all registered sessions', async () => {
    const doObj = new InboxSync({} as DurableObjectState);

    const session1 = { send: vi.fn() };
    const session2 = { send: vi.fn() };
    doObj.sessions.add(session1 as unknown as WebSocket);
    doObj.sessions.add(session2 as unknown as WebSocket);

    const req = new Request('http://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message: 'ping' }),
    });

    const res = await doObj.fetch(req);

    expect(res.status).toBe(200);
    expect(session1.send).toHaveBeenCalledOnce();
    expect(session2.send).toHaveBeenCalledOnce();
  });

  it('should evict a session that throws on send', async () => {
    const doObj = new InboxSync({} as DurableObjectState);

    const goodSession = { send: vi.fn() };
    const badSession = { send: vi.fn().mockImplementation(() => { throw new Error('Connection closed'); }) };
    doObj.sessions.add(goodSession as unknown as WebSocket);
    doObj.sessions.add(badSession as unknown as WebSocket);

    const req = new Request('http://internal/broadcast', {
      method: 'POST',
      body: '{}',
    });

    await doObj.fetch(req);

    expect(doObj.sessions.size).toBe(1);
    expect(doObj.sessions.has(goodSession as unknown as WebSocket)).toBe(true);
    expect(doObj.sessions.has(badSession as unknown as WebSocket)).toBe(false);
  });

  it('should return 426 Upgrade Required for non-WebSocket non-broadcast requests', async () => {
    const doObj = new InboxSync({} as DurableObjectState);
    const req = new Request('http://localhost/whatever');
    const res = await doObj.fetch(req);
    expect(res.status).toBe(426);
  });

  it('should attempt WebSocket upgrade (throws in Node — correct CF behaviour)', async () => {
    const doObj = new InboxSync({} as DurableObjectState);
    const req = new Request('http://localhost/ws', { headers: { Upgrade: 'websocket' } });
    // Node.js Response rejects status 101 — this is expected in test env.
    // In Cloudflare Workers runtime this works natively.
    await expect(doObj.fetch(req)).rejects.toThrow();
  });
});
