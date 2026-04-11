import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendTextMessage, MetaApiError } from '../utils/metaApiClient.js';
import { ApiError } from '../utils/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMetaSuccessResponse(wamid = 'wamid.abc123'): Response {
  return new Response(
    JSON.stringify({
      messaging_product: 'whatsapp',
      contacts: [{ input: '+14155551234', wa_id: '14155551234' }],
      messages: [{ id: wamid }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function makeMetaErrorResponse(code: number, message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: { code, message, fbtrace_id: 'trace123' } }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

const BASE_OPTIONS = {
  phoneNumberId: 'phone123',
  accessToken: 'token_abc',
  recipientNumber: '+14155551234',
  body: 'Hello, how can I help?',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendTextMessage', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeMetaSuccessResponse());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the wamid and wa_id on success', async () => {
    const result = await sendTextMessage(BASE_OPTIONS);
    expect(result.wamid).toBe('wamid.abc123');
    expect(result.recipientWaId).toBe('14155551234');
  });

  it('sends a POST to the correct Meta Graph API endpoint', async () => {
    await sendTextMessage(BASE_OPTIONS);

    const [url, init] = (vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit]);
    expect(url).toContain('/v21.0/phone123/messages');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer token_abc',
      'Content-Type': 'application/json',
    });
  });

  it('includes the correct WhatsApp message payload', async () => {
    await sendTextMessage(BASE_OPTIONS);
    const [, init] = (vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit]);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '+14155551234',
      type: 'text',
      text: { body: 'Hello, how can I help?', preview_url: false },
    });
  });

  it('throws MetaApiError immediately on a 4xx response (no retry)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      makeMetaErrorResponse(131026, 'Business triggered re-engagement outside window', 400)
    );

    await expect(sendTextMessage(BASE_OPTIONS)).rejects.toThrow(MetaApiError);
    // Only one fetch call — 4xx should not be retried
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it('maps error code 131026 (window closed) to HTTP 422', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      makeMetaErrorResponse(131026, 'Window closed', 400)
    );

    try {
      await sendTextMessage(BASE_OPTIONS);
    } catch (err) {
      expect(err).toBeInstanceOf(MetaApiError);
      expect((err as MetaApiError).statusCode).toBe(422);
      expect((err as MetaApiError).message).toContain('24-hour');
    }
  });

  it('maps error code 130429 (rate limit) to HTTP 429', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      makeMetaErrorResponse(130429, 'Rate limit', 429)
    );

    try {
      await sendTextMessage(BASE_OPTIONS);
    } catch (err) {
      expect((err as MetaApiError).statusCode).toBe(429);
    }
  });

  it('retries on 5xx and eventually throws after all retries fail', async () => {
    const server500 = makeMetaErrorResponse(131000, 'Temporary server error', 500);
    vi.mocked(globalThis.fetch).mockResolvedValue(server500);

    vi.useFakeTimers();
    try {
      const promise = sendTextMessage(BASE_OPTIONS);
      // Attach handler BEFORE advancing timers so the rejection is never "unhandled"
      const assertion = expect(promise).rejects.toSatisfy((err: unknown) =>
        err instanceof ApiError || err instanceof MetaApiError
      );
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(3);
  }, 15_000);

  it('throws ApiError 504 when the request times out', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(
      Object.assign(new Error('Aborted'), { name: 'AbortError' })
    );

    await expect(sendTextMessage(BASE_OPTIONS)).rejects.toSatisfy((err: unknown) => {
      return err instanceof ApiError && (err as ApiError).statusCode === 504;
    });
  });

  it('throws ApiError 502 when Meta returns success with no message ID', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ messaging_product: 'whatsapp', contacts: [], messages: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(sendTextMessage(BASE_OPTIONS)).rejects.toSatisfy((err: unknown) => {
      return err instanceof ApiError && (err as ApiError).statusCode === 502;
    });
  });
});
