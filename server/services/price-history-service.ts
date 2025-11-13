import { db } from '../db';
import { logger } from '../utils/logger';
import {
  priceHistory,
  priceSnapshots,
  productOffers,
  products,
  retailers,
  type PriceHistory,
  type PriceSnapshot,
  type InsertPriceHistory,
  type InsertPriceSnapshot
} from '@shared/schema';
import { eq, and, gte, desc, sql, lte } from 'drizzle-orm';

/**
 * Price History Service
 * Handles recording price changes, generating snapshots, and querying historical data
 */

export interface PriceChangeResult {
  recorded: boolean;
  priceHistoryId?: number;
  previousPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
}

export interface PriceStats {
  currentPrice: number;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  priceChange24h?: number;
  priceChange7d?: number;
  priceChange30d?: number;
  priceChangePercent24h?: number;
  priceChangePercent7d?: number;
  priceChangePercent30d?: number;
}

export interface PriceHistoryQuery {
  productOfferId?: number;
  productId?: number;
  retailerId?: number;
  startDate?: Date;
  endDate?: Date;
  source?: string;
  limit?: number;
}

/**
 * Record a price change for a product offer
 * Includes deduplication logic to avoid recording identical consecutive prices
 *
 * @param productOfferId - ID of the product offer
 * @param price - New price
 * @param originalPrice - Original/MSRP price (optional)
 * @param source - Source of the price data (manual, scraper, api, admin)
 * @param confidence - Confidence score 0.00-1.00
 * @param metadata - Additional metadata as JSON
 * @returns Result indicating if price was recorded
 */
export async function recordPriceChange(
  productOfferId: number,
  price: number,
  originalPrice?: number,
  source: string = 'scraper',
  confidence: number = 1.0,
  metadata?: Record<string, any>
): Promise<PriceChangeResult> {
  try {
    // Get the most recent price for this offer
    const latestPrice = await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.productOfferId, productOfferId))
      .orderBy(desc(priceHistory.recordedAt))
      .limit(1);

    const previousPrice = latestPrice.length > 0 ? parseFloat(latestPrice[0].price) : null;

    // Deduplication: Don't record if price hasn't changed
    if (previousPrice !== null && Math.abs(previousPrice - price) < 0.01) {
      return {
        recorded: false,
        previousPrice
      };
    }

    // Record the new price
    const insertData: InsertPriceHistory = {
      productOfferId,
      price: price.toString(),
      originalPrice: originalPrice?.toString(),
      source,
      confidence: confidence.toString(),
      metadata: metadata ? JSON.stringify(metadata) : null
    };

    const [result] = await db
      .insert(priceHistory)
      .values(insertData)
      .returning();

    // Calculate price change
    const priceChange = previousPrice !== null ? price - previousPrice : 0;
    const priceChangePercent = previousPrice !== null && previousPrice > 0
      ? ((price - previousPrice) / previousPrice) * 100
      : 0;

    return {
      recorded: true,
      priceHistoryId: result.id,
      previousPrice: previousPrice ?? undefined,
      priceChange: priceChange !== 0 ? priceChange : undefined,
      priceChangePercent: priceChangePercent !== 0 ? priceChangePercent : undefined
    };
  } catch (error) {
    logger.error('Error recording price change:', error);
    throw error;
  }
}

/**
 * Get price history for a product offer
 *
 * @param query - Query parameters
 * @returns Array of price history records
 */
export async function getPriceHistory(query: PriceHistoryQuery): Promise<PriceHistory[]> {
  try {
    const conditions = [];

    if (query.productOfferId) {
      conditions.push(eq(priceHistory.productOfferId, query.productOfferId));
    }

    if (query.startDate) {
      conditions.push(gte(priceHistory.recordedAt, query.startDate));
    }

    if (query.endDate) {
      conditions.push(lte(priceHistory.recordedAt, query.endDate));
    }

    if (query.source) {
      conditions.push(eq(priceHistory.source, query.source));
    }

    let queryBuilder = db
      .select()
      .from(priceHistory)
      .orderBy(desc(priceHistory.recordedAt));

    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions)) as any;
    }

    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit) as any;
    }

    return await queryBuilder;
  } catch (error) {
    logger.error('Error getting price history:', error);
    throw error;
  }
}

/**
 * Get price statistics for a product offer
 *
 * @param productOfferId - ID of the product offer
 * @param days - Number of days to analyze (default: 90)
 * @returns Price statistics
 */
export async function getPriceStats(
  productOfferId: number,
  days: number = 90
): Promise<PriceStats | null> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get current price from product_offers
    const [offer] = await db
      .select()
      .from(productOffers)
      .where(eq(productOffers.id, productOfferId))
      .limit(1);

    if (!offer) {
      return null;
    }

    const currentPrice = parseFloat(offer.price);

    // Get historical data
    const history = await db
      .select()
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.productOfferId, productOfferId),
          gte(priceHistory.recordedAt, startDate)
        )
      )
      .orderBy(desc(priceHistory.recordedAt));

    if (history.length === 0) {
      return {
        currentPrice,
        lowestPrice: currentPrice,
        highestPrice: currentPrice,
        averagePrice: currentPrice
      };
    }

    // Calculate statistics
    const prices = history.map(h => parseFloat(h.price));
    const lowestPrice = Math.min(...prices, currentPrice);
    const highestPrice = Math.max(...prices, currentPrice);
    const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    // Calculate price changes
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const price24hAgo = history.find(h => h.recordedAt && new Date(h.recordedAt) <= oneDayAgo);
    const price7dAgo = history.find(h => h.recordedAt && new Date(h.recordedAt) <= sevenDaysAgo);
    const price30dAgo = history.find(h => h.recordedAt && new Date(h.recordedAt) <= thirtyDaysAgo);

    const stats: PriceStats = {
      currentPrice,
      lowestPrice,
      highestPrice,
      averagePrice
    };

    if (price24hAgo) {
      const oldPrice = parseFloat(price24hAgo.price);
      stats.priceChange24h = currentPrice - oldPrice;
      stats.priceChangePercent24h = ((currentPrice - oldPrice) / oldPrice) * 100;
    }

    if (price7dAgo) {
      const oldPrice = parseFloat(price7dAgo.price);
      stats.priceChange7d = currentPrice - oldPrice;
      stats.priceChangePercent7d = ((currentPrice - oldPrice) / oldPrice) * 100;
    }

    if (price30dAgo) {
      const oldPrice = parseFloat(price30dAgo.price);
      stats.priceChange30d = currentPrice - oldPrice;
      stats.priceChangePercent30d = ((currentPrice - oldPrice) / oldPrice) * 100;
    }

    return stats;
  } catch (error) {
    logger.error('Error getting price stats:', error);
    throw error;
  }
}

/**
 * Generate a daily price snapshot for all active products
 * This should be run as a scheduled job (e.g., daily at midnight)
 *
 * @param date - Date for the snapshot (defaults to today)
 * @returns Number of snapshots created
 */
export async function generateDailySnapshots(date: Date = new Date()): Promise<number> {
  try {
    // Normalize date to midnight
    const snapshotDate = new Date(date);
    snapshotDate.setHours(0, 0, 0, 0);

    // Get all active product offers grouped by product and retailer
    const offers = await db
      .select({
        productId: products.id,
        retailerId: productOffers.retailerId,
        price: productOffers.price
      })
      .from(productOffers)
      .innerJoin(products, eq(productOffers.productId, products.id))
      .where(eq(productOffers.availability, 'in_stock'));

    // Group by product and retailer
    const groupedOffers = new Map<string, number[]>();

    for (const offer of offers) {
      const key = `${offer.productId}-${offer.retailerId}`;
      if (!groupedOffers.has(key)) {
        groupedOffers.set(key, []);
      }
      groupedOffers.get(key)!.push(parseFloat(offer.price));
    }

    // Create snapshots
    let snapshotCount = 0;

    for (const [key, prices] of Array.from(groupedOffers.entries())) {
      const [productId, retailerId] = key.split('-').map(Number);

      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);
      const averagePrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;

      const snapshotData: InsertPriceSnapshot = {
        productId,
        retailerId,
        lowestPrice: lowestPrice.toString(),
        highestPrice: highestPrice.toString(),
        averagePrice: averagePrice.toString(),
        offerCount: prices.length,
        snapshotDate
      };

      try {
        // Check if snapshot already exists for this day
        const existing = await db
          .select()
          .from(priceSnapshots)
          .where(
            and(
              eq(priceSnapshots.productId, productId),
              eq(priceSnapshots.retailerId, retailerId),
              sql`DATE(${priceSnapshots.snapshotDate}) = DATE(${snapshotDate})`
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing snapshot
          await db
            .update(priceSnapshots)
            .set({
              lowestPrice: snapshotData.lowestPrice,
              highestPrice: snapshotData.highestPrice,
              averagePrice: snapshotData.averagePrice,
              offerCount: snapshotData.offerCount
            })
            .where(eq(priceSnapshots.id, existing[0].id));
        } else {
          // Insert new snapshot
          await db.insert(priceSnapshots).values(snapshotData);
        }

        snapshotCount++;
      } catch (error) {
        logger.error(`Error creating snapshot for product ${productId}, retailer ${retailerId}:`, error);
        // Continue with other snapshots
      }
    }

    logger.info(`Generated ${snapshotCount} price snapshots for ${snapshotDate.toISOString()}`);
    return snapshotCount;
  } catch (error) {
    logger.error('Error generating daily snapshots:', error);
    throw error;
  }
}

/**
 * Get price snapshots for a product
 *
 * @param productId - Product ID
 * @param retailerId - Optional retailer ID to filter by
 * @param startDate - Start date for range
 * @param endDate - End date for range
 * @returns Array of price snapshots
 */
export async function getPriceSnapshots(
  productId: number,
  retailerId?: number,
  startDate?: Date,
  endDate?: Date
): Promise<PriceSnapshot[]> {
  try {
    const conditions = [eq(priceSnapshots.productId, productId)];

    if (retailerId) {
      conditions.push(eq(priceSnapshots.retailerId, retailerId));
    }

    if (startDate) {
      conditions.push(gte(priceSnapshots.snapshotDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(priceSnapshots.snapshotDate, endDate));
    }

    return await db
      .select()
      .from(priceSnapshots)
      .where(and(...conditions))
      .orderBy(desc(priceSnapshots.snapshotDate));
  } catch (error) {
    logger.error('Error getting price snapshots:', error);
    throw error;
  }
}

/**
 * Clean up old price history records
 * Keeps granular data for specified days, removes older records
 *
 * @param daysToKeep - Number of days of granular data to keep (default: 90)
 * @returns Number of records deleted
 */
export async function cleanupOldPriceHistory(daysToKeep: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db
      .delete(priceHistory)
      .where(lte(priceHistory.recordedAt, cutoffDate));

    logger.info(`Cleaned up price history records older than ${cutoffDate.toISOString()}`);
    return result.rowCount ?? 0;
  } catch (error) {
    logger.error('Error cleaning up old price history:', error);
    throw error;
  }
}

/**
 * Detect significant price drops
 *
 * @param thresholdPercent - Minimum percentage drop to be considered significant (default: 10)
 * @param hours - Number of hours to look back (default: 24)
 * @returns Array of product offers with significant price drops
 */
export async function detectSignificantPriceDrops(
  thresholdPercent: number = 10,
  hours: number = 24
): Promise<Array<{ productOfferId: number; previousPrice: number; currentPrice: number; dropPercent: number }>> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    // Get recent price changes
    const recentChanges = await db
      .select({
        productOfferId: priceHistory.productOfferId,
        price: priceHistory.price,
        recordedAt: priceHistory.recordedAt
      })
      .from(priceHistory)
      .where(gte(priceHistory.recordedAt, cutoffDate))
      .orderBy(priceHistory.productOfferId, desc(priceHistory.recordedAt));

    // Group by product offer and find drops
    const drops: Array<{ productOfferId: number; previousPrice: number; currentPrice: number; dropPercent: number }> = [];
    const offerMap = new Map<number, number[]>();

    for (const change of recentChanges) {
      if (!offerMap.has(change.productOfferId)) {
        offerMap.set(change.productOfferId, []);
      }
      offerMap.get(change.productOfferId)!.push(parseFloat(change.price));
    }

    for (const [offerId, prices] of Array.from(offerMap.entries())) {
      if (prices.length < 2) continue;

      const currentPrice = prices[0]; // Most recent
      const previousPrice = prices[prices.length - 1]; // Oldest in the period

      if (previousPrice > currentPrice) {
        const dropPercent = ((previousPrice - currentPrice) / previousPrice) * 100;

        if (dropPercent >= thresholdPercent) {
          drops.push({
            productOfferId: offerId,
            previousPrice,
            currentPrice,
            dropPercent
          });
        }
      }
    }

    return drops;
  } catch (error) {
    logger.error('Error detecting price drops:', error);
    throw error;
  }
}
