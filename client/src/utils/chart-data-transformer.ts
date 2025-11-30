import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";

export interface PriceDataPoint {
  id: number;
  productId: number;
  retailerId: number;
  retailerName: string;
  retailerLogo: string | null;
  price: string;
  recordedAt: Date | string;
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
    if (!retailerGroups.has(point.retailerId)) {
      retailerGroups.set(point.retailerId, []);
    }
    retailerGroups.get(point.retailerId)!.push(point);
  });

  // Aggregate each retailer's data
  const aggregated: PriceDataPoint[] = [];

  retailerGroups.forEach((points, _retailerId) => {
    const grouped = new Map<string, PriceDataPoint[]>();

    points.forEach((point) => {
      const date = typeof point.recordedAt === 'string'
        ? parseISO(point.recordedAt)
        : point.recordedAt;

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

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(point);
    });

    // Calculate average for each group
    grouped.forEach((groupPoints, dateKey) => {
      const prices = groupPoints.map((p) => parseFloat(p.price));
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
    const date = typeof item.recordedAt === 'string'
      ? new Date(item.recordedAt)
      : item.recordedAt;
    const dateKey = format(date, "yyyy-MM-dd");

    if (!dataByDate.has(dateKey)) {
      dataByDate.set(dateKey, {
        date: dateKey,
        timestamp: date.getTime(),
      });
    }

    const retailerKey = `retailer_${item.retailerId}`;
    dataByDate.get(dateKey)![retailerKey] = parseFloat(item.price);
  });

  // Convert to array and sort by date
  return Array.from(dataByDate.values())
    .sort((a, b) => a.timestamp - b.timestamp);
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
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
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
 */
export function calculatePriceStats(data: PriceDataPoint[]) {
  if (data.length === 0) {
    return null;
  }

  const prices = data.map((item) => parseFloat(item.price));
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
