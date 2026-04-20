import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from '../utils/verifyWebhookSignature.js';
import { encrypt, decrypt } from '../utils/encryption.js';

// ---------------------------------------------------------------------------
// Web Crypto is available in Node 20+ via globalThis.crypto
// ---------------------------------------------------------------------------

describe('verifyWebhookSignature', () => {
  /** Generates a real HMAC-SHA256 hex signature for a given body + secret */
  async function sign(body: string, secret: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const buf = await crypto.subtle.sign('HMAC', key, enc.encode(body));
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `sha256=${hex}`;
  }

  it('returns true for a valid HMAC signature', async () => {
    const body = JSON.stringify({ test: true });
    const secret = 'my-app-secret';
    const sig = await sign(body, secret);
    const result = await verifyWebhookSignature(body, sig, secret);
    expect(result.valid).toBe(true);
  });

  it('returns false when signature header is missing sha256= prefix', async () => {
    const result = await verifyWebhookSignature('body', 'invalidsig', 'secret');
    expect(result.valid).toBe(false);
  });

  it('returns false when signature does not match the body', async () => {
    const sig = await sign('original body', 'secret');
    const result = await verifyWebhookSignature('tampered body', sig, 'secret');
    expect(result.valid).toBe(false);
  });

  it('returns false when signed with a different secret', async () => {
    const sig = await sign('body', 'correct-secret');
    const result = await verifyWebhookSignature('body', sig, 'wrong-secret');
    expect(result.valid).toBe(false);
  });

  it('returns false for an empty signature string', async () => {
    const result = await verifyWebhookSignature('body', '', 'secret');
    expect(result.valid).toBe(false);
  });
});

describe('encryption (AES-256-GCM)', () => {
  // 64-char hex = 32 bytes = valid AES-256 key
  const key = 'a'.repeat(64);

  it('encrypts and decrypts a value back to the original plaintext', async () => {
    const original = 'EAABsbCS1iHgBAKq...longMetaToken';
    const ciphertext = await encrypt(original, key);
    const decrypted = await decrypt(ciphertext, key);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const val = 'same-token';
    const c1 = await encrypt(val, key);
    const c2 = await encrypt(val, key);
    expect(c1).not.toBe(c2);
  });

  it('ciphertext contains the iv:ciphertext delimiter', async () => {
    const result = await encrypt('value', key);
    expect(result.split(':').length).toBe(2);
  });

  it('throws when given a key that is not 64 hex chars', async () => {
    await expect(encrypt('val', 'tooshort')).rejects.toThrow(
      'DATA_ENCRYPTION_KEY must be a 64-character hex string'
    );
  });

  it('throws when given malformed ciphertext to decrypt', async () => {
    await expect(decrypt('notvalidformat', key)).rejects.toThrow(
      'Malformed ciphertext'
    );
  });

  it('throws if the key is wrong during decryption (GCM auth tag mismatch)', async () => {
    const ciphertext = await encrypt('secret', key);
    const wrongKey = 'b'.repeat(64);
    await expect(decrypt(ciphertext, wrongKey)).rejects.toThrow();
  });
});
