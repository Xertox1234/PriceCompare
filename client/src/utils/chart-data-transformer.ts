import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import {
  isChartPriceDataPoint,
  safeParsePriceToNumber,
  type ChartPriceDataPoint,
} from '@shared/api-types';
import { createLogger } from '@/utils/logger';

const log = createLogger('ChartData');

/**
 * Price data point for chart rendering
 *
 * This is an alias for ChartPriceDataPoint from shared/api-types
 * to maintain backwards compatibility with existing chart code.
 */
export type PriceDataPoint = ChartPriceDataPoint;

/**
 * Validate and filter price data points for chart rendering
 *
 * Filters out invalid entries to prevent runtime errors in chart components.
 * Uses type guards from shared/api-types for consistent validation.
 *
 * @param data - Array of potentially invalid price data points
 * @returns Array of validated PriceDataPoint objects
 */
export function validatePriceDataPoints(data: unknown[]): PriceDataPoint[] {
  const validPoints: PriceDataPoint[] = [];
  let invalidCount = 0;

  for (const item of data) {
    if (isChartPriceDataPoint(item)) {
      // Type guard narrows item to ChartPriceDataPoint (= PriceDataPoint)
      validPoints.push(item);
    } else {
      invalidCount++;
      if (invalidCount <= 3) {
        log.warn('Invalid price data point filtered out', { item });
      }
    }
  }

  if (invalidCount > 0) {
    log.warn('Invalid data points filtered out', { count: invalidCount });
  }

  return validPoints;
}

export interface AggregatedDataPoint {
  date: string;
  timestamp: number;
  [key: string]: string | number; // retailer_${id}: price (number), or date/timestamp (string/number)
}

export type AggregationLevel = 'none' | 'daily' | 'weekly' | 'monthly';

/**
 * Determines the appropriate aggregation level based on data size and time range
 */
export function determineAggregationLevel(
  dataPointCount: number,
  timeRangeDays: number
): AggregationLevel {
  // For large datasets or long time ranges, aggregate to reduce chart complexity
  if (timeRangeDays > 180 || dataPointCount > 500) {
    return 'monthly';
  } else if (timeRangeDays > 60 || dataPointCount > 200) {
    return 'weekly';
  } else if (timeRangeDays > 30 || dataPointCount > 100) {
    return 'daily';
  }
  return 'none';
}

/**
 * Aggregate price data points by time period
 */
export function aggregatePriceData(
  data: PriceDataPoint[],
  level: AggregationLevel
): PriceDataPoint[] {
  if (level === 'none' || data.length === 0) {
    return data;
  }

  // Group by retailer first
  const retailerGroups = new Map<number, PriceDataPoint[]>();
  data.forEach((point) => {
    const retailerGroup = retailerGroups.get(point.retailerId) ?? [];
    retailerGroup.push(point);
    retailerGroups.set(point.retailerId, retailerGroup);
  });

  // Aggregate each retailer's data
  const aggregated: PriceDataPoint[] = [];

  retailerGroups.forEach((points, _retailerId) => {
    const grouped = new Map<string, PriceDataPoint[]>();

    points.forEach((point) => {
      const date =
        typeof point.recordedAt === 'string' ? parseISO(point.recordedAt) : point.recordedAt;

      let groupKey: string;
      switch (level) {
        case 'weekly':
          groupKey = format(startOfWeek(date), 'yyyy-MM-dd');
          break;
        case 'monthly':
          groupKey = format(startOfMonth(date), 'yyyy-MM-dd');
          break;
        case 'daily':
        default:
          groupKey = format(date, 'yyyy-MM-dd');
          break;
      }

      const group = grouped.get(groupKey) ?? [];
      group.push(point);
      grouped.set(groupKey, group);
    });

    // Calculate average for each group
    grouped.forEach((groupPoints, dateKey) => {
      const prices = groupPoints.map((p) => safeParsePriceToNumber(p.price, 0)).filter((p) => p > 0);
      if (prices.length === 0) return; // Skip groups with no valid prices
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

      // Use the first point as template
      const template = groupPoints[0];

      aggregated.push({
        ...template,
        price: avgPrice.toFixed(2),
        recordedAt: dateKey,
      });
    });
  });

  return aggregated.sort((a, b) => {
    const dateA = typeof a.recordedAt === 'string' ? new Date(a.recordedAt) : a.recordedAt;
    const dateB = typeof b.recordedAt === 'string' ? new Date(b.recordedAt) : b.recordedAt;
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Transform price history data for Recharts consumption
 */
export function transformForChart(
  data: PriceDataPoint[],
  autoAggregate = true
): AggregatedDataPoint[] {
  if (!data || data.length === 0) return [];

  // Determine if aggregation is needed
  let processedData = data;
  if (autoAggregate) {
    const aggregationLevel = determineAggregationLevel(data.length, 365); // Assume max 365 days
    processedData = aggregatePriceData(data, aggregationLevel);
  }

  // Group by date
  const dataByDate = new Map<string, AggregatedDataPoint>();

  processedData.forEach((item) => {
    const date = typeof item.recordedAt === 'string' ? new Date(item.recordedAt) : item.recordedAt;
    const dateKey = format(date, 'yyyy-MM-dd');

    if (!dataByDate.has(dateKey)) {
      dataByDate.set(dateKey, {
        date: dateKey,
        timestamp: date.getTime(),
      });
    }

    const retailerKey = `retailer_${item.retailerId}`;
    const dateData = dataByDate.get(dateKey) ?? {
      date: dateKey,
      timestamp: date.getTime(),
    };
    const parsedPrice = safeParsePriceToNumber(item.price, -1);
    if (parsedPrice >= 0) {
      dateData[retailerKey] = parsedPrice;
      dataByDate.set(dateKey, dateData);
    }
  });

  // Convert to array and sort by date
  return Array.from(dataByDate.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Memoization cache for transformed chart data
 */
class ChartDataCache {
  private cache = new Map<string, { data: AggregatedDataPoint[]; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(data: PriceDataPoint[]): string {
    // Create a simple hash based on data length and first/last items
    if (data.length === 0) return '0';
    const first = data[0];
    const last = data[data.length - 1];
    return `${data.length}-${first.id}-${last.id}`;
  }

  get(data: PriceDataPoint[]): AggregatedDataPoint[] | null {
    const key = this.getCacheKey(data);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(data: PriceDataPoint[], transformed: AggregatedDataPoint[]): void {
    const key = this.getCacheKey(data);
    this.cache.set(key, {
      data: transformed,
      timestamp: Date.now(),
    });

    // Cleanup old entries if cache gets too large
    if (this.cache.size > 100) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0][0];
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const chartDataCache = new ChartDataCache();

/**
 * Transform data with caching
 */
export function transformForChartCached(
  data: PriceDataPoint[],
  autoAggregate = true
): AggregatedDataPoint[] {
  // Check cache first
  const cached = chartDataCache.get(data);
  if (cached) {
    return cached;
  }

  // Transform and cache
  const transformed = transformForChart(data, autoAggregate);
  chartDataCache.set(data, transformed);

  return transformed;
}

/**
 * Calculate statistics for price data
 *
 * Uses safeParsePriceToNumber for robust price parsing that handles
 * invalid values gracefully (filters them out instead of producing NaN).
 */
export function calculatePriceStats(data: PriceDataPoint[]) {
  if (data.length === 0) {
    return null;
  }

  // Filter out invalid prices (parse and exclude NaN/invalid values)
  const prices = data
    .map((item) => safeParsePriceToNumber(item.price, -1))
    .filter((price) => price >= 0);

  if (prices.length === 0) {
    log.warn('No valid prices found in data');
    return null;
  }

  const sum = prices.reduce((acc, price) => acc + price, 0);
  const avg = sum / prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  // Calculate standard deviation
  const variance = prices.reduce((acc, price) => acc + Math.pow(price - avg, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  // Calculate price change
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const change = lastPrice - firstPrice;
  const changePercent = (change / firstPrice) * 100;

  return {
    average: avg,
    minimum: min,
    maximum: max,
    standardDeviation: stdDev,
    priceChange: change,
    priceChangePercent: changePercent,
    volatility: (stdDev / avg) * 100, // Coefficient of variation
  };
}
