import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriceAggregationService } from '../price-aggregation-service';
import { db } from '../../db';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PriceAggregationService', () => {
  let service: PriceAggregationService;

  beforeEach(() => {
    service = new PriceAggregationService();
    vi.clearAllMocks();
  });

  describe('calculateDailyAggregates', () => {
    it('should create daily aggregates for yesterday', async () => {
      const mockPriceData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{99.99,95.00,97.50}',
          recordCount: 3,
        },
        {
          productId: 2,
          retailerId: 1,
          prices: '{199.99,189.99}',
          recordCount: 2,
        },
      ];

      const mockPreviousDayData = [
        {
          productId: 1,
          retailerId: 1,
          avgPrice: '100.00',
        },
      ];

      // Mock transaction behavior
      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockResolvedValue(mockPriceData),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onConflictDoUpdate: vi.fn().mockResolvedValue({}),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        // Mock the select for previous day data
        mockTx.select = vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockResolvedValue(mockPriceData),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockPreviousDayData),
            }),
          });

        return callback(mockTx as any);
      });

      const count = await service.calculateDailyAggregates();

      expect(count).toBe(2);
      expect(db.transaction).toHaveBeenCalled();
    });

    it('should return 0 when no data for yesterday', async () => {
      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      const count = await service.calculateDailyAggregates();

      expect(count).toBe(0);
    });

    it('should calculate correct min/max/avg/median prices', async () => {
      const mockPriceData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00,200.00,150.00}', // min=100, max=200, avg=150, median=150
          recordCount: 3,
        },
      ];

      let capturedValues: any[] = [];

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockPriceData),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((values) => {
              capturedValues = values;
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue({}),
              };
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      await service.calculateDailyAggregates();

      expect(capturedValues).toHaveLength(1);
      expect(capturedValues[0]).toMatchObject({
        productId: 1,
        retailerId: 1,
        minPrice: '100.00',
        maxPrice: '200.00',
        avgPrice: '150.00',
        medianPrice: '150.00',
      });
    });

    it('should calculate day-over-day change correctly', async () => {
      const mockPriceData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{110.00}', // avg = 110
          recordCount: 1,
        },
      ];

      const mockPreviousDayData = [
        {
          productId: 1,
          retailerId: 1,
          avgPrice: '100.00', // previous avg = 100
        },
      ];

      let capturedValues: any[] = [];

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockPriceData),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(mockPreviousDayData),
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((values) => {
              capturedValues = values;
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue({}),
              };
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      await service.calculateDailyAggregates();

      // (110 - 100) / 100 * 100 = 10% increase
      expect(capturedValues[0].dayOverDayChange).toBe('10.00');
    });

    it('should mark records with aggregatedAt timestamp', async () => {
      const mockPriceData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00}',
          recordCount: 1,
        },
      ];

      let updateCalled = false;

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockPriceData),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onConflictDoUpdate: vi.fn().mockResolvedValue({}),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockImplementation((data) => {
              updateCalled = true;
              expect(data.aggregatedAt).toBeInstanceOf(Date);
              return {
                where: vi.fn().mockResolvedValue({}),
              };
            }),
          }),
        };

        return callback(mockTx as any);
      });

      await service.calculateDailyAggregates();

      expect(updateCalled).toBe(true);
    });

    it('should rollback on error', async () => {
      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockImplementation(() => {
              throw new Error('Database error');
            }),
          }),
        };

        return callback(mockTx as any);
      });

      await expect(service.calculateDailyAggregates()).rejects.toThrow('Database error');
    });

    it('should handle median calculation with even number of prices', async () => {
      const mockPriceData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00,200.00,300.00,400.00}', // median = (200 + 300) / 2 = 250
          recordCount: 4,
        },
      ];

      let capturedValues: any[] = [];

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockPriceData),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((values) => {
              capturedValues = values;
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue({}),
              };
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      await service.calculateDailyAggregates();

      expect(capturedValues[0].medianPrice).toBe('250.00');
    });

    it('should handle median calculation with odd number of prices', async () => {
      const mockPriceData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00,200.00,300.00}', // median = 200
          recordCount: 3,
        },
      ];

      let capturedValues: any[] = [];

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockPriceData),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((values) => {
              capturedValues = values;
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue({}),
              };
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      await service.calculateDailyAggregates();

      expect(capturedValues[0].medianPrice).toBe('200.00');
    });
  });

  describe('aggregateToDaily', () => {
    it('should aggregate a date range correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03'); // 3 days

      let transactionCount = 0;

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        transactionCount++;

        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]), // no existing aggregates
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue([
                    {
                      productId: 1,
                      retailerId: 1,
                      prices: '{100.00}',
                      recordCount: 1,
                    },
                  ]),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]), // no previous day data
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue({}),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      const count = await service.aggregateToDaily(startDate, endDate);

      // Should process each day (3 transactions)
      expect(transactionCount).toBe(3);
      expect(count).toBe(3); // 3 aggregates created (1 per day)
    });

    it('should skip already-aggregated dates', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-01'); // 1 day

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 1 }]), // existing aggregate
              }),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      const count = await service.aggregateToDaily(startDate, endDate);

      expect(count).toBe(0); // skipped
    });

    it('should continue on failure for individual dates', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03'); // 3 days

      let transactionCount = 0;

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        transactionCount++;

        // Fail on the second day
        if (transactionCount === 2) {
          throw new Error('Database error for day 2');
        }

        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue([
                    {
                      productId: 1,
                      retailerId: 1,
                      prices: '{100.00}',
                      recordCount: 1,
                    },
                  ]),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue({}),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      const count = await service.aggregateToDaily(startDate, endDate);

      // Should complete despite one failure
      expect(transactionCount).toBe(3);
      expect(count).toBe(2); // 2 successful aggregates
    });

    it('should return correct count of aggregates created', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02'); // 2 days

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue([
                    {
                      productId: 1,
                      retailerId: 1,
                      prices: '{100.00}',
                      recordCount: 1,
                    },
                    {
                      productId: 2,
                      retailerId: 1,
                      prices: '{200.00}',
                      recordCount: 1,
                    },
                  ]),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue({}),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      const count = await service.aggregateToDaily(startDate, endDate);

      // 2 days × 2 products = 4 aggregates
      expect(count).toBe(4);
    });

    it('should handle invalid date ranges gracefully', async () => {
      const startDate = new Date('2024-01-03');
      const endDate = new Date('2024-01-01'); // end before start

      const count = await service.aggregateToDaily(startDate, endDate);

      expect(count).toBe(0);
      expect(db.transaction).not.toHaveBeenCalled();
    });
  });

  describe('statistics calculation', () => {
    it('should calculate volatility score correctly', async () => {
      const mockPriceData = [
        {
          productId: 1,
          retailerId: 1,
          // Prices with high volatility: 50, 100, 150
          // Mean = 100, StdDev ≈ 40.82, CV = 40.82%
          prices: '{50.00,100.00,150.00}',
          recordCount: 3,
        },
      ];

      let capturedValues: any[] = [];

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockPriceData),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((values) => {
              capturedValues = values;
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue({}),
              };
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      await service.calculateDailyAggregates();

      // Volatility should be calculated
      expect(capturedValues[0].volatilityScore).toBeDefined();
      expect(parseFloat(capturedValues[0].volatilityScore)).toBeGreaterThan(0);
    });

    it('should handle single price point edge case', async () => {
      const mockPriceData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00}',
          recordCount: 1,
        },
      ];

      let capturedValues: any[] = [];

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockPriceData),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((values) => {
              capturedValues = values;
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue({}),
              };
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      await service.calculateDailyAggregates();

      expect(capturedValues[0]).toMatchObject({
        minPrice: '100.00',
        maxPrice: '100.00',
        avgPrice: '100.00',
        medianPrice: '100.00',
        volatilityScore: '0.00', // no variance
      });
    });

    it('should handle identical prices edge case', async () => {
      const mockPriceData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00,100.00,100.00}',
          recordCount: 3,
        },
      ];

      let capturedValues: any[] = [];

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockPriceData),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((values) => {
              capturedValues = values;
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue({}),
              };
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return callback(mockTx as any);
      });

      await service.calculateDailyAggregates();

      expect(capturedValues[0]).toMatchObject({
        minPrice: '100.00',
        maxPrice: '100.00',
        avgPrice: '100.00',
        medianPrice: '100.00',
        volatilityScore: '0.00', // no variance
      });
    });
  });
});
