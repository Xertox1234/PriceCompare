import { format } from 'date-fns';
import { createLogger } from '@/utils/logger';

const logger = createLogger('PriceDropCalculator');

/**
 * Price history data point
 */
export interface PriceHistoryData {
  id: number;
  productId: number;
  retailerId: number;
  retailerName: string;
  retailerLogo: string | null;
  price: string;
  recordedAt: Date | string;
}

/**
 * Price drop annotation
 */
export interface PriceDropAnnotation {
  date: string; // ISO format: yyyy-MM-dd
  retailerId: number;
  drop: number; // Percentage drop (e.g., 20.5 for 20.5%)
  retailerName: string;
}

/**
 * Detects significant price drops (>15%) across retailer price histories.
 *
 * Algorithm:
 * 1. Group price data by retailer
 * 2. Sort each retailer's data chronologically
 * 3. Calculate percentage drop between consecutive prices
 * 4. Flag drops exceeding 15% threshold
 *
 * @param data - Array of price history data points
 * @param dropThreshold - Percentage threshold for significant drops (default: 15)
 * @returns Array of price drop annotations sorted by date
 *
 * @example
 * ```typescript
 * const data = [
 *   { retailerId: 1, retailerName: 'Amazon', price: '100.00', recordedAt: new Date('2024-01-01') },
 *   { retailerId: 1, retailerName: 'Amazon', price: '80.00', recordedAt: new Date('2024-01-05') }
 * ];
 * const drops = calculatePriceDropAnnotations(data);
 * // Returns: [{ date: '2024-01-05', retailerId: 1, drop: 20, retailerName: 'Amazon' }]
 * ```
 */
export function calculatePriceDropAnnotations(
  data: PriceHistoryData[],
  dropThreshold = 15
): PriceDropAnnotation[] {
  if (!data || data.length === 0) {
    return [];
  }

  const annotations: PriceDropAnnotation[] = [];

  // Group data by retailer
  const dataByRetailer = new Map<number, PriceHistoryData[]>();
  data.forEach((item) => {
    if (!dataByRetailer.has(item.retailerId)) {
      dataByRetailer.set(item.retailerId, []);
    }
    const retailerData = dataByRetailer.get(item.retailerId);
    if (retailerData) {
      retailerData.push(item);
    } else {
      // Defensive: Initialize if missing (shouldn't happen in normal flow)
      logger.warn(`Missing retailer data for ID: ${item.retailerId}, initializing`);
      dataByRetailer.set(item.retailerId, [item]);
    }
  });

  // Check each retailer's price history for significant drops
  dataByRetailer.forEach((retailerData) => {
    // Sort chronologically
    const sorted = [...retailerData].sort((a, b) => {
      const dateA = typeof a.recordedAt === 'string' ? new Date(a.recordedAt) : a.recordedAt;
      const dateB = typeof b.recordedAt === 'string' ? new Date(b.recordedAt) : b.recordedAt;
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate drops between consecutive prices
    for (let i = 1; i < sorted.length; i++) {
      const prevPrice = parseFloat(sorted[i - 1].price);
      const currPrice = parseFloat(sorted[i].price);
      const drop = ((prevPrice - currPrice) / prevPrice) * 100;

      if (drop > dropThreshold) {
        const date =
          typeof sorted[i].recordedAt === 'string'
            ? new Date(sorted[i].recordedAt)
            : sorted[i].recordedAt;

        annotations.push({
          date: format(date, 'yyyy-MM-dd'),
          retailerId: sorted[i].retailerId,
          drop,
          retailerName: sorted[i].retailerName,
        });
      }
    }
  });

  return annotations;
}

/**
 * Calculates historical price statistics for context.
 *
 * @param data - Array of price history data points
 * @returns Object containing average, lowest, and highest prices
 */
export function calculateHistoricalContext(
  data: PriceHistoryData[]
): { averagePrice: number; lowestPrice: number; highestPrice: number } | undefined {
  if (!data || data.length === 0) {
    return undefined;
  }

  const prices = data.map((item) => parseFloat(item.price));
  const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);

  return {
    averagePrice,
    lowestPrice,
    highestPrice,
  };
}
