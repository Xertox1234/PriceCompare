/**
 * Session Cleanup Utilities
 *
 * Provides Redis-based session cleanup for security operations like password resets.
 * Sessions are stored in Redis with keys like: sess:SESSION_ID
 */

import { getRedisSessionClient } from '../config/redis';
import { createLogger } from './logger';

const log = createLogger('SessionCleanup');

/**
 * Clear all active sessions for a user by scanning Redis keys
 *
 * SECURITY: Called after password reset to force re-login across all devices.
 * This prevents stolen session cookie attacks where an attacker maintains access
 * even after the victim changes their password.
 *
 * IMPLEMENTATION: Express-session with connect-redis stores sessions as:
 * - Key pattern: sess:SESSION_ID
 * - Value: JSON with session data including user ID
 *
 * We scan all session keys and delete those belonging to the target user.
 *
 * @param userId - The user ID whose sessions should be cleared
 * @returns Number of sessions cleared
 */
export async function clearUserSessions(userId: number): Promise<number> {
  // Input validation (prevent invalid user ID from being used in Redis SCAN)
  if (!userId || userId <= 0 || !Number.isInteger(userId)) {
    throw new Error(`Invalid userId: ${userId}. Must be positive integer.`);
  }

  const redisClient = getRedisSessionClient();

  // If Redis is not available (development mode), skip session cleanup
  // In production, Redis is mandatory so this won't happen
  if (!redisClient) {
    log.warn('[SessionCleanup] Redis session client not available, skipping session cleanup', { userId });
    return 0;
  }

  try {
    let sessionsClearedCount = 0;
    let cursor = '0'; // Redis SCAN uses string cursors

    // SCAN all session keys (pattern: sess:*)
    // Using SCAN instead of KEYS to avoid blocking Redis in production
    do {
      const result = await redisClient.scan(cursor, {
        MATCH: 'sess:*',
        COUNT: 100, // Process 100 keys at a time
      });

      cursor = result.cursor;
      const keys = result.keys;

      // Check each session to see if it belongs to this user
      for (const key of keys) {
        try {
          const sessionData = await redisClient.get(key);
          if (!sessionData) continue;

          // Parse session JSON to check user ID
          // Session data structure: { passport: { user: userId }, ... }
          interface SessionData {
            passport?: {
              user?: number;
            };
          }
          // Type assertion: express-session stores JSON strings, parsed to SessionData interface
          const session = JSON.parse(sessionData) as SessionData;
          const sessionUserId = session?.passport?.user;

          if (sessionUserId === userId) {
            await redisClient.del(key);
            sessionsClearedCount++;
            log.debug('[SessionCleanup] Deleted session', { userId, sessionKey: key });
          }
        } catch (parseError) {
          // If we can't parse the session, skip it (might be corrupted or different format)
          log.warn('[SessionCleanup] Failed to parse session data', {
            key,
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
      }
    } while (cursor !== '0');

    if (sessionsClearedCount > 0) {
      log.info('[SessionCleanup] Cleared user sessions', { userId, count: sessionsClearedCount });
    }

    return sessionsClearedCount;
  } catch (error) {
    log.error('[SessionCleanup] Failed to clear user sessions', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - session cleanup is a best-effort security enhancement
    // The password reset should still succeed even if session cleanup fails
    return 0;
  }
}
