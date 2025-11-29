/**
 * Agent Query Limiter Service
 *
 * Enforces daily limits on AI-powered agent operations to control costs.
 * Tracks usage across:
 * - Google Custom Search API calls
 * - OpenAI API calls
 * - Scraping operations
 *
 * Default limit: 100 queries per day (configurable via env)
 */
import { getRedisClient } from '../config/redis';
import { createLogger } from '../utils/logger';

const log = createLogger('AgentQueryLimiter');

// Query types that count against daily limit
export type AgentQueryType =
  | 'google_search'      // Google Custom Search API
  | 'openai_completion'  // OpenAI Chat Completions
  | 'web_scrape'         // Playwright/Cheerio scraping operations
  | 'trend_discovery'    // Trend analysis (uses OpenAI)
  | 'product_extraction'; // Product data extraction

export interface QueryUsageStats {
  totalUsed: number;
  dailyLimit: number;
  remaining: number;
  resetTime: Date;
  breakdown: Record<AgentQueryType, number>;
  isLimited: boolean;
}

export interface QueryResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  reason?: string;
}

class AgentQueryLimiter {
  private readonly DAILY_LIMIT: number;
  private readonly REDIS_KEY_PREFIX = 'agent_queries';

  constructor() {
    // Default 100 queries/day, configurable via environment
    this.DAILY_LIMIT = parseInt(process.env.AGENT_DAILY_QUERY_LIMIT || '100', 10);
    log.info(`Agent query limiter initialized with daily limit: ${this.DAILY_LIMIT}`);
  }

  /**
   * Get Redis key for today's usage counter
   */
  private getDailyKey(): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${this.REDIS_KEY_PREFIX}:daily:${today}`;
  }

  /**
   * Get Redis key for query type breakdown
   */
  private getTypeKey(queryType: AgentQueryType): string {
    const today = new Date().toISOString().split('T')[0];
    return `${this.REDIS_KEY_PREFIX}:type:${queryType}:${today}`;
  }

  /**
   * Get time until daily reset (midnight UTC)
   */
  private getSecondsUntilReset(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
  }

  /**
   * Get reset time (midnight UTC)
   */
  private getResetTime(): Date {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Check if a query is allowed and increment counter if so
   * @returns QueryResult with allowed status and remaining queries
   */
  async checkAndIncrement(queryType: AgentQueryType, count = 1): Promise<QueryResult> {
    const redis = getRedisClient();

    // Fallback to in-memory if Redis unavailable (for development)
    if (!redis) {
      log.warn('Redis unavailable, allowing query without limit tracking');
      return {
        allowed: true,
        remaining: this.DAILY_LIMIT,
        resetTime: this.getResetTime(),
        reason: 'Redis unavailable - limits not enforced'
      };
    }

    const dailyKey = this.getDailyKey();
    const typeKey = this.getTypeKey(queryType);
    const ttl = this.getSecondsUntilReset();

    try {
      // Get current usage
      const currentUsage = await redis.get(dailyKey);
      const used = currentUsage ? parseInt(currentUsage, 10) : 0;

      if (used + count > this.DAILY_LIMIT) {
        log.warn(`Agent query limit reached: ${used}/${this.DAILY_LIMIT}`, { queryType });
        return {
          allowed: false,
          remaining: Math.max(0, this.DAILY_LIMIT - used),
          resetTime: this.getResetTime(),
          reason: `Daily limit of ${this.DAILY_LIMIT} queries exceeded. Resets at midnight UTC.`
        };
      }

      // Increment counters atomically using pipeline
      const pipeline = redis.pipeline();
      pipeline.incrby(dailyKey, count);
      pipeline.expire(dailyKey, ttl);
      pipeline.incrby(typeKey, count);
      pipeline.expire(typeKey, ttl);
      await pipeline.exec();

      const remaining = this.DAILY_LIMIT - (used + count);

      log.debug(`Agent query allowed: ${queryType}`, {
        used: used + count,
        remaining,
        limit: this.DAILY_LIMIT
      });

      return {
        allowed: true,
        remaining,
        resetTime: this.getResetTime()
      };
    } catch (error) {
      log.error('Error checking agent query limit', { error });
      // Allow on error to not block operations, but log for monitoring
      return {
        allowed: true,
        remaining: this.DAILY_LIMIT,
        resetTime: this.getResetTime(),
        reason: 'Error checking limit - query allowed'
      };
    }
  }

  /**
   * Check remaining queries without incrementing
   */
  async checkRemaining(): Promise<number> {
    const redis = getRedisClient();

    if (!redis) {
      return this.DAILY_LIMIT;
    }

    try {
      const currentUsage = await redis.get(this.getDailyKey());
      const used = currentUsage ? parseInt(currentUsage, 10) : 0;
      return Math.max(0, this.DAILY_LIMIT - used);
    } catch (error) {
      log.error('Error checking remaining queries', { error });
      return this.DAILY_LIMIT;
    }
  }

  /**
   * Get detailed usage statistics
   */
  async getUsageStats(): Promise<QueryUsageStats> {
    const redis = getRedisClient();
    const resetTime = this.getResetTime();

    const defaultStats: QueryUsageStats = {
      totalUsed: 0,
      dailyLimit: this.DAILY_LIMIT,
      remaining: this.DAILY_LIMIT,
      resetTime,
      breakdown: {
        google_search: 0,
        openai_completion: 0,
        web_scrape: 0,
        trend_discovery: 0,
        product_extraction: 0
      },
      isLimited: false
    };

    if (!redis) {
      return defaultStats;
    }

    try {
      const queryTypes: AgentQueryType[] = [
        'google_search',
        'openai_completion',
        'web_scrape',
        'trend_discovery',
        'product_extraction'
      ];

      // Fetch all counters
      const pipeline = redis.pipeline();
      pipeline.get(this.getDailyKey());
      queryTypes.forEach(type => pipeline.get(this.getTypeKey(type)));

      const results = await pipeline.exec();

      if (!results) {
        return defaultStats;
      }

      const totalUsed = results[0]?.[1] ? parseInt(results[0][1] as string, 10) : 0;
      const breakdown: Record<AgentQueryType, number> = {} as Record<AgentQueryType, number>;

      queryTypes.forEach((type, index) => {
        const value = results[index + 1]?.[1];
        breakdown[type] = value ? parseInt(value as string, 10) : 0;
      });

      return {
        totalUsed,
        dailyLimit: this.DAILY_LIMIT,
        remaining: Math.max(0, this.DAILY_LIMIT - totalUsed),
        resetTime,
        breakdown,
        isLimited: totalUsed >= this.DAILY_LIMIT
      };
    } catch (error) {
      log.error('Error getting usage stats', { error });
      return defaultStats;
    }
  }

  /**
   * Reset daily counter (admin only)
   */
  async resetDailyLimit(): Promise<void> {
    const redis = getRedisClient();

    if (!redis) {
      log.warn('Cannot reset limit - Redis unavailable');
      return;
    }

    try {
      const queryTypes: AgentQueryType[] = [
        'google_search',
        'openai_completion',
        'web_scrape',
        'trend_discovery',
        'product_extraction'
      ];

      const pipeline = redis.pipeline();
      pipeline.del(this.getDailyKey());
      queryTypes.forEach(type => pipeline.del(this.getTypeKey(type)));
      await pipeline.exec();

      log.info('Agent query daily limit reset');
    } catch (error) {
      log.error('Error resetting daily limit', { error });
      throw error;
    }
  }

  /**
   * Get the configured daily limit
   */
  getDailyLimit(): number {
    return this.DAILY_LIMIT;
  }
}

// Singleton instance
export const agentQueryLimiter = new AgentQueryLimiter();

/**
 * Decorator/wrapper function for agent operations
 * Use this to wrap any function that should count against the daily limit
 */
export async function withQueryLimit<T>(
  queryType: AgentQueryType,
  operation: () => Promise<T>,
  queryCount = 1
): Promise<T> {
  const result = await agentQueryLimiter.checkAndIncrement(queryType, queryCount);

  if (!result.allowed) {
    throw new Error(result.reason || 'Daily agent query limit exceeded');
  }

  return operation();
}
