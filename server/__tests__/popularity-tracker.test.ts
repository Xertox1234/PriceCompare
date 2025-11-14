import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PopularityTracker } from '../services/popularity-tracker';

// Mock Redis client
vi.mock('../config/redis', () => ({
  redisClient: {
    pipeline: vi.fn(() => ({
      zincrby: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn().mockResolvedValue([]),
    })),
    zincrby: vi.fn(),
    zscore: vi.fn(),
    zrevrange: vi.fn(),
    zcard: vi.fn(),
    zpopmin: vi.fn(),
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('PopularityTracker', () => {
  let tracker: PopularityTracker;
  let mockRedis: any;

  beforeEach(async () => {
    const { redisClient } = await import('../config/redis');
    mockRedis = redisClient;
    vi.clearAllMocks();

    tracker = new PopularityTracker();
  });

  describe('trackProductView', () => {
    it('should track product view across all time windows', async () => {
      const productId = 123;
      const mockPipeline = {
        zincrby: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      await tracker.trackProductView(productId);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      // Should increment in hourly, daily, weekly, and global sets
      expect(mockPipeline.zincrby).toHaveBeenCalledTimes(4);
      expect(mockPipeline.expire).toHaveBeenCalledTimes(3); // Not for global
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.pipeline.mockImplementation(() => {
        throw new Error('Redis error');
      });

      // Should not throw
      await expect(tracker.trackProductView(123)).resolves.not.toThrow();
    });
  });

  describe('trackSearchQuery', () => {
    it('should track search query in lowercase', async () => {
      const query = 'iPhone 15 Pro';

      await tracker.trackSearchQuery(query);

      expect(mockRedis.zincrby).toHaveBeenCalledWith(
        'popularity:search:queries',
        1,
        'iphone 15 pro'
      );
    });

    it('should cleanup old queries when limit exceeded', async () => {
      mockRedis.zcard.mockResolvedValue(10001);

      await tracker.trackSearchQuery('test query');

      expect(mockRedis.zpopmin).toHaveBeenCalledWith(
        'popularity:search:queries',
        1000
      );
    });
  });

  describe('getProductViewCount', () => {
    it('should return view count for hourly window', async () => {
      mockRedis.zscore.mockResolvedValue('42');

      const count = await tracker.getProductViewCount(123, 'HOURLY');

      expect(count).toBe(42);
      expect(mockRedis.zscore).toHaveBeenCalled();
    });

    it('should return 0 if product has no views', async () => {
      mockRedis.zscore.mockResolvedValue(null);

      const count = await tracker.getProductViewCount(123, 'HOURLY');

      expect(count).toBe(0);
    });

    it('should support different time windows', async () => {
      mockRedis.zscore.mockResolvedValue('10');

      await tracker.getProductViewCount(123, 'DAILY');
      await tracker.getProductViewCount(123, 'WEEKLY');

      expect(mockRedis.zscore).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProductTier', () => {
    it('should classify product as HOT with 100+ views', async () => {
      mockRedis.zscore.mockResolvedValue('150');

      const tier = await tracker.getProductTier(123);

      expect(tier).toBe('hot');
    });

    it('should classify product as WARM with 20-99 views', async () => {
      mockRedis.zscore.mockResolvedValue('50');

      const tier = await tracker.getProductTier(123);

      expect(tier).toBe('warm');
    });

    it('should classify product as COLD with <20 views', async () => {
      mockRedis.zscore.mockResolvedValue('10');

      const tier = await tracker.getProductTier(123);

      expect(tier).toBe('cold');
    });

    it('should classify product as COLD with no views', async () => {
      mockRedis.zscore.mockResolvedValue(null);

      const tier = await tracker.getProductTier(123);

      expect(tier).toBe('cold');
    });
  });

  describe('getTopProducts', () => {
    it('should return top products by view count', async () => {
      mockRedis.zrevrange.mockResolvedValue(['123', '456', '789']);

      const topProducts = await tracker.getTopProducts(3, 'HOURLY');

      expect(topProducts).toEqual([123, 456, 789]);
      expect(mockRedis.zrevrange).toHaveBeenCalledWith(
        expect.stringContaining('hourly'),
        0,
        2
      );
    });

    it('should handle empty results', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);

      const topProducts = await tracker.getTopProducts(10, 'DAILY');

      expect(topProducts).toEqual([]);
    });

    it('should support different time windows', async () => {
      mockRedis.zrevrange.mockResolvedValue(['1', '2']);

      await tracker.getTopProducts(5, 'WEEKLY');

      expect(mockRedis.zrevrange).toHaveBeenCalledWith(
        expect.stringContaining('weekly'),
        0,
        4
      );
    });
  });

  describe('getTopSearchQueries', () => {
    it('should return top search queries with counts', async () => {
      mockRedis.zrevrange.mockResolvedValue([
        'iphone 15', '100',
        'macbook', '80',
        'airpods', '60'
      ]);

      const topQueries = await tracker.getTopSearchQueries(3);

      expect(topQueries).toEqual([
        { query: 'iphone 15', count: 100 },
        { query: 'macbook', count: 80 },
        { query: 'airpods', count: 60 },
      ]);
    });

    it('should handle empty results', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);

      const topQueries = await tracker.getTopSearchQueries(10);

      expect(topQueries).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return popularity statistics', async () => {
      mockRedis.zcard
        .mockResolvedValueOnce(50)   // hourly count
        .mockResolvedValueOnce(200)  // daily count
        .mockResolvedValueOnce(500)  // weekly count
        .mockResolvedValueOnce(1000); // search queries count

      mockRedis.zrevrange
        .mockResolvedValueOnce(['1', '2', '3']) // top products
        .mockResolvedValueOnce(['query1', '10', 'query2', '5']); // top queries

      const stats = await tracker.getStats();

      expect(stats).toHaveProperty('trackedProducts');
      expect(stats.trackedProducts).toEqual({
        hourly: 50,
        daily: 200,
        weekly: 500,
      });
      expect(stats).toHaveProperty('trackedSearchQueries', 1000);
      expect(stats).toHaveProperty('topProducts');
      expect(stats).toHaveProperty('topSearchQueries');
    });

    it('should handle errors gracefully', async () => {
      mockRedis.zcard.mockRejectedValue(new Error('Redis error'));

      const stats = await tracker.getStats();

      expect(stats).toEqual({
        trackedProducts: { hourly: 0, daily: 0, weekly: 0 },
        trackedSearchQueries: 0,
        topProducts: [],
        topSearchQueries: [],
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup old data when limit exceeded', async () => {
      mockRedis.zcard.mockResolvedValue(1500);

      await tracker.cleanup();

      expect(mockRedis.zpopmin).toHaveBeenCalledWith(
        'popularity:top:products',
        500 // Remove excess
      );
    });

    it('should not cleanup if under limit', async () => {
      mockRedis.zcard.mockResolvedValue(500);

      await tracker.cleanup();

      expect(mockRedis.zpopmin).not.toHaveBeenCalled();
    });
  });

  describe('tier classification boundaries', () => {
    it('should correctly classify at boundary values', async () => {
      // Exactly 100 views = HOT
      mockRedis.zscore.mockResolvedValue('100');
      expect(await tracker.getProductTier(1)).toBe('hot');

      // 99 views = WARM
      mockRedis.zscore.mockResolvedValue('99');
      expect(await tracker.getProductTier(2)).toBe('warm');

      // Exactly 20 views = WARM
      mockRedis.zscore.mockResolvedValue('20');
      expect(await tracker.getProductTier(3)).toBe('warm');

      // 19 views = COLD
      mockRedis.zscore.mockResolvedValue('19');
      expect(await tracker.getProductTier(4)).toBe('cold');
    });
  });

  describe('concurrent tracking', () => {
    it('should handle concurrent product view tracking', async () => {
      const mockPipeline = {
        zincrby: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      // Track multiple products concurrently
      await Promise.all([
        tracker.trackProductView(1),
        tracker.trackProductView(2),
        tracker.trackProductView(3),
      ]);

      expect(mockRedis.pipeline).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent search query tracking', async () => {
      const queries = ['query1', 'query2', 'query3'];

      await Promise.all(queries.map(q => tracker.trackSearchQuery(q)));

      expect(mockRedis.zincrby).toHaveBeenCalledTimes(3);
    });
  });
});
