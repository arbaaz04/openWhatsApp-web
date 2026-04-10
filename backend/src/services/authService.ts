import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
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
 * @param clientId - Your Meta App ID
 * @param clientSecret - Your Meta App Secret
 * @param code - The temporary code from the embedded signup flow
 * @returns The long-lived access token string
 * @throws {ApiError} if Meta returns a non-200 or a malformed response
 */
async function fetchMetaAccessToken(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<string> {
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
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
 * Service responsible for WhatsApp Cloud API authentication flows.
 * Converts short-lived embedded signup codes into persisted channel records.
 */
export const authService = {
  /**
   * Exchanges an embedded signup code for a long-lived access token and
   * upserts the corresponding channel record in the database.
   *
   * @param code - Short-lived code from Meta's embedded signup JS callback
   * @param wabaId - WhatsApp Business Account ID
   * @param phoneNumberId - Phone Number ID associated with the channel
   * @param clientId - Meta App ID (from environment bindings)
   * @param clientSecret - Meta App Secret (from environment bindings)
   */
  async exchangeToken(
    code: string,
    wabaId: string,
    phoneNumberId: string,
    clientId: string,
    clientSecret: string
  ): Promise<{ success: true }> {
    logger.info('Initiating Meta token exchange', { wabaId, phoneNumberId });

    const accessToken = await fetchMetaAccessToken(clientId, clientSecret, code);

    try {
      const existing = await db
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.whatsappId, phoneNumberId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(channels)
          .set({ wabaId, accessToken })
          .where(eq(channels.whatsappId, phoneNumberId));

        logger.info('Channel credentials rotated', { wabaId, phoneNumberId });
      } else {
        await db.insert(channels).values({
          userId: 1, // TODO: derive from authenticated session once auth layer exists
          type: 'business_app',
          wabaId,
          whatsappId: phoneNumberId,
          accessToken,
        });

        logger.info('Channel onboarded', { wabaId, phoneNumberId });
      }

      return { success: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to persist channel credentials', { error: message });
      throw new ApiError(500, 'Failed to save channel connection', 'DB_ERROR');
    }
  },
};
