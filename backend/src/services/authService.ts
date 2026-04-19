import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { db } from '../db/index.js';
import { channels } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Meta Graph API response shape for token exchange
// ---------------------------------------------------------------------------
interface MetaTokenResponse {
  access_token: string;
  token_type: string;
}

/**
 * Calls the Meta Graph API to exchange a short-lived embedded signup code
 * for a long-lived System User Access Token.
 *
 * @param clientId     - Your Meta App ID
 * @param clientSecret - Your Meta App Secret
 * @param code         - The temporary code from the embedded signup flow
 * @returns The long-lived access token string
 * @throws {ApiError} 502 if Meta returns a non-200 or a malformed response
 */
async function fetchMetaAccessToken(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<string> {
  const url = new URL('https://graph.facebook.com/v25.0/oauth/access_token');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('code', code);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('Meta token exchange failed', {
      status: response.status,
      body: errorBody,
    });
    throw new ApiError(
      502,
      'Failed to exchange token with Meta — upstream error',
      'META_TOKEN_EXCHANGE_FAILED'
    );
  }

  const data = (await response.json()) as MetaTokenResponse;

  if (!data.access_token) {
    throw new ApiError(
      502,
      'Meta returned a response without an access_token',
      'META_MISSING_ACCESS_TOKEN'
    );
  }

  return data.access_token;
}

/**
 * Fetches the first available WhatsApp Business Account ID for the user.
 */
async function fetchWabaId(accessToken: string): Promise<string> {
  const url = `https://graph.facebook.com/v25.0/me/whatsapp_business_accounts?access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(502, 'Failed to fetch WABA accounts from Meta', 'META_WABA_FETCH_FAILED');
  
  const data = await res.json() as { data: Array<{ id: string }> };
  if (!data.data || data.data.length === 0) {
    throw new ApiError(404, 'No WhatsApp Business Accounts found for this user', 'META_NO_WABA_FOUND');
  }
  return data.data[0].id;
}

/**
 * Fetches the first available Phone Number ID and the phone number string for a WABA.
 */
async function fetchPhoneNumberInfo(wabaId: string, accessToken: string): Promise<{ id: string; display_phone_number: string }> {
  const url = `https://graph.facebook.com/v25.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(502, 'Failed to fetch phone numbers from Meta', 'META_PHONE_FETCH_FAILED');

  const data = await res.json() as { data: Array<{ id: string, display_phone_number: string, status: string }> };
  const active = data.data.find(p => p.status === 'CONNECTED' || p.status === 'VERIFIED') || data.data[0];
  
  if (!active) {
    throw new ApiError(404, 'No phone numbers found in the WhatsApp Business Account', 'META_NO_PHONE_FOUND');
  }
  return { id: active.id, display_phone_number: active.display_phone_number };
}

/**
 * Fetches the display phone number for a specific phone number ID.
 */
async function fetchSinglePhoneInfo(phoneNumberId: string, accessToken: string): Promise<string> {
  const url = `https://graph.facebook.com/v25.0/${phoneNumberId}?fields=display_phone_number&access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(502, 'Failed to fetch display phone number from Meta', 'META_PHONE_FETCH_FAILED');
  
  const data = await res.json() as { display_phone_number?: string };
  return data.display_phone_number || '';
}

/**
 * Subscribes the application to the WABA webhooks.
 * Mandatory after completing Embedded Signup.
 */
async function subscribeAppToWebhooks(wabaId: string, accessToken: string): Promise<void> {
  const url = `https://graph.facebook.com/v25.0/${wabaId}/subscribed_apps`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!res.ok) {
    const errorBody = await res.text();
    logger.warn('Failed to subscribe app to WABA webhooks', { wabaId, status: res.status, body: errorBody });
    // Treat as non-fatal to allow onboarding to finish
  } else {
    logger.info('Successfully subscribed to WABA webhooks', { wabaId });
  }
}

/**
 * Registers the phone number on WhatsApp Cloud API.
 * Mandatory to begin sending/receiving messages.
 */
async function registerPhoneNumber(phoneNumberId: string, accessToken: string): Promise<void> {
  const url = `https://graph.facebook.com/v25.0/${phoneNumberId}/register`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      pin: '123456' // Fallback PIN if user skipped creating one.
    }),
  });
  
  if (!res.ok) {
    const errorBody = await res.text();
    logger.warn('Phone registration returned non-200. It may already be registered or requires the custom PIN set during signup.', { 
      phoneNumberId, status: res.status, body: errorBody 
    });
  } else {
    logger.info('Successfully registered phone number on Cloud API', { phoneNumberId });
  }
}

/**
 * Service responsible for WhatsApp Cloud API authentication flows.
 * Converts short-lived embedded signup codes into persisted channel records.
 */
export const authService = {
  /**
   * Exchanges an OAuth authorization code for a long-lived access token,
   * optionally auto-discovers the associated WABA ID and Phone Number,
   * encrypts the token with AES-256-GCM, then upserts the channel in the database.
   *
   * Access tokens are encrypted at rest using the `DATA_ENCRYPTION_KEY` binding.
   * They are never stored in plaintext and never returned to the frontend.
   *
   * Flow (with auto-discovery):
   * 1. Exchange code for access token via Meta Graph API
   * 2. Fetch the user's WhatsApp Business Account ID (first available)
   * 3. Fetch the account's first verified/connected phone number
   * 4. Encrypt the token using AES-256-GCM
   * 5. Store or update the channel record in the database
   *
   * Flow (with provided IDs from embedded signup):
   * 1. Exchange code for access token via Meta Graph API
   * 2. Skip auto-discovery (use provided wabaId and phoneNumberId)
   * 3. Encrypt the token using AES-256-GCM
   * 4. Store or update the channel record in the database
   *
   * @param code              - Short-lived code from Meta's OAuth callback
   * @param teamId            - Team ID that owns this channel
   * @param clientId          - Meta App ID (from environment bindings)
   * @param clientSecret      - Meta App Secret (from environment bindings)
   * @param encryptionKey     - DATA_ENCRYPTION_KEY binding (64-char hex)
   * @param wabaId            - (Optional) WhatsApp Business Account ID from embedded signup
   * @param phoneNumberId     - (Optional) Phone Number ID from embedded signup
   * @returns Promise resolving to { success: true }
   * @throws {ApiError 502}   If Meta API calls fail
   * @throws {ApiError 409}   If phone number already connected to different team
   * @throws {ApiError 500}   If database persistence fails
   */
  async exchangeToken(
    code: string,
    teamId: number,
    clientId: string,
    clientSecret: string,
    encryptionKey: string,
    wabaId?: string,
    phoneNumberId?: string
  ): Promise<{ success: true }> {
    logger.info('Initiating Meta token exchange', { teamId, hasWabaId: !!wabaId, hasPhoneNumberId: !!phoneNumberId });

    const plainAccessToken = await fetchMetaAccessToken(clientId, clientSecret, code);

    // Use provided IDs or auto-discover
    let finalWabaId: string;
    let finalPhoneNumberId: string;
    let phoneNumber: string;

    if (!wabaId || !phoneNumberId) {
      // Auto-discover if not provided
      finalWabaId = await fetchWabaId(plainAccessToken);
      const phoneInfo = await fetchPhoneNumberInfo(finalWabaId, plainAccessToken);
      finalPhoneNumberId = phoneInfo.id;
      phoneNumber = phoneInfo.display_phone_number;
    } else {
      finalWabaId = wabaId;
      finalPhoneNumberId = phoneNumberId;
      // Always fetch display number when embedded signup provides the IDs
      phoneNumber = await fetchSinglePhoneInfo(finalPhoneNumberId, plainAccessToken);
    }
    
    logger.info('Using business IDs', { wabaId: finalWabaId, phoneNumberId: finalPhoneNumberId, phoneNumber });

    // Perform Embedded Signup mandatory post-actions
    await subscribeAppToWebhooks(finalWabaId, plainAccessToken);
    await registerPhoneNumber(finalPhoneNumberId, plainAccessToken);

    // Encrypt before writing to the database — never store plaintext tokens
    const encryptedToken = await encrypt(plainAccessToken, encryptionKey);

    try {
      const existing = await db
        .select({ id: channels.id, teamId: channels.teamId })
        .from(channels)
        .where(eq(channels.whatsappId, finalPhoneNumberId))
        .limit(1);

      if (existing.length > 0) {
        if (existing[0].teamId !== teamId) {
          throw new ApiError(
            409,
            'This WhatsApp number is already connected to another team',
            'CHANNEL_TEAM_MISMATCH'
          );
        }

        await db
          .update(channels)
          .set({ wabaId: finalWabaId, accessToken: encryptedToken })
          .where(eq(channels.whatsappId, finalPhoneNumberId));

        logger.info('Channel credentials rotated', { wabaId: finalWabaId, phoneNumberId: finalPhoneNumberId });
      } else {
        await db.insert(channels).values({
          teamId,
          type: 'business_app',
          wabaId: finalWabaId,
          whatsappId: finalPhoneNumberId,
          phoneNumber,
          accessToken: encryptedToken,
        });

        logger.info('Channel onboarded', { wabaId: finalWabaId, phoneNumberId: finalPhoneNumberId, phoneNumber });
      }

      return { success: true };
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        throw e;
      }

      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to persist channel credentials', { error: message });
      throw new ApiError(500, 'Failed to save channel connection', 'DB_ERROR');
    }
  },

  /**
   * Retrieves and decrypts the access token for a given channel.
   * Used by services that need to make outbound Meta API calls.
   *
   * @param encryptedToken - The encrypted token string from the database
   * @param encryptionKey  - DATA_ENCRYPTION_KEY binding (64-char hex)
   * @returns The decrypted plaintext access token
   */
  async getDecryptedToken(encryptedToken: string, encryptionKey: string): Promise<string> {
    return decrypt(encryptedToken, encryptionKey);
  },
};
