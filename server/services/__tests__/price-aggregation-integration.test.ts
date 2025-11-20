import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriceAggregationService } from '../price-aggregation-service';
import { PriceSnapshotService } from '../price-snapshot-service';
import { getPriceHistoryOptimized } from '../price-history-service';
import { db } from '../../db';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

describe('Price Aggregation Integration Tests', () => {
  let aggregationService: PriceAggregationService;
  let snapshotService: PriceSnapshotService;

  beforeEach(() => {
    aggregationService = new PriceAggregationService();
    snapshotService = new PriceSnapshotService();
    vi.clearAllMocks();
  });

  describe('End-to-end aggregation flow', () => {
    it('should complete full lifecycle: insert -> aggregate -> verify -> cleanup', async () => {
      // Step 1: Mock inserting raw price history
      const mockRawData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00,105.00,102.00}',
          recordCount: 3,
        },
      ];

      // Step 2: Mock daily aggregation
      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockRawData),
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
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return await callback(mockTx as any);
      });

      // Run daily aggregation
      const aggregateCount = await aggregationService.calculateDailyAggregates();

      expect(aggregateCount).toBe(1);
      expect(db.transaction).toHaveBeenCalled();
    });

    it('should mark aggregated records for safe deletion', async () => {
      const mockRawData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00}',
          recordCount: 1,
        },
      ];

      let aggregatedAtSet = false;

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockRawData),
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
              if (data.aggregatedAt) {
                aggregatedAtSet = true;
              }
              return {
                where: vi.fn().mockResolvedValue({}),
              };
            }),
          }),
        };

        return await callback(mockTx as any);
      });

      await aggregationService.calculateDailyAggregates();

      expect(aggregatedAtSet).toBe(true);
    });

    it('should safely delete only old aggregated data', async () => {
      // Mock the aggregation service module
      const { priceAggregationService } = await import('../price-aggregation-service');
      const mockAggregateToDaily = vi.spyOn(priceAggregationService, 'aggregateToDaily')
        .mockResolvedValue(50);

      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 100 });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      await snapshotService.cleanupOldData();

      // Should aggregate first, then delete
      expect(mockAggregateToDaily).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();

      // Clean up spy
      mockAggregateToDaily.mockRestore();
    });

    it('should handle the complete aggregation pipeline', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');

      let daysProcessed = 0;

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        daysProcessed++;

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

        return await callback(mockTx as any);
      });

      const count = await aggregationService.aggregateToDaily(startDate, endDate);

      // Should process 3 days (Jan 1, 2, 3)
      expect(daysProcessed).toBe(3);
      expect(count).toBe(3);
    });
  });

  describe('Query after aggregation', () => {
    it('should query from correct data source based on date range', async () => {
      // Test 30-day query (should use raw data only)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  history: {
                    recordedAt: new Date('2024-03-01'),
                    price: '99.99',
                    retailerId: 1,
                    availability: 'in_stock',
                  },
                  retailer: { name: 'Amazon' },
                },
              ]),
            }),
          }),
        }),
      } as any);

      const result30Days = await getPriceHistoryOptimized(1, 30);

      // Should use raw data
      expect(result30Days.every(r => r.source === 'raw')).toBe(true);
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('should combine multiple data sources for long date ranges', async () => {
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
            week: 5,
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
            month: 12,
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

      const result = await getPriceHistoryOptimized(1, 400);

      // Should combine all sources
      expect(result.some(r => r.source === 'raw')).toBe(true);
      expect(result.some(r => r.source === 'daily')).toBe(true);
      expect(result.some(r => r.source === 'weekly')).toBe(true);
      expect(result.some(r => r.source === 'monthly')).toBe(true);
    });

    it('should maintain chronological order across data sources', async () => {
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

      const result = await getPriceHistoryOptimized(1, 60);

      // Verify chronological order (daily should come before raw in time)
      expect(result.length).toBe(2);
      expect(result[0].source).toBe('daily');
      expect(result[1].source).toBe('raw');
    });

    it('should not duplicate data points across sources', async () => {
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
        {
          history: {
            recordedAt: new Date('2024-03-01T14:00:00Z'),
            price: '98.99',
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

      // Each data point should be unique
      expect(result.length).toBe(2);
      expect(result[0].price).not.toBe(result[1].price);
    });
  });

  describe('Data integrity verification', () => {
    it('should preserve price accuracy through aggregation', async () => {
      const mockRawData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00,200.00,300.00}', // avg = 200
          recordCount: 3,
        },
      ];

      let capturedAvgPrice: string | undefined;

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockRawData),
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
              capturedAvgPrice = values[0].avgPrice;
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

        return await callback(mockTx as any);
      });

      await aggregationService.calculateDailyAggregates();

      expect(capturedAvgPrice).toBe('200.00');
    });

    it('should maintain referential integrity between aggregates', async () => {
      const mockData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00}',
          recordCount: 1,
        },
      ];

      let insertedProductId: number | undefined;
      let insertedRetailerId: number | undefined;

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockData),
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
              insertedProductId = values[0].productId;
              insertedRetailerId = values[0].retailerId;
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

        return await callback(mockTx as any);
      });

      await aggregationService.calculateDailyAggregates();

      // Should maintain product and retailer relationships
      expect(insertedProductId).toBe(1);
      expect(insertedRetailerId).toBe(1);
    });

    it('should handle concurrent aggregation safely', async () => {
      const mockData = [
        {
          productId: 1,
          retailerId: 1,
          prices: '{100.00}',
          recordCount: 1,
        },
      ];

      let transactionCount = 0;

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        transactionCount++;

        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue(mockData),
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
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }),
        };

        return await callback(mockTx as any);
      });

      // Run multiple aggregations concurrently
      await Promise.all([
        aggregationService.calculateDailyAggregates(),
        aggregationService.calculateDailyAggregates(),
      ]);

      // Should use transactions to handle concurrency
      expect(transactionCount).toBe(2);
    });
  });

  describe('Performance characteristics', () => {
    it('should batch process large date ranges efficiently', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31'); // 31 days

      let transactionCount = 0;

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        transactionCount++;

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

        return await callback(mockTx as any);
      });

      await aggregationService.aggregateToDaily(startDate, endDate);

      // Should process all 31 days
      expect(transactionCount).toBe(31);
    });

    it('should optimize query count for multi-source retrieval', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      await getPriceHistoryOptimized(1, 400); // Should use all 4 sources

      // Should make exactly 4 queries (raw + daily + weekly + monthly)
      expect(db.select).toHaveBeenCalledTimes(4);
    });
  });
});
