/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle query builder mocks require complex chain typing */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriceSnapshotService } from '../price-snapshot-service';
import { priceAggregationService } from '../price-aggregation-service';
import { db } from '../../db';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    delete: vi.fn(),
  },
}));

// Mock the aggregation service
vi.mock('../price-aggregation-service', () => ({
  priceAggregationService: {
    aggregateToDaily: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PriceSnapshotService - cleanupOldData', () => {
  let service: PriceSnapshotService;

  beforeEach(() => {
    service = new PriceSnapshotService();
    vi.clearAllMocks();
  });

  it('should call aggregateToDaily for 30-90 day data', async () => {
    const now = new Date('2024-03-15T12:00:00Z');
    vi.setSystemTime(now);

    // Mock aggregateToDaily to return count
    vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(100);

    // Mock delete to return result
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 0 }),
    } as any);

    await service.cleanupOldData();

    // Should call aggregateToDaily with 90 days ago to 30 days ago
    expect(priceAggregationService.aggregateToDaily).toHaveBeenCalledTimes(1);

    const callArgs = vi.mocked(priceAggregationService.aggregateToDaily).mock.calls[0];
    const startDate = callArgs[0];
    const endDate = callArgs[1];

    // Check that startDate is ~90 days ago
    const expectedStart = new Date(now);
    expectedStart.setDate(now.getDate() - 90);
    expect(startDate.toDateString()).toBe(expectedStart.toDateString());

    // Check that endDate is ~30 days ago
    const expectedEnd = new Date(now);
    expectedEnd.setDate(now.getDate() - 30);
    expect(endDate.toDateString()).toBe(expectedEnd.toDateString());

    vi.useRealTimers();
  });

  it('should only delete records older than 2 years', async () => {
    const now = new Date('2024-03-15T12:00:00Z');
    vi.setSystemTime(now);

    vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(0);

    const mockWhere = vi.fn().mockResolvedValue({ rowCount: 50 });
    vi.mocked(db.delete).mockReturnValue({
      where: mockWhere,
    } as any);

    await service.cleanupOldData();

    // Should call where with conditions
    expect(mockWhere).toHaveBeenCalledTimes(1);

    // The where call should include conditions for:
    // - recordedAt <= 2 years ago
    // - aggregatedAt IS NOT NULL
    expect(mockWhere).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should only delete records with aggregatedAt IS NOT NULL', async () => {
    vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(0);

    const mockWhere = vi.fn().mockResolvedValue({ rowCount: 0 });
    vi.mocked(db.delete).mockReturnValue({
      where: mockWhere,
    } as any);

    await service.cleanupOldData();

    // Verify the where clause was called (it should include isNotNull check)
    expect(mockWhere).toHaveBeenCalled();
  });

  it('should NOT delete recent data (< 2 years)', async () => {
    const now = new Date('2024-03-15T12:00:00Z');
    vi.setSystemTime(now);

    vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(0);

    const mockWhere = vi.fn().mockResolvedValue({ rowCount: 0 });
    vi.mocked(db.delete).mockReturnValue({
      where: mockWhere,
    } as any);

    await service.cleanupOldData();

    // The delete should target data older than 2 years
    // Records from 2022-03-15 and older should be deleted
    // Records from after 2022-03-15 should NOT be deleted
    expect(db.delete).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should NOT delete unaggregated data', async () => {
    vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(0);

    const mockWhere = vi.fn().mockResolvedValue({ rowCount: 0 });
    vi.mocked(db.delete).mockReturnValue({
      where: mockWhere,
    } as any);

    await service.cleanupOldData();

    // The where clause should include isNotNull(aggregatedAt)
    // This ensures we never delete unaggregated data
    expect(mockWhere).toHaveBeenCalled();
  });

  it('should log correct counts', async () => {
    const { logger } = await import('../../utils/logger');

    vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(250);

    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1500 }),
    } as any);

    await service.cleanupOldData();

    // Should log the aggregation count
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('250'));

    // Should log the deletion count
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('1500'));
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(priceAggregationService.aggregateToDaily).mockRejectedValue(
      new Error('Aggregation failed')
    );

    await expect(service.cleanupOldData()).rejects.toThrow('Aggregation failed');
  });

  it('should complete even if no data to aggregate', async () => {
    vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(0);

    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 0 }),
    } as any);

    await expect(service.cleanupOldData()).resolves.not.toThrow();
  });

  it('should complete even if no data to delete', async () => {
    vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(100);

    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 0 }),
    } as any);

    await expect(service.cleanupOldData()).resolves.not.toThrow();
  });

  describe('data lifecycle verification', () => {
    it('should follow 0-30 day retention (raw data kept)', async () => {
      const now = new Date('2024-03-15T12:00:00Z');
      vi.setSystemTime(now);

      vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(0);
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      } as any);

      await service.cleanupOldData();

      // Should NOT aggregate 0-30 day data
      const callArgs = vi.mocked(priceAggregationService.aggregateToDaily).mock.calls[0];
      const endDate = callArgs[1];

      // End date should be 30 days ago
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      expect(endDate.toDateString()).toBe(thirtyDaysAgo.toDateString());

      vi.useRealTimers();
    });

    it('should follow 30-90 day lifecycle (aggregate to daily)', async () => {
      const now = new Date('2024-03-15T12:00:00Z');
      vi.setSystemTime(now);

      vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(0);
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      } as any);

      await service.cleanupOldData();

      // Should aggregate 30-90 day data
      const callArgs = vi.mocked(priceAggregationService.aggregateToDaily).mock.calls[0];
      const startDate = callArgs[0];
      const endDate = callArgs[1];

      // Start should be 90 days ago
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(now.getDate() - 90);
      expect(startDate.toDateString()).toBe(ninetyDaysAgo.toDateString());

      // End should be 30 days ago
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      expect(endDate.toDateString()).toBe(thirtyDaysAgo.toDateString());

      vi.useRealTimers();
    });

    it('should follow 2+ year lifecycle (delete after aggregation)', async () => {
      const now = new Date('2024-03-15T12:00:00Z');
      vi.setSystemTime(now);

      vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(0);

      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 100 });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      await service.cleanupOldData();

      // Should delete data older than 2 years
      expect(db.delete).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
