/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle query builder mocks require complex chain typing */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPriceHistoryOptimized } from '../price-history-service';
import { db } from '../../db';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('getPriceHistoryOptimized - Strategy Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Strategy 1: 0-30 days - Raw data only', () => {
    it('should use raw data for 0-30 days', async () => {
      const productId = 1;
      const days = 15; // Within 30 days

      const mockRawData = [
        {
          history: {
            recordedAt: new Date('2024-03-01'),
            price: '99.99',
            retailerId: 1,
            availability: 'in_stock',
          },
          retailer: {
            name: 'Amazon',
          },
        },
      ];

      // Mock raw data query
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockRawData),
            }),
          }),
        }),
      } as any);

      const result = await getPriceHistoryOptimized(productId, days);

      // Should return raw data format
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        source: 'raw',
        price: 99.99,
        retailerId: 1,
        retailerName: 'Amazon',
      });
    });

    it('should NOT use aggregates for 0-30 days', async () => {
      const productId = 1;
      const days = 30;

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      await getPriceHistoryOptimized(productId, days);

      // Should only query once (for raw data)
      expect(db.select).toHaveBeenCalledTimes(1);
    });
  });

  describe('Strategy 2: 30-90 days - Daily aggregates + raw', () => {
    it('should use daily aggregates + raw data for 30-90 days', async () => {
      const productId = 1;
      const days = 60; // Between 30 and 90

      const mockRawData = [
        {
          history: {
            recordedAt: new Date('2024-03-01'),
            price: '99.99',
            retailerId: 1,
            availability: 'in_stock',
          },
          retailer: { name: 'Amazon' },
        },
      ];

      const mockDailyData = [
        {
          agg: {
            date: '2024-02-01',
            avgPrice: '95.00',
            minPrice: '90.00',
            maxPrice: '100.00',
            medianPrice: '95.00',
            retailerId: 1,
          },
          retailer: { name: 'Amazon' },
        },
      ];

      // Mock queries
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockRawData),
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockDailyData),
              }),
            }),
          }),
        } as any);

      const result = await getPriceHistoryOptimized(productId, days);

      // Should return both raw and daily data
      expect(result.some((r) => r.source === 'raw')).toBe(true);
      expect(result.some((r) => r.source === 'daily')).toBe(true);
    });

    it('should query twice (raw + daily) for 30-90 days', async () => {
      const productId = 1;
      const days = 45;

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      await getPriceHistoryOptimized(productId, days);

      // Should query twice: raw + daily
      expect(db.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('Strategy 3: 90-365 days - Weekly + daily + raw', () => {
    it('should use weekly aggregates + daily + raw for 90-365 days', async () => {
      const productId = 1;
      const days = 180; // Between 90 and 365

      const mockRawData = [
        {
          history: {
            recordedAt: new Date('2024-03-01'),
            price: '99.99',
            retailerId: 1,
            availability: 'in_stock',
          },
          retailer: { name: 'Amazon' },
        },
      ];

      const mockDailyData = [
        {
          agg: {
            date: '2024-02-15',
            avgPrice: '95.00',
            minPrice: '90.00',
            maxPrice: '100.00',
            medianPrice: '95.00',
            retailerId: 1,
          },
          retailer: { name: 'Amazon' },
        },
      ];

      const mockWeeklyData = [
        {
          agg: {
            year: 2024,
            week: 1,
            avgPrice: '90.00',
            minPrice: '85.00',
            maxPrice: '95.00',
            medianPrice: '90.00',
            retailerId: 1,
          },
          retailer: { name: 'Amazon' },
        },
      ];

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockRawData),
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockDailyData),
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockWeeklyData),
              }),
            }),
          }),
        } as any);

      const result = await getPriceHistoryOptimized(productId, days);

      // Should return raw, daily, and weekly data
      expect(result.some((r) => r.source === 'raw')).toBe(true);
      expect(result.some((r) => r.source === 'daily')).toBe(true);
      expect(result.some((r) => r.source === 'weekly')).toBe(true);
    });

    it('should query three times (raw + daily + weekly) for 90-365 days', async () => {
      const productId = 1;
      const days = 200;

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      await getPriceHistoryOptimized(productId, days);

      // Should query three times: raw + daily + weekly
      expect(db.select).toHaveBeenCalledTimes(3);
    });
  });

  describe('Strategy 4: 1+ years - Monthly + weekly + daily + raw', () => {
    it('should use monthly aggregates + weekly + daily + raw for 1+ years', async () => {
      const productId = 1;
      const days = 500; // Over 1 year

      const mockRawData = [
        {
          history: {
            recordedAt: new Date('2024-03-01'),
            price: '99.99',
            retailerId: 1,
            availability: 'in_stock',
          },
          retailer: { name: 'Amazon' },
        },
      ];

      const mockDailyData = [
        {
          agg: {
            date: '2024-02-15',
            avgPrice: '95.00',
            minPrice: '90.00',
            maxPrice: '100.00',
            medianPrice: '95.00',
            retailerId: 1,
          },
          retailer: { name: 'Amazon' },
        },
      ];

      const mockWeeklyData = [
        {
          agg: {
            year: 2024,
            week: 1,
            avgPrice: '90.00',
            minPrice: '85.00',
            maxPrice: '95.00',
            medianPrice: '90.00',
            retailerId: 1,
          },
          retailer: { name: 'Amazon' },
        },
      ];

      const mockMonthlyData = [
        {
          agg: {
            year: 2023,
            month: 1,
            avgPrice: '85.00',
            minPrice: '80.00',
            maxPrice: '90.00',
            medianPrice: '85.00',
            retailerId: 1,
          },
          retailer: { name: 'Amazon' },
        },
      ];

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockRawData),
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockDailyData),
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockWeeklyData),
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockMonthlyData),
              }),
            }),
          }),
        } as any);

      const result = await getPriceHistoryOptimized(productId, days);

      // Should return all four sources
      expect(result.some((r) => r.source === 'raw')).toBe(true);
      expect(result.some((r) => r.source === 'daily')).toBe(true);
      expect(result.some((r) => r.source === 'weekly')).toBe(true);
      expect(result.some((r) => r.source === 'monthly')).toBe(true);
    });

    it('should query four times (raw + daily + weekly + monthly) for 1+ years', async () => {
      const productId = 1;
      const days = 730; // 2 years

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      await getPriceHistoryOptimized(productId, days);

      // Should query four times: raw + daily + weekly + monthly
      expect(db.select).toHaveBeenCalledTimes(4);
    });
  });
});

describe('getPriceHistoryOptimized - Data Normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should normalize raw data correctly', async () => {
    const mockRawData = [
      {
        history: {
          recordedAt: new Date('2024-03-01T10:00:00Z'),
          price: '99.99',
          retailerId: 1,
          availability: 'in_stock',
        },
        retailer: { name: 'Amazon' },
      },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockRawData),
          }),
        }),
      }),
    } as any);

    const result = await getPriceHistoryOptimized(1, 7);

    expect(result[0]).toMatchObject({
      date: mockRawData[0].history.recordedAt,
      price: 99.99,
      retailerId: 1,
      retailerName: 'Amazon',
      availability: 'in_stock',
      source: 'raw',
    });
  });

  it('should normalize daily aggregates correctly', async () => {
    const mockDailyData = [
      {
        agg: {
          date: '2024-02-15',
          avgPrice: '95.00',
          minPrice: '90.00',
          maxPrice: '100.00',
          medianPrice: '95.00',
          retailerId: 1,
        },
        retailer: { name: 'Best Buy' },
      },
    ];

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockDailyData),
            }),
          }),
        }),
      } as any);

    const result = await getPriceHistoryOptimized(1, 45);

    const dailyPoint = result.find((r) => r.source === 'daily');
    expect(dailyPoint).toMatchObject({
      price: 95.0,
      minPrice: 90.0,
      maxPrice: 100.0,
      avgPrice: 95.0,
      medianPrice: 95.0,
      retailerId: 1,
      retailerName: 'Best Buy',
      source: 'daily',
    });
  });

  it('should normalize weekly aggregates correctly', async () => {
    const mockWeeklyData = [
      {
        agg: {
          year: 2024,
          week: 10,
          avgPrice: '90.00',
          minPrice: '85.00',
          maxPrice: '95.00',
          medianPrice: '90.00',
          retailerId: 1,
        },
        retailer: { name: 'Target' },
      },
    ];

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockWeeklyData),
            }),
          }),
        }),
      } as any);

    const result = await getPriceHistoryOptimized(1, 100);

    const weeklyPoint = result.find((r) => r.source === 'weekly');
    expect(weeklyPoint).toMatchObject({
      price: 90.0,
      minPrice: 85.0,
      maxPrice: 95.0,
      avgPrice: 90.0,
      medianPrice: 90.0,
      retailerId: 1,
      retailerName: 'Target',
      source: 'weekly',
    });
    expect(weeklyPoint?.date).toBeInstanceOf(Date);
  });

  it('should normalize monthly aggregates correctly', async () => {
    const mockMonthlyData = [
      {
        agg: {
          year: 2023,
          month: 6,
          avgPrice: '85.00',
          minPrice: '80.00',
          maxPrice: '90.00',
          medianPrice: '85.00',
          retailerId: 1,
        },
        retailer: { name: 'Walmart' },
      },
    ];

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockMonthlyData),
            }),
          }),
        }),
      } as any);

    const result = await getPriceHistoryOptimized(1, 400);

    const monthlyPoint = result.find((r) => r.source === 'monthly');
    expect(monthlyPoint).toMatchObject({
      price: 85.0,
      minPrice: 80.0,
      maxPrice: 90.0,
      avgPrice: 85.0,
      medianPrice: 85.0,
      retailerId: 1,
      retailerName: 'Walmart',
      source: 'monthly',
    });
    expect(monthlyPoint?.date).toBeInstanceOf(Date);
  });

  it('should handle retailer filtering in raw data', async () => {
    const mockRawData = [
      {
        history: {
          recordedAt: new Date('2024-03-01'),
          price: '99.99',
          retailerId: 1,
          availability: 'in_stock',
        },
        retailer: { name: 'Amazon' },
      },
      {
        history: {
          recordedAt: new Date('2024-03-01'),
          price: '105.99',
          retailerId: 2,
          availability: 'in_stock',
        },
        retailer: { name: 'Best Buy' },
      },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockRawData),
          }),
        }),
      }),
    } as any);

    const result = await getPriceHistoryOptimized(1, 7, 1); // Filter by retailer 1

    // When retailer filter is applied, should still return data
    // (actual filtering happens in the database query)
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getPriceHistoryOptimized - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      }),
    } as any);

    await expect(getPriceHistoryOptimized(1, 7)).rejects.toThrow('Database connection failed');
  });

  it('should handle empty results', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as any);

    const result = await getPriceHistoryOptimized(999, 7);

    expect(result).toEqual([]);
  });
});
