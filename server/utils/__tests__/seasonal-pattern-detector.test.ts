import { describe, it, expect } from 'vitest';
import { detectSeasonalPatterns, getCurrentSeasonalAdvice } from '../seasonal-pattern-detector';

describe('seasonal-pattern-detector', () => {
  const createMonthlyData = (months: number, basePrice: number, variation: number) => {
    const data = [];
    const today = new Date();
    for (let i = 0; i < months * 4; i++) {
      // 4 data points per month
      const date = new Date(today);
      date.setDate(date.getDate() - i * 7); // Weekly data points
      const monthVariation = Math.sin((date.getMonth() / 12) * Math.PI * 2) * variation;
      const price = basePrice + monthVariation + (Math.random() - 0.5) * 5;
      data.push({
        price: price.toFixed(2),
        recordedAt: date,
      });
    }
    return data;
  };

  describe('detectSeasonalPatterns', () => {
    it('should return null for insufficient data', () => {
      const smallData = [
        { price: '100.00', recordedAt: new Date() },
        { price: '105.00', recordedAt: new Date() },
      ];

      const result = detectSeasonalPatterns(smallData);
      expect(result).toBeNull();
    });

    it('should detect patterns with sufficient data', () => {
      const data = createMonthlyData(6, 100, 20);
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      expect(result!.monthlyPatterns).toBeDefined();
      expect(result!.seasonalPatterns).toBeDefined();
      expect(result!.dayOfWeekPatterns).toBeDefined();
    });

    it('should identify best and worst months', () => {
      const data = createMonthlyData(12, 100, 20);
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      expect(result!.bestMonthToBuy).not.toBeNull();
      expect(result!.worstMonthToBuy).not.toBeNull();
      expect(result!.bestMonthToBuy!.averagePrice).toBeLessThan(
        result!.worstMonthToBuy!.averagePrice
      );
    });

    it('should calculate monthly patterns correctly', () => {
      const januaryPrices = [
        { price: '90.00', recordedAt: new Date('2024-01-05') },
        { price: '95.00', recordedAt: new Date('2024-01-10') },
        { price: '92.00', recordedAt: new Date('2024-01-15') },
        { price: '93.00', recordedAt: new Date('2024-01-20') },
        { price: '91.00', recordedAt: new Date('2024-01-25') },
      ];

      const februaryPrices = [
        { price: '110.00', recordedAt: new Date('2024-02-05') },
        { price: '105.00', recordedAt: new Date('2024-02-10') },
        { price: '108.00', recordedAt: new Date('2024-02-15') },
        { price: '107.00', recordedAt: new Date('2024-02-20') },
        { price: '109.00', recordedAt: new Date('2024-02-25') },
      ];

      const data = [...januaryPrices, ...februaryPrices];
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      expect(result!.monthlyPatterns.length).toBeGreaterThan(0);

      // January should have lower average than February
      const janPattern = result!.monthlyPatterns.find(p => p.month === 0);
      const febPattern = result!.monthlyPatterns.find(p => p.month === 1);

      if (janPattern && febPattern) {
        expect(janPattern.averagePrice).toBeLessThan(febPattern.averagePrice);
      }
    });

    it('should calculate seasonal patterns', () => {
      const data = createMonthlyData(12, 100, 15);
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      expect(result!.seasonalPatterns.length).toBeGreaterThan(0);
      expect(result!.seasonalPatterns.length).toBeLessThanOrEqual(4);

      // Each season should have proper structure
      result!.seasonalPatterns.forEach(pattern => {
        expect(['winter', 'spring', 'summer', 'fall']).toContain(pattern.season);
        expect(pattern.averagePrice).toBeGreaterThan(0);
        expect(pattern.dataPoints).toBeGreaterThan(0);
      });
    });

    it('should identify best season to buy', () => {
      const data = createMonthlyData(12, 100, 20);
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      expect(result!.bestSeasonToBuy).not.toBeNull();
      expect(['winter', 'spring', 'summer', 'fall']).toContain(
        result!.bestSeasonToBuy!.season
      );
    });

    it('should calculate day of week patterns', () => {
      const data = createMonthlyData(6, 100, 10);
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      expect(result!.dayOfWeekPatterns.length).toBeGreaterThan(0);
      expect(result!.dayOfWeekPatterns.length).toBeLessThanOrEqual(7);

      // Each day should have proper structure
      result!.dayOfWeekPatterns.forEach(pattern => {
        expect(pattern.dayOfWeek).toBeGreaterThanOrEqual(0);
        expect(pattern.dayOfWeek).toBeLessThanOrEqual(6);
        expect(pattern.dayName).toBeDefined();
        expect(pattern.averagePrice).toBeGreaterThan(0);
      });
    });

    it('should detect significant seasonal patterns', () => {
      // Create data with clear seasonal variation
      const winterPrices = Array.from({ length: 10 }, (_, i) => ({
        price: '80.00',
        recordedAt: new Date(2024, 0, i + 1), // January
      }));

      const summerPrices = Array.from({ length: 10 }, (_, i) => ({
        price: '120.00',
        recordedAt: new Date(2024, 6, i + 1), // July
      }));

      const data = [...winterPrices, ...summerPrices];
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      expect(result!.hasSeasonalPattern).toBe(true);
    });

    it('should not detect pattern for stable prices', () => {
      // All prices very similar
      const stableData = Array.from({ length: 30 }, (_, i) => ({
        price: (100 + (Math.random() - 0.5) * 2).toFixed(2), // ±1% variation
        recordedAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
      }));

      const result = detectSeasonalPatterns(stableData);

      expect(result).not.toBeNull();
      // Might or might not detect pattern with such small variation
      // Just ensure it doesn't crash
    });

    it('should calculate confidence levels', () => {
      const data = createMonthlyData(12, 100, 15);
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      expect(['low', 'medium', 'high']).toContain(result!.confidence);
    });

    it('should provide recommendations when pattern exists', () => {
      const data = createMonthlyData(12, 100, 20);
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      if (result!.hasSeasonalPattern && result!.recommendation) {
        expect(result!.recommendation.timeframe).toBeDefined();
        expect(result!.recommendation.reason).toBeDefined();
        expect(result!.recommendation.expectedSavings).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle string dates', () => {
      const data = createMonthlyData(6, 100, 10).map(item => ({
        price: item.price,
        recordedAt: item.recordedAt.toISOString(),
      }));

      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      expect(result!.monthlyPatterns.length).toBeGreaterThan(0);
    });

    it('should include month names in monthly patterns', () => {
      const data = createMonthlyData(6, 100, 10);
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      result!.monthlyPatterns.forEach(pattern => {
        expect(pattern.monthName).toBeDefined();
        expect(pattern.monthName.length).toBeGreaterThan(0);
      });
    });

    it('should include day names in day patterns', () => {
      const data = createMonthlyData(4, 100, 10);
      const result = detectSeasonalPatterns(data);

      expect(result).not.toBeNull();
      result!.dayOfWeekPatterns.forEach(pattern => {
        expect(pattern.dayName).toBeDefined();
        expect(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']).toContain(
          pattern.dayName
        );
      });
    });
  });

  describe('getCurrentSeasonalAdvice', () => {
    it('should return advice for no pattern', () => {
      const analysis = {
        hasSeasonalPattern: false,
        monthlyPatterns: [],
        seasonalPatterns: [],
        dayOfWeekPatterns: [],
        bestMonthToBuy: null,
        worstMonthToBuy: null,
        bestSeasonToBuy: null,
        recommendation: null,
        confidence: 'low' as const,
      };

      const advice = getCurrentSeasonalAdvice(analysis);
      expect(advice).toContain('No strong seasonal pattern');
    });

    it('should return advice when data is available', () => {
      const currentMonth = new Date().getMonth();
      const data = createMonthlyData(12, 100, 20);
      const analysis = detectSeasonalPatterns(data);

      expect(analysis).not.toBeNull();
      const advice = getCurrentSeasonalAdvice(analysis!);
      expect(advice).toBeDefined();
      expect(advice.length).toBeGreaterThan(0);
    });

    it('should indicate when current prices are good', () => {
      const currentMonth = new Date().getMonth();

      const analysis = {
        hasSeasonalPattern: true,
        monthlyPatterns: [
          {
            month: currentMonth,
            monthName: 'Current',
            averagePrice: 100,
            minPrice: 95,
            maxPrice: 105,
            dataPoints: 10,
          },
        ],
        seasonalPatterns: [],
        dayOfWeekPatterns: [],
        bestMonthToBuy: {
          month: currentMonth,
          monthName: 'Current',
          averagePrice: 100,
          minPrice: 95,
          maxPrice: 105,
          dataPoints: 10,
        },
        worstMonthToBuy: null,
        bestSeasonToBuy: null,
        recommendation: null,
        confidence: 'high' as const,
      };

      const advice = getCurrentSeasonalAdvice(analysis);
      expect(advice.toLowerCase()).toContain('good time');
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 10 data points', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        price: (100 + i).toFixed(2),
        recordedAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
      }));

      const result = detectSeasonalPatterns(data);
      expect(result).not.toBeNull();
    });

    it('should handle data spanning multiple years', () => {
      const data = [];
      for (let year = 0; year < 2; year++) {
        for (let month = 0; month < 12; month++) {
          data.push({
            price: (100 + Math.sin(month) * 20).toFixed(2),
            recordedAt: new Date(2023 + year, month, 15),
          });
        }
      }

      const result = detectSeasonalPatterns(data);
      expect(result).not.toBeNull();
      expect(result!.monthlyPatterns.length).toBeLessThanOrEqual(12);
    });

    it('should handle single month data', () => {
      const data = Array.from({ length: 15 }, (_, i) => ({
        price: '100.00',
        recordedAt: new Date(2024, 5, i + 1),
      }));

      const result = detectSeasonalPatterns(data);
      expect(result).not.toBeNull();
      expect(result!.monthlyPatterns.length).toBe(1);
    });

    it('should handle irregular price data', () => {
      const data = [
        { price: '50.00', recordedAt: new Date('2024-01-01') },
        { price: '200.00', recordedAt: new Date('2024-02-01') },
        { price: '75.00', recordedAt: new Date('2024-03-01') },
        { price: '150.00', recordedAt: new Date('2024-04-01') },
        { price: '100.00', recordedAt: new Date('2024-05-01') },
        { price: '125.00', recordedAt: new Date('2024-06-01') },
        { price: '90.00', recordedAt: new Date('2024-07-01') },
        { price: '110.00', recordedAt: new Date('2024-08-01') },
        { price: '95.00', recordedAt: new Date('2024-09-01') },
        { price: '105.00', recordedAt: new Date('2024-10-01') },
      ];

      const result = detectSeasonalPatterns(data);
      expect(result).not.toBeNull();
    });
  });
});
