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
 * Clear all active sessions for a user using the session index
 *
 * SECURITY: Called after password reset to force re-login across all devices.
 * This prevents stolen session cookie attacks where an attacker maintains access
 * even after the victim changes their password.
 *
 * PERFORMANCE: Uses user-keyed session index for O(M) complexity instead of O(N)
 * where M = user's sessions (typically 2-5) and N = total sessions (potentially 100K+)
 *
 * @param userId - The user ID whose sessions should be cleared
 * @returns Number of sessions cleared
 */
export async function clearUserSessions(userId: number): Promise<number> {
  // Input validation (prevent invalid user ID from being used in Redis operations)
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
    // PERFORMANCE: Use user-keyed session index for fast lookups
    const { getUserSessionIds, cleanupStaleSessionsFromIndex, removeSessionFromUserIndex } = await import(
      './session-index'
    );

    // Cleanup stale sessions from index before using it
    await cleanupStaleSessionsFromIndex(userId);

    // Get user's session IDs from index (O(M) lookup)
    const sessionIds = await getUserSessionIds(userId);

    if (sessionIds.length === 0) {
      log.debug('[SessionCleanup] No sessions to clear', { userId });
      return 0;
    }

    // Delete sessions from Redis
    const keysToDelete = sessionIds.map(sid => `sess:${sid}`);
    await redisClient.del(keysToDelete);

    // Remove deleted sessions from index
    for (const sessionId of sessionIds) {
      await removeSessionFromUserIndex(userId, sessionId);
    }

    log.info('[SessionCleanup] Cleared user sessions', { userId, count: sessionIds.length });

    return sessionIds.length;
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
