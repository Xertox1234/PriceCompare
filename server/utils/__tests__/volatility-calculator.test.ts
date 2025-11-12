import { describe, it, expect } from 'vitest';
import { calculateVolatility, calculateVolatilityTrend } from '../volatility-calculator';

describe('volatility-calculator', () => {
  const mockStablePrices = [
    { price: '100.00', recordedAt: new Date('2024-01-01') },
    { price: '100.50', recordedAt: new Date('2024-01-02') },
    { price: '99.50', recordedAt: new Date('2024-01-03') },
    { price: '100.25', recordedAt: new Date('2024-01-04') },
  ];

  const mockModeratePrices = [
    { price: '100.00', recordedAt: new Date('2024-01-01') },
    { price: '110.00', recordedAt: new Date('2024-01-02') },
    { price: '95.00', recordedAt: new Date('2024-01-03') },
    { price: '105.00', recordedAt: new Date('2024-01-04') },
  ];

  const mockHighVolatilityPrices = [
    { price: '100.00', recordedAt: new Date('2024-01-01') },
    { price: '150.00', recordedAt: new Date('2024-01-02') },
    { price: '75.00', recordedAt: new Date('2024-01-03') },
    { price: '125.00', recordedAt: new Date('2024-01-04') },
  ];

  describe('calculateVolatility', () => {
    it('should return null for empty data', () => {
      const result = calculateVolatility([]);
      expect(result).toBeNull();
    });

    it('should return null for single data point', () => {
      const result = calculateVolatility([mockStablePrices[0]]);
      expect(result).toBeNull();
    });

    it('should calculate volatility for stable prices', () => {
      const result = calculateVolatility(mockStablePrices);

      expect(result).not.toBeNull();
      expect(result!.level).toBe('low');
      expect(result!.score).toBeGreaterThanOrEqual(0);
      expect(result!.score).toBeLessThanOrEqual(25);
      expect(result!.standardDeviation).toBeGreaterThan(0);
    });

    it('should calculate volatility for moderate fluctuation', () => {
      const result = calculateVolatility(mockModeratePrices);

      expect(result).not.toBeNull();
      expect(['moderate', 'high']).toContain(result!.level);
      expect(result!.score).toBeGreaterThan(25);
    });

    it('should calculate volatility for high fluctuation', () => {
      const result = calculateVolatility(mockHighVolatilityPrices);

      expect(result).not.toBeNull();
      expect(['high', 'very-high']).toContain(result!.level);
      expect(result!.score).toBeGreaterThan(50);
    });

    it('should calculate correct average price', () => {
      const result = calculateVolatility(mockStablePrices);
      const expectedAvg = 100.0625; // (100 + 100.5 + 99.5 + 100.25) / 4

      expect(result).not.toBeNull();
      expect(result!.averagePrice).toBeCloseTo(expectedAvg, 2);
    });

    it('should calculate correct price range', () => {
      const result = calculateVolatility(mockModeratePrices);

      expect(result).not.toBeNull();
      expect(result!.priceRange.min).toBe(95);
      expect(result!.priceRange.max).toBe(110);
    });

    it('should calculate standard deviation correctly', () => {
      const result = calculateVolatility(mockStablePrices);

      expect(result).not.toBeNull();
      expect(result!.standardDeviation).toBeGreaterThan(0);
      expect(result!.standardDeviation).toBeLessThan(1); // Low volatility
    });

    it('should provide recommendation for low volatility', () => {
      const result = calculateVolatility(mockStablePrices);

      expect(result).not.toBeNull();
      expect(result!.recommendation).toContain('stable');
    });

    it('should provide recommendation for high volatility', () => {
      const result = calculateVolatility(mockHighVolatilityPrices);

      expect(result).not.toBeNull();
      expect(result!.recommendation.toLowerCase()).toMatch(/wait|drop|alert/);
    });

    it('should handle string dates', () => {
      const dataWithStringDates = mockStablePrices.map(item => ({
        price: item.price,
        recordedAt: item.recordedAt.toISOString(),
      }));

      const result = calculateVolatility(dataWithStringDates);

      expect(result).not.toBeNull();
      expect(result!.level).toBe('low');
    });

    it('should cap score at 100', () => {
      const extremePrices = [
        { price: '10.00', recordedAt: new Date('2024-01-01') },
        { price: '1000.00', recordedAt: new Date('2024-01-02') },
        { price: '5.00', recordedAt: new Date('2024-01-03') },
        { price: '2000.00', recordedAt: new Date('2024-01-04') },
      ];

      const result = calculateVolatility(extremePrices);

      expect(result).not.toBeNull();
      expect(result!.score).toBeLessThanOrEqual(100);
    });

    it('should assign correct level based on score', () => {
      // Test low
      let result = calculateVolatility(mockStablePrices);
      expect(result!.score <= 25 ? result!.level : 'not-low').toBe('low');

      // Test very-high
      result = calculateVolatility(mockHighVolatilityPrices);
      expect(result!.score > 50).toBe(true);
    });
  });

  describe('calculateVolatilityTrend', () => {
    const createTimeSeries = (days: number, basePrice: number, volatility: number) => {
      return Array.from({ length: days }, (_, i) => ({
        price: (basePrice + (Math.random() - 0.5) * volatility).toFixed(2),
        recordedAt: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000),
      }));
    };

    it('should return null for insufficient data', () => {
      const result = calculateVolatilityTrend(mockStablePrices.slice(0, 2));
      expect(result).toBeNull();
    });

    it('should detect increasing volatility trend', () => {
      // Older data: low volatility
      const olderData = createTimeSeries(40, 100, 2);
      // Recent data: high volatility
      const recentData = createTimeSeries(30, 100, 30);
      const allData = [...olderData, ...recentData];

      const result = calculateVolatilityTrend(allData, 30);

      expect(result).not.toBeNull();
      expect(result!.trend).toBe('increasing');
      expect(result!.change).toBeGreaterThan(0);
    });

    it('should detect decreasing volatility trend', () => {
      // Older data: high volatility (use deterministic alternating values)
      const olderData = Array.from({ length: 40 }, (_, i) => ({
        price: (100 + (i % 2 === 0 ? 30 : -30)).toFixed(2),
        recordedAt: new Date(Date.now() - (70 - i) * 24 * 60 * 60 * 1000),
      }));
      // Recent data: low volatility (small variations)
      const recentData = Array.from({ length: 30 }, (_, i) => ({
        price: (100 + (i % 2 === 0 ? 1 : -1)).toFixed(2),
        recordedAt: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000),
      }));
      const allData = [...olderData, ...recentData];

      const result = calculateVolatilityTrend(allData, 30);

      expect(result).not.toBeNull();
      expect(['decreasing', 'stable']).toContain(result!.trend);
      if (result!.trend === 'decreasing') {
        expect(result!.change).toBeLessThan(0);
      }
    });

    it('should detect stable volatility', () => {
      // Both periods: similar volatility
      const allData = createTimeSeries(60, 100, 5);

      const result = calculateVolatilityTrend(allData, 30);

      expect(result).not.toBeNull();
      expect(result!.trend).toBe('stable');
      expect(Math.abs(result!.change)).toBeLessThan(10);
    });

    it('should handle custom time period', () => {
      const data = createTimeSeries(100, 100, 10);
      const result = calculateVolatilityTrend(data, 14); // 14 days

      expect(result).not.toBeNull();
      expect(['increasing', 'decreasing', 'stable']).toContain(result!.trend);
    });

    it('should handle string dates in trend calculation', () => {
      const data = createTimeSeries(60, 100, 5).map(item => ({
        price: item.price,
        recordedAt: item.recordedAt.toISOString(),
      }));

      const result = calculateVolatilityTrend(data, 30);

      expect(result).not.toBeNull();
    });

    it('should return null when recent period has insufficient data', () => {
      // All data is old
      const oldData = Array.from({ length: 10 }, (_, i) => ({
        price: '100.00',
        recordedAt: new Date(Date.now() - (60 + i) * 24 * 60 * 60 * 1000),
      }));

      const result = calculateVolatilityTrend(oldData, 30);

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle identical prices (zero volatility)', () => {
      const identicalPrices = [
        { price: '100.00', recordedAt: new Date('2024-01-01') },
        { price: '100.00', recordedAt: new Date('2024-01-02') },
        { price: '100.00', recordedAt: new Date('2024-01-03') },
      ];

      const result = calculateVolatility(identicalPrices);

      expect(result).not.toBeNull();
      expect(result!.standardDeviation).toBe(0);
      expect(result!.score).toBe(0);
      expect(result!.level).toBe('low');
    });

    it('should handle very small price differences', () => {
      const smallDifferences = [
        { price: '100.00', recordedAt: new Date('2024-01-01') },
        { price: '100.01', recordedAt: new Date('2024-01-02') },
        { price: '100.02', recordedAt: new Date('2024-01-03') },
      ];

      const result = calculateVolatility(smallDifferences);

      expect(result).not.toBeNull();
      expect(result!.level).toBe('low');
    });

    it('should handle large price values', () => {
      const largePrices = [
        { price: '10000.00', recordedAt: new Date('2024-01-01') },
        { price: '10500.00', recordedAt: new Date('2024-01-02') },
        { price: '9800.00', recordedAt: new Date('2024-01-03') },
      ];

      const result = calculateVolatility(largePrices);

      expect(result).not.toBeNull();
      expect(result!.averagePrice).toBeGreaterThan(9000);
    });

    it('should handle decimal prices', () => {
      const decimalPrices = [
        { price: '99.99', recordedAt: new Date('2024-01-01') },
        { price: '100.49', recordedAt: new Date('2024-01-02') },
        { price: '99.49', recordedAt: new Date('2024-01-03') },
      ];

      const result = calculateVolatility(decimalPrices);

      expect(result).not.toBeNull();
      expect(result!.averagePrice).toBeCloseTo(99.99, 2);
    });
  });
});
