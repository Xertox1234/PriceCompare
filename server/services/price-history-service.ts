import { storage } from '../storage';
import { logger } from '../utils/logger';
import type { PriceSnapshotInsert, NormalizedPricePoint } from '../storage/types';
import {
  type PriceHistory,
  type PriceSnapshot
} from '@shared/schema';

// Re-export NormalizedPricePoint for backward compatibility
export type { NormalizedPricePoint } from '../storage/types';

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
  source = 'scraper',
  confidence = 1.0,
  metadata?: Record<string, unknown>
): Promise<PriceChangeResult> {
  try {
    // Get the product offer to access productId and retailerId
    const offerWithProduct = await storage.getProductOfferWithProduct(productOfferId);

    if (!offerWithProduct) {
      throw new Error(`Product offer ${productOfferId} not found`);
    }

    const offer = offerWithProduct.offer;

    // Get the most recent price for this offer
    const latestPriceRecord = await storage.getLatestPriceForOffer(productOfferId);
    const previousPrice = latestPriceRecord ? parseFloat(latestPriceRecord.price) : null;

    // Deduplication: Don't record if price hasn't changed
    if (previousPrice !== null && Math.abs(previousPrice - price) < 0.01) {
      return {
        recorded: false,
        previousPrice
      };
    }

    // Record the new price
    const insertData = {
      productId: offer.productId,
      retailerId: offer.retailerId,
      productOfferId,
      price: price.toString(),
      originalPrice: originalPrice?.toString(),
      source,
      confidence: confidence.toString(),
      metadata: metadata ? JSON.stringify(metadata) : null,
      recordedAt: new Date()
    };

    const result = await storage.insertPriceHistory(insertData);

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
    logger.error('Error recording price change:', { error: error instanceof Error ? error.message : String(error) });
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
    return await storage.getPriceHistoryByQuery({
      productOfferId: query.productOfferId,
      productId: query.productId,
      retailerId: query.retailerId,
      startDate: query.startDate,
      endDate: query.endDate,
      source: query.source,
      limit: query.limit,
    });
  } catch (error) {
    logger.error('Error getting price history:', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Get price history with smart data source selection
 *
 * STRATEGY: Automatically selects the most appropriate data source based on date range
 * to optimize query performance while maintaining data granularity where it matters.
 *
 * This function delegates to the storage layer implementation to avoid circular dependencies.
 * See storage.getPriceHistoryOptimized for full documentation.
 *
 * @param productId - Product ID to fetch history for
 * @param days - Number of days to retrieve (default: 30)
 * @param retailerId - Optional retailer filter for single-retailer queries
 * @returns Array of normalized price data points sorted chronologically
 * @throws Error if query fails
 */
export async function getPriceHistoryOptimized(
  productId: number,
  days = 30,
  retailerId?: number
): Promise<NormalizedPricePoint[]> {
  // Delegate to storage layer implementation
  return storage.getPriceHistoryOptimized(productId, days, retailerId);
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
  days = 90
): Promise<PriceStats | null> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get current price from product_offers
    const offer = await storage.getProductOfferById(productOfferId);

    if (!offer) {
      return null;
    }

    const currentPrice = parseFloat(offer.price);

    // Get historical data
    const history = await storage.getPriceHistoryByQuery({
      productOfferId,
      startDate
    });

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
    logger.error('Error getting price stats:', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Generate a daily price snapshot for all active products
 * This should be run as a scheduled job (e.g., daily at midnight)
 *
 * PERFORMANCE: Optimized to eliminate N+1 query pattern.
 * Uses batch fetch + Map for O(1) lookups instead of querying in loop.
 *
 * @param date - Date for the snapshot (defaults to today)
 * @returns Number of snapshots created
 */
export async function generateDailySnapshots(date: Date = new Date()): Promise<number> {
  try {
    // Normalize date to midnight
    const snapshotDate = new Date(date);
    snapshotDate.setHours(0, 0, 0, 0);

    // Performance timing
    const startTime = Date.now();

    // Step 1: Get all active product offers grouped by product and retailer
    const offers = await storage.getActiveProductOffersGrouped();

    // Step 2: BATCH FETCH - Get all existing snapshots for this date in ONE query
    // This eliminates the N+1 query pattern (was 5000+ queries, now just 1!)
    const existingSnapshots = await storage.getExistingSnapshotsForDate(snapshotDate);

    // Step 3: Create Map for O(1) lookup - no more queries in loop!
    const existingMap = new Map(
      existingSnapshots.map(snapshot => [
        `${snapshot.productId}-${snapshot.retailerId}`,
        snapshot
      ])
    );

    logger.info(`Found ${existingSnapshots.length} existing snapshots for ${snapshotDate.toISOString()}`);

    // Step 4: Group offers by product and retailer
    const groupedOffers = new Map<string, number[]>();

    for (const offer of offers) {
      const key = `${offer.productId}-${offer.retailerId}`;
      if (!groupedOffers.has(key)) {
        groupedOffers.set(key, []);
      }
      groupedOffers.get(key)!.push(parseFloat(offer.price));
    }

    // Step 5: Process snapshots and separate into inserts vs updates (no database queries in loop!)
    const snapshotsToInsert: PriceSnapshotInsert[] = [];
    const snapshotsToUpdate: Array<{ id: number; data: Partial<PriceSnapshotInsert> }> = [];

    for (const [key, prices] of Array.from(groupedOffers.entries())) {
      const [productId, retailerId] = key.split('-').map(Number);

      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);
      const averagePrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;

      const snapshotData: PriceSnapshotInsert = {
        productId,
        retailerId,
        lowestPrice: lowestPrice.toString(),
        highestPrice: highestPrice.toString(),
        averagePrice: averagePrice.toString(),
        offerCount: prices.length,
        snapshotDate
      };

      // Check if snapshot exists using O(1) Map lookup (no query!)
      const existing = existingMap.get(key);

      if (existing) {
        // Queue for update
        snapshotsToUpdate.push({
          id: existing.id,
          data: {
            lowestPrice: snapshotData.lowestPrice,
            highestPrice: snapshotData.highestPrice,
            averagePrice: snapshotData.averagePrice,
            offerCount: snapshotData.offerCount
          }
        });
      } else {
        // Queue for insert
        snapshotsToInsert.push(snapshotData);
      }
    }

    // Step 6: Batch insert new snapshots
    if (snapshotsToInsert.length > 0) {
      await storage.insertPriceSnapshots(snapshotsToInsert);
    }

    // Step 7: Batch update existing snapshots
    // Note: Drizzle doesn't support batch updates directly, but we can do them sequentially
    // This is still much faster than the original N+1 query pattern for existence checks
    for (const { id, data } of snapshotsToUpdate) {
      await storage.updatePriceSnapshot(id, data);
    }

    const snapshotCount = snapshotsToInsert.length + snapshotsToUpdate.length;

    const duration = Date.now() - startTime;
    logger.info(`Generated ${snapshotCount} price snapshots for ${snapshotDate.toISOString()} in ${duration}ms (${Math.round(snapshotCount / (duration / 1000))} snapshots/sec)`);

    return snapshotCount;
  } catch (error) {
    logger.error('Error generating daily snapshots:', { error: error instanceof Error ? error.message : String(error) });
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
    return await storage.getPriceSnapshotsByFilters(
      productId,
      retailerId,
      startDate,
      endDate
    );
  } catch (error) {
    logger.error('Error getting price snapshots:', { error: error instanceof Error ? error.message : String(error) });
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
export async function cleanupOldPriceHistory(daysToKeep = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deletedCount = await storage.deleteOldPriceHistory(cutoffDate);

    logger.info(`Cleaned up price history records older than ${cutoffDate.toISOString()}`);
    return deletedCount;
  } catch (error) {
    logger.error('Error cleaning up old price history:', { error: error instanceof Error ? error.message : String(error) });
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
  thresholdPercent = 10,
  hours = 24
): Promise<Array<{ productOfferId: number; previousPrice: number; currentPrice: number; dropPercent: number }>> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    // Get recent price changes
    const recentChanges = await storage.getRecentPriceChanges(cutoffDate);

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
    logger.error('Error detecting price drops:', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
