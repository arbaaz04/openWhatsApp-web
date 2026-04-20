/**
 * @file Webhook signature verification using the Meta HMAC-SHA256 scheme.
 *
 * Meta signs every inbound webhook POST with a HMAC-SHA256 digest of the raw
 * request body, delivered in the `X-Hub-Signature-256` header as:
 *   `sha256=<hex-digest>`
 *
 * We verify this using the Web Crypto API (native in Cloudflare Workers — no
 * external dependencies required). A constant-time comparison is used to
 * prevent timing-based side-channel attacks.
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */

/**
 * Verifies the Meta webhook `X-Hub-Signature-256` header against the raw
 * request body using HMAC-SHA256.
 *
 * @param rawBody  - The raw request body as a string (must be read before JSON parsing)
 * @param signature - The full `X-Hub-Signature-256` header value (e.g. `sha256=abc123`)
 * @param secret   - `META_APP_SECRET` from environment bindings
 * @returns `true` if the signature is valid, `false` otherwise
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<{ valid: boolean; expectedHex: string }> {
  if (!signature.startsWith('sha256=')) return { valid: false, expectedHex: '' };

  // Meta often sends hex in lowercase, but we should be case-insensitive just in case.
  const receivedHex = signature.slice('sha256='.length).toLowerCase();

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const bodyData = encoder.encode(rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, bodyData);
  const expectedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time string comparison — prevents timing attacks
  if (expectedHex.length !== receivedHex.length) return { valid: false, expectedHex };

  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ receivedHex.charCodeAt(i);
  }

  return { valid: diff === 0, expectedHex };
}
