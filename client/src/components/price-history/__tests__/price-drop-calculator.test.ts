import { describe, it, expect } from 'vitest';
import {
  calculatePriceDropAnnotations,
  calculateHistoricalContext,
  type PriceHistoryData,
} from '../price-drop-calculator';

describe('calculatePriceDropAnnotations', () => {
  const createMockData = (overrides: Partial<PriceHistoryData>): PriceHistoryData => ({
    id: 1,
    productId: 1,
    retailerId: 1,
    retailerName: 'Amazon',
    retailerLogo: null,
    price: '100.00',
    recordedAt: new Date('2024-01-01'),
    ...overrides,
  });

  it('detects price drops greater than 15%', () => {
    const data: PriceHistoryData[] = [
      createMockData({ id: 1, price: '100.00', recordedAt: '2024-01-01T12:00:00Z' }),
      createMockData({ id: 2, price: '80.00', recordedAt: '2024-01-05T12:00:00Z' }), // 20% drop
    ];

    const drops = calculatePriceDropAnnotations(data);

    expect(drops).toHaveLength(1);
    expect(drops[0].retailerId).toBe(1);
    expect(drops[0].retailerName).toBe('Amazon');
    expect(drops[0].drop).toBeCloseTo(20, 1);
    expect(drops[0].date).toBe('2024-01-05');
  });

  it('does not flag price drops under 15%', () => {
    const data: PriceHistoryData[] = [
      createMockData({ price: '100.00', recordedAt: new Date('2024-01-01') }),
      createMockData({ price: '90.00', recordedAt: new Date('2024-01-02') }), // 10% drop
    ];

    const drops = calculatePriceDropAnnotations(data);

    expect(drops).toHaveLength(0);
  });

  it('handles multiple retailers independently', () => {
    const data: PriceHistoryData[] = [
      createMockData({
        id: 1,
        retailerId: 1,
        retailerName: 'Amazon',
        price: '100.00',
        recordedAt: new Date('2024-01-01'),
      }),
      createMockData({
        id: 2,
        retailerId: 1,
        retailerName: 'Amazon',
        price: '80.00',
        recordedAt: new Date('2024-01-05'),
      }), // 20% drop
      createMockData({
        id: 3,
        retailerId: 2,
        retailerName: 'Walmart',
        price: '95.00',
        recordedAt: new Date('2024-01-01'),
      }),
      createMockData({
        id: 4,
        retailerId: 2,
        retailerName: 'Walmart',
        price: '75.00',
        recordedAt: new Date('2024-01-03'),
      }), // 21% drop
    ];

    const drops = calculatePriceDropAnnotations(data);

    expect(drops).toHaveLength(2);
    expect(drops.find((d) => d.retailerId === 1)?.drop).toBeCloseTo(20, 1);
    expect(drops.find((d) => d.retailerId === 2)?.drop).toBeCloseTo(21.05, 1);
  });

  it('handles empty data gracefully', () => {
    const drops = calculatePriceDropAnnotations([]);
    expect(drops).toEqual([]);
  });

  it('handles single data point without errors', () => {
    const data = [createMockData({ price: '100.00' })];
    const drops = calculatePriceDropAnnotations(data);
    expect(drops).toEqual([]);
  });

  it('does not flag price increases', () => {
    const data: PriceHistoryData[] = [
      createMockData({ price: '50.00', recordedAt: new Date('2024-01-01') }),
      createMockData({ price: '100.00', recordedAt: new Date('2024-01-02') }), // 100% increase
    ];

    const drops = calculatePriceDropAnnotations(data);
    expect(drops).toEqual([]);
  });

  it('detects multiple drops for same retailer', () => {
    const data: PriceHistoryData[] = [
      createMockData({ price: '100.00', recordedAt: new Date('2024-01-01') }),
      createMockData({ price: '80.00', recordedAt: new Date('2024-01-02') }), // 20% drop
      createMockData({ price: '60.00', recordedAt: new Date('2024-01-03') }), // 25% drop
    ];

    const drops = calculatePriceDropAnnotations(data);

    expect(drops).toHaveLength(2);
    expect(drops[0].drop).toBeCloseTo(20, 1);
    expect(drops[1].drop).toBeCloseTo(25, 1);
  });

  it('respects custom drop threshold', () => {
    const data: PriceHistoryData[] = [
      createMockData({ price: '100.00', recordedAt: new Date('2024-01-01') }),
      createMockData({ price: '90.00', recordedAt: new Date('2024-01-02') }), // 10% drop
    ];

    const dropsDefault = calculatePriceDropAnnotations(data); // 15% threshold
    const dropsCustom = calculatePriceDropAnnotations(data, 5); // 5% threshold

    expect(dropsDefault).toHaveLength(0); // 10% < 15%
    expect(dropsCustom).toHaveLength(1); // 10% > 5%
  });

  it('handles string dates correctly', () => {
    const data: PriceHistoryData[] = [
      createMockData({ price: '100.00', recordedAt: '2024-01-01T12:00:00Z' }),
      createMockData({ price: '80.00', recordedAt: '2024-01-05T12:00:00Z' }), // 20% drop
    ];

    const drops = calculatePriceDropAnnotations(data);

    expect(drops).toHaveLength(1);
    expect(drops[0].date).toBe('2024-01-05');
  });

  it('formats dates as yyyy-MM-dd', () => {
    const data: PriceHistoryData[] = [
      createMockData({ price: '100.00', recordedAt: '2024-01-01T12:00:00Z' }),
      createMockData({ price: '80.00', recordedAt: '2024-01-05T12:00:00Z' }),
    ];

    const drops = calculatePriceDropAnnotations(data);

    expect(drops[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(drops[0].date).toBe('2024-01-05');
  });
});

describe('calculateHistoricalContext', () => {
  const createMockData = (price: string): PriceHistoryData => ({
    id: 1,
    productId: 1,
    retailerId: 1,
    retailerName: 'Amazon',
    retailerLogo: null,
    price,
    recordedAt: new Date('2024-01-01'),
  });

  it('calculates average, lowest, and highest prices', () => {
    const data: PriceHistoryData[] = [
      createMockData('50.00'),
      createMockData('100.00'),
      createMockData('75.00'),
    ];

    const context = calculateHistoricalContext(data);

    expect(context).toBeDefined();
    expect(context?.averagePrice).toBeCloseTo(75, 2);
    expect(context?.lowestPrice).toBe(50);
    expect(context?.highestPrice).toBe(100);
  });

  it('returns undefined for empty data', () => {
    const context = calculateHistoricalContext([]);
    expect(context).toBeUndefined();
  });

  it('handles single data point', () => {
    const data = [createMockData('99.99')];
    const context = calculateHistoricalContext(data);

    expect(context).toBeDefined();
    expect(context?.averagePrice).toBeCloseTo(99.99, 2);
    expect(context?.lowestPrice).toBeCloseTo(99.99, 2);
    expect(context?.highestPrice).toBeCloseTo(99.99, 2);
  });
});
