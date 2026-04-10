import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { channels } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Service to execute WhatsApp Cloud API authentication exchanges.
 * This bridges Meta's short-lived JS tokens into long-lived system tokens.
 */
export const authService = {
  /**
   * Exchanges an embedded signup temporary code for a System User Access Token
   * 
   * @param code - The short lived code fired from Meta React UI
   * @param wabaId - The associated WABA ID
   * @param phoneNumberId - Given Phone ID context 
   * @param clientId - The FB App Client ID
   * @param clientSecret - The FB App Secret
   */
  async exchangeToken(
    code: string,
    wabaId: string,
    phoneNumberId: string,
    clientId: string,
    clientSecret: string
  ) {
    logger.info('Initiating Meta token exchange', { wabaId, phoneNumberId });
    
    // Simulate HTTP graph api call locally to preserve user mock state. 
    // In strict production, this calls fetch(\`graph.facebook.com/v25.0/oauth/access_token\`)
    const rawAccessToken = `EAA${code}MOCK${Buffer.from(wabaId).toString('hex')}TOKEN`;
    
    if (!rawAccessToken) {
      throw new ApiError(500, 'Invalid token received from Meta', 'BAD_OAUTH_TOKEN');
    }

    try {
      // Create or update the channel with the newly discovered access token
      const existing = await db.select().from(channels).where(eq(channels.whatsappId, phoneNumberId)).limit(1);

      if (existing.length > 0) {
        await db.update(channels)
            .set({ wabaId, accessToken: rawAccessToken })
            .where(eq(channels.whatsappId, phoneNumberId));
      } else {
        await db.insert(channels).values({
            userId: 1, // Mock system user
            type: 'business_app',
            wabaId,
            whatsappId: phoneNumberId,
            accessToken: rawAccessToken
        });
      }

      logger.info('Channel successfully onboarded', { wabaId, phoneNumberId });
      
      return { success: true, accessToken: rawAccessToken };
    } catch (e: unknown) {
      const dbErr = e instanceof Error ? e.message : 'Unknown DB error';
      logger.error('Failed storing channel credentials', { error: dbErr });
      throw new ApiError(500, 'Failed to save channel connection', 'DB_ERROR');
    }
  }
};
