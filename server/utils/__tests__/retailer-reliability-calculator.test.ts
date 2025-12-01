import { describe, it, expect } from 'vitest';
import { calculateRetailerReliability, calculateAllRetailerReliability } from '../retailer-reliability-calculator';

describe('retailer-reliability-calculator', () => {
  const createRetailerData = (
    retailerId: number,
    retailerName: string,
    prices: number[],
    availability: string[] = []
  ) => {
    return {
      retailerId,
      retailerName,
      priceHistory: prices.map((price, i) => ({
        price: price.toFixed(2),
        recordedAt: new Date(Date.now() - (prices.length - i) * 24 * 60 * 60 * 1000),
        availability: availability[i] || 'in_stock',
      })),
    };
  };

  describe('calculateRetailerReliability', () => {
    it('should return poor rating for insufficient data', () => {
      const retailerData = createRetailerData(1, 'TestRetailer', [100]);
      const result = calculateRetailerReliability(retailerData, [retailerData]);

      expect(result.overallScore).toBe(0);
      expect(result.rating).toBe('poor');
      expect(result.weaknesses).toContain('Insufficient data for analysis');
    });

    it('should calculate excellent rating for stable, available retailer', () => {
      const stablePrices = Array(20).fill(100);
      const retailerData = createRetailerData(1, 'ReliableStore', stablePrices);
      const result = calculateRetailerReliability(retailerData, [retailerData]);

      expect(result.overallScore).toBeGreaterThanOrEqual(80);
      expect(result.rating).toBe('excellent');
      expect(result.strengths).toContain('Stable pricing');
      expect(result.strengths).toContain('Excellent stock availability');
    });

    it('should calculate price stability correctly', () => {
      // Stable prices should have high stability score
      const stableData = createRetailerData(1, 'Stable', Array(10).fill(100));
      const stableResult = calculateRetailerReliability(stableData, [stableData]);

      expect(stableResult.metrics.priceStability).toBeGreaterThan(90);

      // Volatile prices should have low stability score
      const volatileData = createRetailerData(
        2,
        'Volatile',
        [100, 150, 80, 200, 60, 180, 70, 190, 65, 175]
      );
      const volatileResult = calculateRetailerReliability(volatileData, [volatileData]);

      expect(volatileResult.metrics.priceStability).toBeLessThan(50);
    });

    it('should calculate availability correctly', () => {
      const fullyAvailable = createRetailerData(
        1,
        'AlwaysAvailable',
        [100, 100, 100, 100, 100],
        ['in_stock', 'in_stock', 'in_stock', 'in_stock', 'in_stock']
      );
      const fullResult = calculateRetailerReliability(fullyAvailable, [fullyAvailable]);

      expect(fullResult.metrics.availability).toBe(100);

      const partiallyAvailable = createRetailerData(
        2,
        'SometimesOut',
        [100, 100, 100, 100, 100],
        ['in_stock', 'out_of_stock', 'in_stock', 'out_of_stock', 'in_stock']
      );
      const partialResult = calculateRetailerReliability(partiallyAvailable, [partiallyAvailable]);

      expect(partialResult.metrics.availability).toBe(60);
    });

    it('should calculate competitiveness against market', () => {
      const cheapRetailer = createRetailerData(1, 'Cheap', [80, 85, 82]);
      const expensiveRetailer = createRetailerData(2, 'Expensive', [120, 115, 118]);
      const marketRetailer = createRetailerData(3, 'Market', [100, 100, 100]);

      const allRetailers = [cheapRetailer, expensiveRetailer, marketRetailer];

      const cheapResult = calculateRetailerReliability(cheapRetailer, allRetailers);
      const expensiveResult = calculateRetailerReliability(expensiveRetailer, allRetailers);
      const marketResult = calculateRetailerReliability(marketRetailer, allRetailers);

      expect(cheapResult.metrics.competitiveness).toBeGreaterThan(
        expensiveResult.metrics.competitiveness
      );
      expect(marketResult.metrics.competitiveness).toBeGreaterThan(
        expensiveResult.metrics.competitiveness
      );
      expect(cheapResult.metrics.competitiveness).toBeGreaterThan(70);
    });

    it('should calculate consistency correctly', () => {
      // Consistent pricing (no changes)
      const consistent = createRetailerData(1, 'Consistent', [100, 100, 100, 100, 100]);
      const consistentResult = calculateRetailerReliability(consistent, [consistent]);

      expect(consistentResult.metrics.consistency).toBeGreaterThan(90);

      // Frequent price changes
      const inconsistent = createRetailerData(2, 'Inconsistent', [100, 110, 95, 105, 98, 102, 92]);
      const inconsistentResult = calculateRetailerReliability(inconsistent, [inconsistent]);

      expect(inconsistentResult.metrics.consistency).toBeLessThan(
        consistentResult.metrics.consistency
      );
    });

    it('should identify strengths correctly', () => {
      const retailerData = createRetailerData(
        1,
        'GoodRetailer',
        Array(15).fill(95) // Stable and competitive pricing
      );
      const allRetailers = [
        retailerData,
        createRetailerData(2, 'Other', Array(15).fill(105)),
      ];

      const result = calculateRetailerReliability(retailerData, allRetailers);

      expect(result.strengths).toContain('Stable pricing');
      expect(result.strengths).toContain('Excellent stock availability');
      expect(result.strengths).toContain('Competitive prices');
    });

    it('should identify weaknesses correctly', () => {
      const volatileRetailer = createRetailerData(
        1,
        'Volatile',
        [100, 150, 80, 200, 60], // Volatile prices
        ['in_stock', 'out_of_stock', 'out_of_stock', 'in_stock', 'out_of_stock'] // Poor availability
      );
      const result = calculateRetailerReliability(volatileRetailer, [volatileRetailer]);

      expect(result.weaknesses.length).toBeGreaterThan(0);
      expect(result.weaknesses.some(w => w.includes('stock') || w.includes('pricing'))).toBe(true);
    });

    it('should assign correct rating based on score', () => {
      // Create retailers with different characteristics
      const excellentData = createRetailerData(1, 'Excellent', Array(10).fill(100));
      const excellentResult = calculateRetailerReliability(excellentData, [excellentData]);
      expect(excellentResult.rating).toBe('excellent');
      expect(excellentResult.overallScore).toBeGreaterThanOrEqual(80);

      const poorData = createRetailerData(
        2,
        'Poor',
        [100, 150, 80, 200, 60],
        ['out_of_stock', 'out_of_stock', 'in_stock', 'out_of_stock', 'out_of_stock']
      );
      const poorResult = calculateRetailerReliability(poorData, [poorData]);
      expect(['poor', 'fair']).toContain(poorResult.rating);
    });

    it('should generate appropriate recommendations', () => {
      const excellentData = createRetailerData(1, 'Excellent', Array(10).fill(100));
      const excellentResult = calculateRetailerReliability(excellentData, [excellentData]);

      expect(excellentResult.recommendation).toContain('Highly reliable');
      expect(excellentResult.recommendation.length).toBeGreaterThan(0);

      const poorData = createRetailerData(
        2,
        'Poor',
        [100, 150, 80, 200],
        ['out_of_stock', 'out_of_stock', 'in_stock', 'out_of_stock']
      );
      const poorResult = calculateRetailerReliability(poorData, [poorData]);

      expect(poorResult.recommendation).toBeDefined();
      expect(poorResult.recommendation.length).toBeGreaterThan(0);
    });

    it('should handle single retailer comparison', () => {
      const singleRetailer = createRetailerData(1, 'OnlyOne', [100, 105, 102, 98]);
      const result = calculateRetailerReliability(singleRetailer, [singleRetailer]);

      expect(result.metrics.competitiveness).toBe(50); // Neutral when no comparison
      expect(result.overallScore).toBeGreaterThan(0);
    });
  });

  describe('calculateAllRetailerReliability', () => {
    it('should calculate scores for all retailers', () => {
      const retailer1 = createRetailerData(1, 'Retailer1', [95, 98, 96, 97]);
      const retailer2 = createRetailerData(2, 'Retailer2', [105, 108, 106, 107]);
      const retailer3 = createRetailerData(3, 'Retailer3', [100, 102, 101, 99]);

      const results = calculateAllRetailerReliability([retailer1, retailer2, retailer3]);

      expect(results).toHaveLength(3);
      expect(results[0].retailerId).toBe(1);
      expect(results[1].retailerId).toBe(2);
      expect(results[2].retailerId).toBe(3);
    });

    it('should maintain relative competitiveness across retailers', () => {
      const cheapest = createRetailerData(1, 'Cheapest', [80, 82, 81, 83]);
      const moderate = createRetailerData(2, 'Moderate', [100, 102, 101, 99]);
      const expensive = createRetailerData(3, 'Expensive', [120, 122, 121, 123]);

      const results = calculateAllRetailerReliability([cheapest, moderate, expensive]);

      const cheapestScore = results.find(r => r.retailerId === 1)!.metrics.competitiveness;
      const moderateScore = results.find(r => r.retailerId === 2)!.metrics.competitiveness;
      const expensiveScore = results.find(r => r.retailerId === 3)!.metrics.competitiveness;

      expect(cheapestScore).toBeGreaterThan(moderateScore);
      expect(moderateScore).toBeGreaterThan(expensiveScore);
    });

    it('should handle empty array', () => {
      const results = calculateAllRetailerReliability([]);
      expect(results).toHaveLength(0);
    });

    it('should handle mix of good and poor retailers', () => {
      const good = createRetailerData(1, 'Good', Array(10).fill(95));
      const poor = createRetailerData(
        2,
        'Poor',
        [100, 150, 80, 200],
        ['out_of_stock', 'out_of_stock', 'in_stock', 'out_of_stock']
      );

      const results = calculateAllRetailerReliability([good, poor]);

      const goodResult = results.find(r => r.retailerId === 1)!;
      const poorResult = results.find(r => r.retailerId === 2)!;

      expect(goodResult.overallScore).toBeGreaterThan(poorResult.overallScore);
      expect(goodResult.rating).not.toBe(poorResult.rating);
    });
  });

  describe('Edge Cases', () => {
    it('should handle retailer with two data points', () => {
      const minimal = createRetailerData(1, 'Minimal', [100, 100]);
      const result = calculateRetailerReliability(minimal, [minimal]);

      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.rating).toBeDefined();
    });

    it('should handle extreme price volatility', () => {
      const extreme = createRetailerData(1, 'Extreme', [10, 1000, 5, 500, 15]);
      const result = calculateRetailerReliability(extreme, [extreme]);

      expect(result.metrics.priceStability).toBeLessThan(30);
      expect(result.weaknesses).toContain('Volatile pricing');
    });

    it('should handle all out of stock', () => {
      const outOfStock = createRetailerData(
        1,
        'OutOfStock',
        [100, 100, 100],
        ['out_of_stock', 'out_of_stock', 'out_of_stock']
      );
      const result = calculateRetailerReliability(outOfStock, [outOfStock]);

      expect(result.metrics.availability).toBe(0);
      expect(result.weaknesses).toContain('Frequent stock issues');
    });

    it('should handle prices with small decimal variations', () => {
      const smallVariations = createRetailerData(
        1,
        'SmallVar',
        [100.01, 100.02, 100.00, 100.01, 100.02]
      );
      const result = calculateRetailerReliability(smallVariations, [smallVariations]);

      expect(result.metrics.priceStability).toBeGreaterThan(95);
      expect(result.metrics.consistency).toBeGreaterThan(95);
    });
  });
});
