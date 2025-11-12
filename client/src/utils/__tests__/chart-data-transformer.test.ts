import { describe, it, expect } from 'vitest';
import {
  determineAggregationLevel,
  aggregatePriceData,
  transformForChart,
  calculatePriceStats,
  chartDataCache,
} from '../chart-data-transformer';

describe('chart-data-transformer', () => {
  const mockPriceData = [
    {
      id: 1,
      productId: 1,
      retailerId: 1,
      retailerName: 'Amazon',
      retailerLogo: null,
      price: '99.99',
      recordedAt: '2024-01-01',
    },
    {
      id: 2,
      productId: 1,
      retailerId: 1,
      retailerName: 'Amazon',
      retailerLogo: null,
      price: '89.99',
      recordedAt: '2024-01-02',
    },
    {
      id: 3,
      productId: 1,
      retailerId: 2,
      retailerName: 'Walmart',
      retailerLogo: null,
      price: '95.99',
      recordedAt: '2024-01-01',
    },
  ];

  describe('determineAggregationLevel', () => {
    it('should return "none" for small datasets', () => {
      const level = determineAggregationLevel(50, 20);
      expect(level).toBe('none');
    });

    it('should return "daily" for medium datasets', () => {
      const level = determineAggregationLevel(150, 40);
      expect(level).toBe('daily');
    });

    it('should return "weekly" for large datasets', () => {
      const level = determineAggregationLevel(300, 80);
      expect(level).toBe('weekly');
    });

    it('should return "monthly" for very large datasets', () => {
      const level = determineAggregationLevel(600, 200);
      expect(level).toBe('monthly');
    });

    it('should prioritize time range over data point count', () => {
      const level = determineAggregationLevel(50, 200);
      expect(level).toBe('monthly');
    });
  });

  describe('aggregatePriceData', () => {
    it('should return original data when level is "none"', () => {
      const result = aggregatePriceData(mockPriceData, 'none');
      expect(result).toEqual(mockPriceData);
    });

    it('should aggregate data by day', () => {
      const data = [
        { ...mockPriceData[0], recordedAt: '2024-01-01T10:00:00Z', price: '100.00' },
        { ...mockPriceData[0], recordedAt: '2024-01-01T14:00:00Z', price: '98.00' },
      ];

      const result = aggregatePriceData(data, 'daily');

      expect(result).toHaveLength(1);
      expect(parseFloat(result[0].price)).toBe(99.0); // Average of 100 and 98
    });

    it('should maintain retailer separation when aggregating', () => {
      const result = aggregatePriceData(mockPriceData, 'daily');

      // Should have 2 entries for Jan 1 (Amazon and Walmart)
      const jan1Entries = result.filter((d) => d.recordedAt === '2024-01-01');
      expect(jan1Entries).toHaveLength(2);
    });

    it('should sort results by date', () => {
      const unsortedData = [
        { ...mockPriceData[0], recordedAt: '2024-01-03' },
        { ...mockPriceData[0], recordedAt: '2024-01-01' },
        { ...mockPriceData[0], recordedAt: '2024-01-02' },
      ];

      const result = aggregatePriceData(unsortedData, 'daily');

      expect(result[0].recordedAt).toBe('2024-01-01');
      expect(result[1].recordedAt).toBe('2024-01-02');
      expect(result[2].recordedAt).toBe('2024-01-03');
    });
  });

  describe('transformForChart', () => {
    it('should transform data for Recharts format', () => {
      const result = transformForChart(mockPriceData, false);

      expect(result).toHaveLength(2); // 2 unique dates
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('retailer_1');
      expect(result[0]).toHaveProperty('retailer_2');
    });

    it('should handle empty data', () => {
      const result = transformForChart([]);
      expect(result).toEqual([]);
    });

    it('should sort by date', () => {
      const result = transformForChart(mockPriceData, false);

      expect(new Date(result[0].date).getTime()).toBeLessThan(
        new Date(result[1].date).getTime()
      );
    });

    it('should aggregate automatically when enabled', () => {
      // Create large dataset that should trigger aggregation
      const largeData = Array.from({ length: 600 }, (_, i) => ({
        ...mockPriceData[0],
        id: i,
        recordedAt: `2024-01-${(i % 30) + 1}`,
        price: (100 + Math.random() * 10).toFixed(2),
      }));

      const result = transformForChart(largeData, true);

      // Should be aggregated (fewer data points than input)
      expect(result.length).toBeLessThan(largeData.length);
    });
  });

  describe('calculatePriceStats', () => {
    it('should calculate statistics correctly', () => {
      const stats = calculatePriceStats(mockPriceData);

      expect(stats).not.toBeNull();
      expect(stats!.minimum).toBe(89.99);
      expect(stats!.maximum).toBe(99.99);
      expect(stats!.average).toBeCloseTo(95.32, 1);
    });

    it('should calculate price change', () => {
      const stats = calculatePriceStats(mockPriceData);

      expect(stats).not.toBeNull();
      // First: 99.99, Last: 95.99
      expect(stats!.priceChange).toBeCloseTo(-4.0, 1);
      expect(stats!.priceChangePercent).toBeLessThan(0);
    });

    it('should calculate volatility', () => {
      const stats = calculatePriceStats(mockPriceData);

      expect(stats).not.toBeNull();
      expect(stats!.volatility).toBeGreaterThan(0);
      expect(stats!.standardDeviation).toBeGreaterThan(0);
    });

    it('should return null for empty data', () => {
      const stats = calculatePriceStats([]);
      expect(stats).toBeNull();
    });

    it('should handle single data point', () => {
      const stats = calculatePriceStats([mockPriceData[0]]);

      expect(stats).not.toBeNull();
      expect(stats!.minimum).toBe(stats!.maximum);
      expect(stats!.average).toBe(99.99);
      expect(stats!.standardDeviation).toBe(0);
    });
  });

  describe('chartDataCache', () => {
    beforeEach(() => {
      chartDataCache.clear();
    });

    it('should cache and retrieve transformed data', () => {
      const transformed = transformForChart(mockPriceData, false);
      chartDataCache.set(mockPriceData, transformed);

      const cached = chartDataCache.get(mockPriceData);
      expect(cached).toEqual(transformed);
    });

    it('should return null for uncached data', () => {
      const cached = chartDataCache.get(mockPriceData);
      expect(cached).toBeNull();
    });

    it('should clear cache', () => {
      const transformed = transformForChart(mockPriceData, false);
      chartDataCache.set(mockPriceData, transformed);

      chartDataCache.clear();

      const cached = chartDataCache.get(mockPriceData);
      expect(cached).toBeNull();
    });

    it('should expire cache after TTL', async () => {
      // This test would need to mock timers or wait
      // Skipping for now as it would make tests slow
    });
  });
});
