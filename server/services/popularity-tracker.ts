/**
 * Popularity Tracking Service
 *
 * Tracks product access patterns to determine hot/warm/cold products
 * for intelligent cache tier selection.
 *
 * Uses Redis sorted sets for efficient popularity tracking.
 */

import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Time windows for popularity tracking
 */
const TRACKING_WINDOWS = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly',
} as const;

/**
 * Popularity thresholds for tier classification
 */
const POPULARITY_THRESHOLDS = {
  HOT: 100,   // 100+ views in last hour
  WARM: 20,   // 20-99 views in last hour
  // COLD: < 20 views
};

/**
 * Redis key prefixes for popularity tracking
 */
const POPULARITY_KEYS = {
  PRODUCT_VIEWS_HOURLY: 'popularity:product:views:hourly',
  PRODUCT_VIEWS_DAILY: 'popularity:product:views:daily',
  PRODUCT_VIEWS_WEEKLY: 'popularity:product:views:weekly',
  SEARCH_QUERIES: 'popularity:search:queries',
  TOP_PRODUCTS: 'popularity:top:products',
};

export class PopularityTracker {
  /**
   * Track a product view
   */
  async trackProductView(productId: number): Promise<void> {
    try {
      const timestamp = Date.now();
      const hour = Math.floor(timestamp / (1000 * 60 * 60));
      const day = Math.floor(timestamp / (1000 * 60 * 60 * 24));
      const week = Math.floor(timestamp / (1000 * 60 * 60 * 24 * 7));

      const pipeline = redisClient.pipeline();

      // Increment hourly view count
      pipeline.zincrby(`${POPULARITY_KEYS.PRODUCT_VIEWS_HOURLY}:${hour}`, 1, productId.toString());
      pipeline.expire(`${POPULARITY_KEYS.PRODUCT_VIEWS_HOURLY}:${hour}`, 7200); // 2 hours

      // Increment daily view count
      pipeline.zincrby(`${POPULARITY_KEYS.PRODUCT_VIEWS_DAILY}:${day}`, 1, productId.toString());
      pipeline.expire(`${POPULARITY_KEYS.PRODUCT_VIEWS_DAILY}:${day}`, 172800); // 2 days

      // Increment weekly view count
      pipeline.zincrby(`${POPULARITY_KEYS.PRODUCT_VIEWS_WEEKLY}:${week}`, 1, productId.toString());
      pipeline.expire(`${POPULARITY_KEYS.PRODUCT_VIEWS_WEEKLY}:${week}`, 1209600); // 2 weeks

      // Update global top products list
      pipeline.zincrby(POPULARITY_KEYS.TOP_PRODUCTS, 1, productId.toString());

      await pipeline.exec();
    } catch (error) {
      logger.error('Error tracking product view:', error);
    }
  }

  /**
   * Track a search query
   */
  async trackSearchQuery(query: string): Promise<void> {
    try {
      await redisClient.zincrby(POPULARITY_KEYS.SEARCH_QUERIES, 1, query.toLowerCase());

      // Keep only top 10000 queries
      const count = await redisClient.zcard(POPULARITY_KEYS.SEARCH_QUERIES);
      if (count > 10000) {
        await redisClient.zpopmin(POPULARITY_KEYS.SEARCH_QUERIES, 1000);
      }
    } catch (error) {
      logger.error('Error tracking search query:', error);
    }
  }

  /**
   * Get product view count for the last hour
   */
  async getProductViewCount(productId: number, window: keyof typeof TRACKING_WINDOWS = 'HOURLY'): Promise<number> {
    try {
      const timestamp = Date.now();
      let period: number;
      let key: string;

      switch (window) {
        case 'HOURLY':
          period = Math.floor(timestamp / (1000 * 60 * 60));
          key = `${POPULARITY_KEYS.PRODUCT_VIEWS_HOURLY}:${period}`;
          break;
        case 'DAILY':
          period = Math.floor(timestamp / (1000 * 60 * 60 * 24));
          key = `${POPULARITY_KEYS.PRODUCT_VIEWS_DAILY}:${period}`;
          break;
        case 'WEEKLY':
          period = Math.floor(timestamp / (1000 * 60 * 60 * 24 * 7));
          key = `${POPULARITY_KEYS.PRODUCT_VIEWS_WEEKLY}:${period}`;
          break;
      }

      const score = await redisClient.zscore(key, productId.toString());
      return score ? parseInt(score) : 0;
    } catch (error) {
      logger.error('Error getting product view count:', error);
      return 0;
    }
  }

  /**
   * Determine if a product is hot, warm, or cold
   */
  async getProductTier(productId: number): Promise<'hot' | 'warm' | 'cold'> {
    const viewCount = await this.getProductViewCount(productId, 'HOURLY');

    if (viewCount >= POPULARITY_THRESHOLDS.HOT) {
      return 'hot';
    } else if (viewCount >= POPULARITY_THRESHOLDS.WARM) {
      return 'warm';
    } else {
      return 'cold';
    }
  }

  /**
   * Get top N products by view count
   */
  async getTopProducts(limit: number = 100, window: keyof typeof TRACKING_WINDOWS = 'HOURLY'): Promise<number[]> {
    try {
      const timestamp = Date.now();
      let period: number;
      let key: string;

      switch (window) {
        case 'HOURLY':
          period = Math.floor(timestamp / (1000 * 60 * 60));
          key = `${POPULARITY_KEYS.PRODUCT_VIEWS_HOURLY}:${period}`;
          break;
        case 'DAILY':
          period = Math.floor(timestamp / (1000 * 60 * 60 * 24));
          key = `${POPULARITY_KEYS.PRODUCT_VIEWS_DAILY}:${period}`;
          break;
        case 'WEEKLY':
          period = Math.floor(timestamp / (1000 * 60 * 60 * 24 * 7));
          key = `${POPULARITY_KEYS.PRODUCT_VIEWS_WEEKLY}:${period}`;
          break;
      }

      const results = await redisClient.zrevrange(key, 0, limit - 1);
      return results.map(id => parseInt(id));
    } catch (error) {
      logger.error('Error getting top products:', error);
      return [];
    }
  }

  /**
   * Get top search queries
   */
  async getTopSearchQueries(limit: number = 100): Promise<Array<{ query: string; count: number }>> {
    try {
      const results = await redisClient.zrevrange(
        POPULARITY_KEYS.SEARCH_QUERIES,
        0,
        limit - 1,
        'WITHSCORES'
      );

      const queries: Array<{ query: string; count: number }> = [];
      for (let i = 0; i < results.length; i += 2) {
        queries.push({
          query: results[i],
          count: parseInt(results[i + 1]),
        });
      }

      return queries;
    } catch (error) {
      logger.error('Error getting top search queries:', error);
      return [];
    }
  }

  /**
   * Get popularity statistics
   */
  async getStats() {
    try {
      const timestamp = Date.now();
      const hour = Math.floor(timestamp / (1000 * 60 * 60));
      const day = Math.floor(timestamp / (1000 * 60 * 60 * 24));
      const week = Math.floor(timestamp / (1000 * 60 * 60 * 24 * 7));

      const [
        hourlyCount,
        dailyCount,
        weeklyCount,
        searchQueryCount,
        topProducts,
        topQueries,
      ] = await Promise.all([
        redisClient.zcard(`${POPULARITY_KEYS.PRODUCT_VIEWS_HOURLY}:${hour}`),
        redisClient.zcard(`${POPULARITY_KEYS.PRODUCT_VIEWS_DAILY}:${day}`),
        redisClient.zcard(`${POPULARITY_KEYS.PRODUCT_VIEWS_WEEKLY}:${week}`),
        redisClient.zcard(POPULARITY_KEYS.SEARCH_QUERIES),
        this.getTopProducts(10, 'HOURLY'),
        this.getTopSearchQueries(10),
      ]);

      return {
        trackedProducts: {
          hourly: hourlyCount,
          daily: dailyCount,
          weekly: weeklyCount,
        },
        trackedSearchQueries: searchQueryCount,
        topProducts: topProducts,
        topSearchQueries: topQueries,
      };
    } catch (error) {
      logger.error('Error getting popularity stats:', error);
      return {
        trackedProducts: { hourly: 0, daily: 0, weekly: 0 },
        trackedSearchQueries: 0,
        topProducts: [],
        topSearchQueries: [],
      };
    }
  }

  /**
   * Clean up old popularity data
   */
  async cleanup(): Promise<void> {
    try {
      // Keep only top 1000 products in global list
      const count = await redisClient.zcard(POPULARITY_KEYS.TOP_PRODUCTS);
      if (count > 1000) {
        await redisClient.zpopmin(POPULARITY_KEYS.TOP_PRODUCTS, count - 1000);
      }

      logger.info('Popularity data cleanup completed');
    } catch (error) {
      logger.error('Error during popularity cleanup:', error);
    }
  }
}

// Export singleton instance
export const popularityTracker = new PopularityTracker();
