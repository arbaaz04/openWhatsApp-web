/**
 * @file AES-256-GCM column-level encryption for sensitive database values.
 *
 * Used to encrypt WhatsApp access tokens before writing to the database so
 * that a database dump or a compromised DB connection cannot expose live tokens.
 *
 * Algorithm: AES-256-GCM
 * - Authenticated encryption — detects tampering (GCM authentication tag)
 * - Random 96-bit IV per encryption — identical plaintexts produce different ciphertexts
 * - Self-contained output format: `base64url(iv):base64url(ciphertext+tag)`
 *
 * Uses Web Crypto API — native in Cloudflare Workers, no external dependencies.
 * The `DATA_ENCRYPTION_KEY` binding must be a 32-byte (256-bit) key encoded as
 * a 64-character hex string.
 */

const IV_LENGTH = 12; // 96 bits — GCM recommended IV length

/**
 * Derives a CryptoKey from a hex-encoded 32-byte raw key string.
 *
 * @param hexKey - 64-character hex string (32 bytes)
 * @returns A non-extractable AES-256-GCM CryptoKey
 */
async function importKey(hexKey: string): Promise<CryptoKey> {
  if (hexKey.length !== 64) {
    throw new Error('DATA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }

  const keyBytes = new Uint8Array(
    hexKey.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 *
 * @param plaintext - The value to encrypt (e.g. a WhatsApp access token)
 * @param hexKey    - 64-char hex key from the `DATA_ENCRYPTION_KEY` binding
 * @returns Encrypted string in `base64url(iv):base64url(ciphertext)` format
 */
export async function encrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));

  return `${ivB64}:${cipherB64}`;
}

/**
 * Decrypts a value produced by {@link encrypt}.
 *
 * @param ciphertext - Encrypted string in `base64url(iv):base64url(ciphertext)` format
 * @param hexKey     - 64-char hex key from the `DATA_ENCRYPTION_KEY` binding
 * @returns The original plaintext string
 * @throws {Error} if the ciphertext is malformed or the key is wrong (GCM auth failure)
 */
export async function decrypt(ciphertext: string, hexKey: string): Promise<string> {
  const parts = ciphertext.split(':');
  if (parts.length !== 2) {
    throw new Error('Malformed ciphertext — expected format: base64(iv):base64(ciphertext)');
  }

  const [ivB64, cipherB64] = parts;

  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const cipher = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));

  const key = await importKey(hexKey);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher
  );

  return new TextDecoder().decode(plaintextBuffer);
}
