import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Redis and logger BEFORE importing service
import './helpers/mock-redis';
import './helpers/mock-logger';

import { AdvancedCacheService, CacheTier } from '../services/advanced-cache';

describe('AdvancedCacheService', () => {
  let cacheService: AdvancedCacheService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock Redis client with dynamic method stubs
  let mockRedis: any;

  beforeEach(async () => {
    const { redisClient } = await import('../config/redis');
    mockRedis = redisClient;
    vi.clearAllMocks();

    cacheService = new AdvancedCacheService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return value from L1 cache if available', async () => {
      const testData = { id: 1, name: 'Test Product' };

      // Set in L1 cache first
      await cacheService.set('test:key', testData, CacheTier.HOT, true);

      // Get should hit L1 cache
      const result = await cacheService.get('test:key', true);

      expect(result).toEqual(testData);
      // Redis should not be called for L1 hit
    });

    it('should return value from L2 cache if L1 miss', async () => {
      const testData = { id: 1, name: 'Test Product' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test:key', true);

      expect(result).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith('test:key');
    });

    it('should return null if key not found in both caches', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get('nonexistent:key');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('test:key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value in both L1 and L2 caches', async () => {
      const testData = { id: 1, name: 'Test Product' };

      await cacheService.set('test:key', testData, CacheTier.HOT, true);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:key',
        1800, // HOT tier TTL
        JSON.stringify(testData)
      );

      // Verify L1 cache
      const result = await cacheService.get('test:key', true);
      expect(result).toEqual(testData);
    });

    it('should use correct TTL for different tiers', async () => {
      const testData = { id: 1 };

      // Test COLD tier
      await cacheService.set('test:cold', testData, CacheTier.COLD, false);
      expect(mockRedis.setex).toHaveBeenCalledWith('test:cold', 180, expect.any(String));

      // Test STATIC tier
      await cacheService.set('test:static', testData, CacheTier.STATIC, false);
      expect(mockRedis.setex).toHaveBeenCalledWith('test:static', 3600, expect.any(String));
    });

    it('should skip L1 cache when useL1 is false', async () => {
      const testData = { id: 1 };

      await cacheService.set('test:key', testData, CacheTier.WARM, false);

      expect(mockRedis.setex).toHaveBeenCalled();

      // L1 should be empty
      const result = await cacheService.get('test:key', true);
      expect(result).toBeNull(); // L1 miss
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if available', async () => {
      const testData = { id: 1, name: 'Cached' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const fetchFn = vi.fn().mockResolvedValue({ id: 1, name: 'Fresh' });

      const result = await cacheService.getOrSet('test:key', fetchFn, CacheTier.WARM);

      expect(result).toEqual(testData);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache value if not in cache', async () => {
      mockRedis.get.mockResolvedValue(null);

      const freshData = { id: 1, name: 'Fresh' };
      const fetchFn = vi.fn().mockResolvedValue(freshData);

      const result = await cacheService.getOrSet('test:key', fetchFn, CacheTier.WARM);

      expect(result).toEqual(freshData);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:key',
        600, // WARM tier
        JSON.stringify(freshData)
      );
    });
  });

  describe('invalidate', () => {
    it('should remove key from both L1 and L2 caches', async () => {
      const testData = { id: 1 };

      // Set in both caches
      await cacheService.set('test:key', testData, CacheTier.HOT, true);

      // Invalidate
      await cacheService.invalidate('test:key');

      expect(mockRedis.del).toHaveBeenCalledWith('test:key');
      expect(mockRedis.publish).toHaveBeenCalled();

      // Verify L1 is cleared
      const result = await cacheService.get('test:key', true);
      expect(result).toBeNull();
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate multiple keys matching pattern using SCAN', async () => {
      const keys = ['product:1', 'product:2', 'product:3'];
      // SCAN returns [nextCursor, keys] - '0' cursor indicates end of iteration
      mockRedis.scan.mockResolvedValue(['0', keys]);

      const count = await cacheService.invalidatePattern('product:*');

      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'product:*', 'COUNT', 100);
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
      expect(count).toBe(3);
    });

    it('should handle multi-page SCAN results', async () => {
      // First call returns cursor '123' indicating more results
      mockRedis.scan.mockResolvedValueOnce(['123', ['product:1', 'product:2']]);
      // Second call with cursor '123' returns final results
      mockRedis.scan.mockResolvedValueOnce(['0', ['product:3']]);

      const count = await cacheService.invalidatePattern('product:*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(count).toBe(3);
    });

    it('should return 0 if no keys match pattern', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      const count = await cacheService.invalidatePattern('nonexistent:*');

      expect(count).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      // Simulate some cache operations
      const testData = { id: 1 };

      // L1 hit
      await cacheService.set('test:1', testData, CacheTier.HOT, true);
      await cacheService.get('test:1', true);

      // L2 hit
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));
      await cacheService.get('test:2', true);

      // Miss
      mockRedis.get.mockResolvedValue(null);
      await cacheService.get('test:3', true);

      const stats = cacheService.getStats();

      expect(stats).toHaveProperty('l1');
      expect(stats).toHaveProperty('l2');
      expect(stats).toHaveProperty('overall');
      expect(stats.l1).toHaveProperty('hits');
      expect(stats.l1).toHaveProperty('misses');
      expect(stats.l1).toHaveProperty('hitRate');
      expect(stats.overall).toHaveProperty('totalRequests');
    });
  });

  describe('generateKey', () => {
    it('should generate consistent cache keys', () => {
      const key1 = AdvancedCacheService.generateKey('product', 123, 'detail');
      const key2 = AdvancedCacheService.generateKey('product', 123, 'detail');

      expect(key1).toBe(key2);
      expect(key1).toBe('product:123:detail');
    });

    it('should filter out undefined parameters', () => {
      const key = AdvancedCacheService.generateKey('product', 123, undefined, 'detail');

      expect(key).toBe('product:123:detail');
    });

    it('should handle boolean parameters', () => {
      const key = AdvancedCacheService.generateKey('product', 123, true);

      expect(key).toBe('product:123:true');
    });
  });

  describe('cache warming', () => {
    it('should populate L1 cache for hot products', async () => {
      const hotProduct = { id: 1, name: 'Hot Product' };

      await cacheService.set('product:1', hotProduct, CacheTier.HOT, true);

      // Should be in L1
      const result = await cacheService.get('product:1', true);
      expect(result).toEqual(hotProduct);
    });

    it('should not populate L1 cache for cold products', async () => {
      const coldProduct = { id: 2, name: 'Cold Product' };

      await cacheService.set('product:2', coldProduct, CacheTier.COLD, false);

      // Should not be in L1
      const result = await cacheService.get('product:2', true);
      expect(result).toBeNull(); // L1 miss
    });
  });

  describe('TTL behavior', () => {
    it('should expire L1 cache entries after TTL', async () => {
      vi.useFakeTimers();

      const testData = { id: 1 };
      await cacheService.set('test:key', testData, CacheTier.HOT, true);

      // Should be available immediately
      let result = await cacheService.get('test:key', true);
      expect(result).toEqual(testData);

      // Advance time past L1 TTL (60 seconds)
      vi.advanceTimersByTime(61000);

      // Should be expired from L1
      result = await cacheService.get('test:key', true);
      expect(result).toBeNull(); // L1 expired

      vi.useRealTimers();
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection error'));
      mockRedis.setex.mockRejectedValue(new Error('Connection error'));

      // Should not throw
      const result = await cacheService.get('test:key');
      expect(result).toBeNull();

      await expect(
        cacheService.set('test:key', { id: 1 }, CacheTier.WARM)
      ).resolves.not.toThrow();
    });

    it('should track errors in statistics', async () => {
      mockRedis.get.mockRejectedValue(new Error('Error'));

      await cacheService.get('test:key');

      const stats = cacheService.getStats();
      expect(stats.overall.errors).toBeGreaterThan(0);
    });
  });

  describe('L1 cache deletePattern', () => {
    beforeEach(() => {
      // Ensure setex returns successfully (otherwise set() fails silently)
      mockRedis.setex.mockResolvedValue('OK');
    });

    it('should delete keys matching exact key invalidation', async () => {
      // Set up multiple keys - mock Redis to return the stored values
      await cacheService.set('product:123:detail', { id: 123 }, CacheTier.HOT, true);
      await cacheService.set('product:123:offers', { offers: [] }, CacheTier.HOT, true);
      await cacheService.set('product:456:detail', { id: 456 }, CacheTier.HOT, true);
      await cacheService.set('retailer:1:data', { name: 'Amazon' }, CacheTier.HOT, true);

      // Check L1 cache stats to verify items were added
      const statsBefore = cacheService.getStats();
      expect(statsBefore.overall.sets).toBe(4);

      // Invalidate specific keys
      await cacheService.invalidate('product:123:detail');
      await cacheService.invalidate('product:123:offers');

      // Verify invalidations were tracked
      const statsAfter = cacheService.getStats();
      expect(statsAfter.overall.invalidations).toBe(2);

      // Set value again and verify we can retrieve it (proving L1 works)
      await cacheService.set('product:456:detail', { id: 456, updated: true }, CacheTier.HOT, true);
      const result = await cacheService.get('product:456:detail', true);
      expect(result).toEqual({ id: 456, updated: true });
    });

    it('should handle empty cache gracefully', async () => {
      // Invalidate on empty cache should not throw
      await expect(cacheService.invalidate('nonexistent:key')).resolves.not.toThrow();
    });
  });

  describe('L1 pattern invalidation preserves unrelated data', () => {
    beforeEach(() => {
      // Ensure setex returns successfully (otherwise set() fails silently)
      mockRedis.setex.mockResolvedValue('OK');
    });

    it('should call SCAN instead of KEYS for pattern invalidation', async () => {
      // Mock SCAN to return keys matching pattern
      mockRedis.scan.mockResolvedValue(['0', ['product:1:detail', 'product:1:offers']]);

      // Perform pattern invalidation
      await cacheService.invalidatePattern('product:1:*');

      // Verify SCAN was called (not KEYS)
      expect(mockRedis.scan).toHaveBeenCalled();
      // Verify del was called with both keys (uses spread operator)
      expect(mockRedis.del).toHaveBeenCalledWith('product:1:detail', 'product:1:offers');
    });

    it('should track pattern invalidation statistics in getStats', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['product:1', 'product:2']]);

      const stats = cacheService.getStats();
      expect(stats).toHaveProperty('patternInvalidation');
      expect(stats.patternInvalidation).toHaveProperty('operations');
      expect(stats.patternInvalidation).toHaveProperty('keysDeleted');
      expect(stats.patternInvalidation).toHaveProperty('avgKeysPerOperation');
    });

    it('should track invalidation count during pattern invalidation', async () => {
      // Mock SCAN to return some keys
      mockRedis.scan.mockResolvedValue(['0', ['test:1', 'test:2']]);

      // Reset stats
      cacheService.resetStats();

      // Perform pattern invalidation
      const deletedCount = await cacheService.invalidatePattern('test:*');

      // Verify count returned and stats updated
      expect(deletedCount).toBe(2);
      const stats = cacheService.getStats();
      // invalidatePattern adds to overall.invalidations, not patternInvalidation
      // (patternInvalidation is only updated via pub/sub handler on remote instances)
      expect(stats.overall.invalidations).toBe(2);
    });
  });

  describe('close', () => {
    it('should close pub/sub subscriber connection', async () => {
      // Close should not throw
      await expect(cacheService.close()).resolves.not.toThrow();
    });
  });
});
