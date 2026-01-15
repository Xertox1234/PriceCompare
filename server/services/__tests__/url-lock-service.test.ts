import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UrlLockService } from '../url-lock-service';
import type { Redis } from 'ioredis';

// Mock Redis client with simple typing
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDel = vi.fn();
const mockExpire = vi.fn();
const mockExists = vi.fn();
const mockEval = vi.fn();

const mockRedisClient = {
  set: mockSet,
  get: mockGet,
  del: mockDel,
  expire: mockExpire,
  exists: mockExists,
  eval: mockEval,
} as unknown as Redis;

// Mock redis config module
vi.mock('../../config/redis', () => ({
  getRedisClient: () => mockRedisClient,
}));

/* eslint-disable @typescript-eslint/require-await -- Test helpers use async for consistency with real async operations */
describe('UrlLockService', () => {
  let service: UrlLockService;

  beforeEach(() => {
    service = new UrlLockService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL Normalization', () => {
    it('should normalize URLs by removing tracking parameters', async () => {
      const url1 = 'https://amazon.com/product/123?utm_source=email&utm_medium=newsletter';
      const url2 = 'https://amazon.com/product/123';

      // Both URLs should get the same lock
      mockSet.mockResolvedValue('OK');

      await service.withLock(url1, async () => 'result1');
      await service.withLock(url2, async () => 'result2');

      // Verify both calls used the same normalized lock key
      const calls = mockSet.mock.calls;
      expect(calls[0][0]).toBe(calls[1][0]); // Same lock key
    });

    it('should normalize case', async () => {
      const url1 = 'https://Amazon.COM/Product/123';
      const url2 = 'https://amazon.com/product/123';

      mockSet.mockResolvedValue('OK');

      await service.withLock(url1, async () => 'result1');
      await service.withLock(url2, async () => 'result2');

      const calls = mockSet.mock.calls;
      expect(calls[0][0]).toBe(calls[1][0]); // Same lock key
    });

    it('should preserve meaningful query parameters', async () => {
      const url1 = 'https://amazon.com/product?id=123';
      const url2 = 'https://amazon.com/product?id=456';

      mockSet.mockResolvedValue('OK');

      await service.withLock(url1, async () => 'result1');
      await service.withLock(url2, async () => 'result2');

      const calls = mockSet.mock.calls;
      expect(calls[0][0]).not.toBe(calls[1][0]); // Different lock keys
    });
  });

  describe('Lock Acquisition', () => {
    it('should acquire lock successfully when available', async () => {
      mockSet.mockResolvedValue('OK');
      mockEval.mockResolvedValue(1);

      const result = await service.withLock(
        'https://example.com/product',
        async () => 'success'
      );

      expect(result).toBe('success');
      expect(mockSet).toHaveBeenCalledWith(
        expect.stringContaining('lock:scrape:'),
        expect.any(String),
        'EX',
        300, // Default 5 minute TTL
        'NX'
      );
    });

    it('should return null when lock already held', async () => {
      mockSet.mockResolvedValue(null); // Lock not acquired

      const result = await service.withLock(
        'https://example.com/product',
        async () => 'should not execute'
      );

      expect(result).toBeNull();
    });

    it('should use custom TTL when provided', async () => {
      mockSet.mockResolvedValue('OK');
      mockEval.mockResolvedValue(1);

      await service.withLock(
        'https://example.com/product',
        async () => 'success',
        { ttlSeconds: 600 }
      );

      expect(mockSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        600, // Custom TTL
        'NX'
      );
    });
  });

  describe('Lock Release', () => {
    it('should release lock after successful execution', async () => {
      mockSet.mockResolvedValue('OK');
      mockEval.mockResolvedValue(1); // Lock released

      await service.withLock('https://example.com/product', async () => 'success');

      // Lua script should be called to release lock
      expect(mockEval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("get"'),
        1,
        expect.stringContaining('lock:scrape:'),
        expect.any(String)
      );
    });

    it('should release lock even when function throws', async () => {
      mockSet.mockResolvedValue('OK');
      mockEval.mockResolvedValue(1);

      const testError = new Error('Test error');

      await expect(
        service.withLock('https://example.com/product', async () => {
          throw testError;
        })
      ).rejects.toThrow('Test error');

      // Lock should still be released
      expect(mockEval).toHaveBeenCalled();
    });
  });

  describe('Concurrent Lock Attempts', () => {
    it('should prevent concurrent execution of same URL', async () => {
      let executionCount = 0;
      const slowFunction = async () => {
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'done';
      };

      // First call gets lock
      mockSet.mockResolvedValueOnce('OK');
      mockEval.mockResolvedValue(1);

      // Second call fails to get lock
      mockSet.mockResolvedValueOnce(null);

      const [result1, result2] = await Promise.all([
        service.withLock('https://example.com/product', slowFunction),
        service.withLock('https://example.com/product', slowFunction),
      ]);

      expect(result1).toBe('done'); // First succeeded
      expect(result2).toBeNull(); // Second skipped
      expect(executionCount).toBe(1); // Only executed once
    });
  });

  describe('Lock Extension', () => {
    it('should extend lock TTL', async () => {
      vi.mocked(mockExpire).mockResolvedValue(1);

      const result = await service.extendLock('https://example.com/product', 300);

      expect(result).toBe(true);
      expect(mockExpire).toHaveBeenCalledWith(
        expect.stringContaining('lock:scrape:'),
        300
      );
    });

    it('should return false if lock does not exist', async () => {
      vi.mocked(mockExpire).mockResolvedValue(0);

      const result = await service.extendLock('https://example.com/product', 300);

      expect(result).toBe(false);
    });
  });

  describe('Lock Status', () => {
    it('should check if URL is locked', async () => {
      vi.mocked(mockExists).mockResolvedValue(1);

      const isLocked = await service.isLocked('https://example.com/product');

      expect(isLocked).toBe(true);
      expect(mockExists).toHaveBeenCalledWith(
        expect.stringContaining('lock:scrape:')
      );
    });

    it('should return false if URL is not locked', async () => {
      vi.mocked(mockExists).mockResolvedValue(0);

      const isLocked = await service.isLocked('https://example.com/product');

      expect(isLocked).toBe(false);
    });
  });

  describe('Force Release', () => {
    it('should force release a lock', async () => {
      vi.mocked(mockDel).mockResolvedValue(1);

      const result = await service.forceReleaseLock('https://example.com/product');

      expect(result).toBe(true);
      expect(mockDel).toHaveBeenCalledWith(
        expect.stringContaining('lock:scrape:')
      );
    });

    it('should return false if lock does not exist', async () => {
      vi.mocked(mockDel).mockResolvedValue(0);

      const result = await service.forceReleaseLock('https://example.com/product');

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis errors gracefully', async () => {
      mockSet.mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw, just log and return null
      await expect(
        service.withLock('https://example.com/product', async () => 'success')
      ).rejects.toThrow('Redis connection failed');
    });

    it('should handle lock release errors gracefully', async () => {
      mockSet.mockResolvedValue('OK');
      mockEval.mockRejectedValue(new Error('Redis error'));

      // Should execute function successfully even if release fails
      const result = await service.withLock(
        'https://example.com/product',
        async () => 'success'
      );

      expect(result).toBe('success');
    });
  });

  describe('Skip vs Throw Behavior', () => {
    it('should skip when lock held if skipIfLocked=true (default)', async () => {
      mockSet.mockResolvedValue(null);

      const result = await service.withLock('https://example.com/product', async () => 'test');

      expect(result).toBeNull();
    });

    it('should throw when lock held if skipIfLocked=false', async () => {
      mockSet.mockResolvedValue(null);

      await expect(
        service.withLock('https://example.com/product', async () => 'test', {
          skipIfLocked: false,
        })
      ).rejects.toThrow('URL lock already held');
    });
  });
});
