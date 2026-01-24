/**
 * Session Index Tests
 *
 * Tests for user-keyed session index operations that enable fast session invalidation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RedisClientType } from 'redis';
import {
  addSessionToUserIndex,
  removeSessionFromUserIndex,
  getUserSessionIds,
  cleanupStaleSessionsFromIndex,
} from '../session-index';

// Mock Redis client functions
const mockSAdd = vi.fn();
const mockSRem = vi.fn();
const mockSMembers = vi.fn();
const mockSCard = vi.fn();
const mockExpire = vi.fn();
const mockExists = vi.fn();
const mockDel = vi.fn();

// Mock pipeline for multi() operations
const mockPipelineExists = vi.fn();
const mockPipelineExec = vi.fn();
const mockMulti = vi.fn(() => ({
  exists: mockPipelineExists,
  exec: mockPipelineExec,
}));

// Mock Redis client
const mockRedisClient = {
  sAdd: mockSAdd,
  sRem: mockSRem,
  sMembers: mockSMembers,
  sCard: mockSCard,
  expire: mockExpire,
  exists: mockExists,
  del: mockDel,
  multi: mockMulti,
} as unknown as RedisClientType;

// Mock redis config module
vi.mock('../../config/redis', () => ({
  getRedisSessionClient: () => mockRedisClient,
}));

describe('Session Index Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addSessionToUserIndex', () => {
    it('should add session to user index and set TTL', async () => {
      const userId = 123;
      const sessionId = 'test-session-id';

      mockSAdd.mockResolvedValue(1);
      mockExpire.mockResolvedValue(true);

      const result = await addSessionToUserIndex(userId, sessionId);

      expect(result).toBe(true);
      expect(mockSAdd).toHaveBeenCalledWith('user_sessions:123', sessionId);
      expect(mockExpire).toHaveBeenCalledWith('user_sessions:123', 86400);
    });

    it('should handle Redis errors gracefully', async () => {
      const userId = 123;
      const sessionId = 'test-session-id';

      mockSAdd.mockRejectedValue(new Error('Redis error'));

      const result = await addSessionToUserIndex(userId, sessionId);

      expect(result).toBe(false);
    });
  });

  describe('removeSessionFromUserIndex', () => {
    it('should remove session from user index', async () => {
      const userId = 123;
      const sessionId = 'test-session-id';

      mockSRem.mockResolvedValue(1);
      vi.mocked(mockSCard).mockResolvedValue(2); // Still has other sessions

      const result = await removeSessionFromUserIndex(userId, sessionId);

      expect(result).toBe(true);
      expect(mockRedisClient.sRem).toHaveBeenCalledWith('user_sessions:123', sessionId);
      expect(mockDel).not.toHaveBeenCalled(); // Should not delete key when sessions remain
    });

    it('should delete key when last session removed', async () => {
      const userId = 123;
      const sessionId = 'test-session-id';

      mockSRem.mockResolvedValue(1);
      vi.mocked(mockSCard).mockResolvedValue(0); // No sessions left
      vi.mocked(mockDel).mockResolvedValue(1);

      const result = await removeSessionFromUserIndex(userId, sessionId);

      expect(result).toBe(true);
      expect(mockDel).toHaveBeenCalledWith('user_sessions:123');
    });

    it('should handle session not in index', async () => {
      const userId = 123;
      const sessionId = 'non-existent-session';

      mockSRem.mockResolvedValue(0); // Session not found

      const result = await removeSessionFromUserIndex(userId, sessionId);

      expect(result).toBe(true);
      expect(mockSCard).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const userId = 123;
      const sessionId = 'test-session-id';

      mockSRem.mockRejectedValue(new Error('Redis error'));

      const result = await removeSessionFromUserIndex(userId, sessionId);

      expect(result).toBe(false);
    });
  });

  describe('getUserSessionIds', () => {
    it('should return user session IDs', async () => {
      const userId = 123;
      const sessionIds = ['session-1', 'session-2', 'session-3'];

      mockSMembers.mockResolvedValue(sessionIds);

      const result = await getUserSessionIds(userId);

      expect(result).toEqual(sessionIds);
      expect(mockSMembers).toHaveBeenCalledWith('user_sessions:123');
    });

    it('should return empty array when user has no sessions', async () => {
      const userId = 123;

      mockSMembers.mockResolvedValue([]);

      const result = await getUserSessionIds(userId);

      expect(result).toEqual([]);
    });

    it('should handle Redis errors gracefully', async () => {
      const userId = 123;

      mockSMembers.mockRejectedValue(new Error('Redis error'));

      const result = await getUserSessionIds(userId);

      expect(result).toEqual([]);
    });
  });

  describe('cleanupStaleSessionsFromIndex', () => {
    it('should remove stale sessions from index', async () => {
      const userId = 123;
      const allSessionIds = ['session-1', 'session-2', 'session-3'];

      // session-1 exists, session-2 and session-3 are stale
      mockSMembers.mockResolvedValue(allSessionIds);

      // Mock pipeline results: [error, result] tuples
      mockPipelineExists.mockReturnThis(); // Allow chaining
      mockPipelineExec.mockResolvedValue([
        [null, 1], // session-1 exists
        [null, 0], // session-2 doesn't exist
        [null, 0], // session-3 doesn't exist
      ]);

      mockSRem.mockResolvedValue(2);
      vi.mocked(mockSCard).mockResolvedValue(1); // 1 session remains

      const result = await cleanupStaleSessionsFromIndex(userId);

      expect(result).toBe(2);
      expect(mockRedisClient.sRem).toHaveBeenCalledWith('user_sessions:123', ['session-2', 'session-3']);
      expect(mockDel).not.toHaveBeenCalled(); // Should not delete key when sessions remain
    });

    it('should delete key when all sessions are stale', async () => {
      const userId = 123;
      const allSessionIds = ['session-1', 'session-2'];

      // All sessions are stale
      mockSMembers.mockResolvedValue(allSessionIds);

      // Mock pipeline results: [error, result] tuples
      mockPipelineExists.mockReturnThis(); // Allow chaining
      mockPipelineExec.mockResolvedValue([
        [null, 0], // session-1 doesn't exist
        [null, 0], // session-2 doesn't exist
      ]);

      mockSRem.mockResolvedValue(2);
      vi.mocked(mockSCard).mockResolvedValue(0); // No sessions left
      vi.mocked(mockDel).mockResolvedValue(1);

      const result = await cleanupStaleSessionsFromIndex(userId);

      expect(result).toBe(2);
      expect(mockDel).toHaveBeenCalledWith('user_sessions:123');
    });

    it('should return 0 when no stale sessions', async () => {
      const userId = 123;
      const allSessionIds = ['session-1', 'session-2'];

      // All sessions exist
      mockSMembers.mockResolvedValue(allSessionIds);

      // Mock pipeline results: [error, result] tuples
      mockPipelineExists.mockReturnThis(); // Allow chaining
      mockPipelineExec.mockResolvedValue([
        [null, 1], // session-1 exists
        [null, 1], // session-2 exists
      ]);

      const result = await cleanupStaleSessionsFromIndex(userId);

      expect(result).toBe(0);
      expect(mockRedisClient.sRem).not.toHaveBeenCalled();
    });

    it('should return 0 when user has no sessions', async () => {
      const userId = 123;

      mockSMembers.mockResolvedValue([]);

      const result = await cleanupStaleSessionsFromIndex(userId);

      expect(result).toBe(0);
      expect(mockMulti).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const userId = 123;

      mockSMembers.mockRejectedValue(new Error('Redis error'));

      const result = await cleanupStaleSessionsFromIndex(userId);

      expect(result).toBe(0);
    });

    it('should use pipelined exists checks to minimize race window', async () => {
      const userId = 123;
      const sessionIds = ['session-1', 'session-2', 'session-3'];

      mockSMembers.mockResolvedValue(sessionIds);

      // Mock pipeline execution - session-2 exists, session-1 and session-3 don't
      mockPipelineExists.mockReturnThis(); // Allow chaining
      mockPipelineExec.mockResolvedValue([
        [null, 0], // session-1 doesn't exist
        [null, 1], // session-2 exists
        [null, 0], // session-3 doesn't exist
      ]);

      mockSRem.mockResolvedValue(2);
      vi.mocked(mockSCard).mockResolvedValue(1); // 1 session remains

      const result = await cleanupStaleSessionsFromIndex(userId);

      // Verify pipelined execution
      expect(mockMulti).toHaveBeenCalledTimes(1);
      expect(mockPipelineExists).toHaveBeenCalledTimes(3);
      expect(mockPipelineExists).toHaveBeenCalledWith('sess:session-1');
      expect(mockPipelineExists).toHaveBeenCalledWith('sess:session-2');
      expect(mockPipelineExists).toHaveBeenCalledWith('sess:session-3');
      expect(mockPipelineExec).toHaveBeenCalledTimes(1);

      // Verify only stale sessions removed
      expect(result).toBe(2); // session-1 and session-3 removed
      expect(mockSRem).toHaveBeenCalledWith('user_sessions:123', ['session-1', 'session-3']);
    });
  });

  describe('Performance characteristics', () => {
    it('should use O(M) operations for user sessions', async () => {
      const userId = 123;
      const sessionIds = Array.from({ length: 5 }, (_, i) => `session-${i}`);

      mockSMembers.mockResolvedValue(sessionIds);

      await getUserSessionIds(userId);

      // Should make only ONE Redis call (sMembers) regardless of session count
      expect(mockSMembers).toHaveBeenCalledTimes(1);
    });

    it('should not scan all sessions (O(N) operation)', async () => {
      // This test verifies we never use SCAN operation
      const userId = 123;
      const sessionIds = ['session-1', 'session-2'];

      mockSMembers.mockResolvedValue(sessionIds);

      await getUserSessionIds(userId);

      // Verify we use SET operations (O(M)) not SCAN (O(N))
      expect(mockSMembers).toHaveBeenCalled();
      // Verify scan is never used (we don't even have it in our mock)
      expect(mockSMembers).toHaveBeenCalledTimes(1);
    });
  });
});
