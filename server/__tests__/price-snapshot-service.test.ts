import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Redis and logger BEFORE importing service
import './helpers/mock-redis';
import './helpers/mock-logger';

// Mock storage layer
vi.mock('../storage', () => ({
  storage: {
    getActiveProductOffers: vi.fn(),
    getProductOffersForSnapshot: vi.fn(),
    getProductOffersByProductId: vi.fn(),
    createPriceHistoryBatch: vi.fn(),
    getPriceHistoryForOffers: vi.fn(),
    insertPriceHistoryBatch: vi.fn(),
    getProductByIdRaw: vi.fn(),
    getRetailersByIds: vi.fn(),
    getAllOffersWithDetails: vi.fn(),
    getPriceHistoryForAnalysis: vi.fn(),
    deleteOldAggregatedPriceHistory: vi.fn(),
  },
}));

import { PriceSnapshotService } from '../services/price-snapshot-service';
import type { IStorage } from '../storage';

describe('PriceSnapshotService', () => {
  let service: PriceSnapshotService;
  let mockStorage: Partial<IStorage>;

  beforeEach(async () => {
    const { storage } = await import('../storage');
    mockStorage = storage as Partial<IStorage>;
    vi.clearAllMocks();

    service = new PriceSnapshotService();
  });

  describe('snapshotAllPrices', () => {
    it('should return 0 when no product offers exist', async () => {
      // Mock empty product offers batch
      (mockStorage.getProductOffersForSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const count = await service.snapshotAllPrices();

      expect(count).toBe(0);
    });

    it('should create price history snapshots for all offers', async () => {
      const mockOffers = [
        {
          id: 1,
          productId: 1,
          retailerId: 1,
          price: '99.99',
          originalPrice: '129.99',
          availability: 'in_stock',
          rating: '4.5',
          reviewCount: 100,
        },
        {
          id: 2,
          productId: 2,
          retailerId: 1,
          price: '199.99',
          originalPrice: null,
          availability: 'in_stock',
          rating: '4.0',
          reviewCount: 50,
        },
      ];

      // Mock storage methods - getProductOffersForSnapshot returns batch, then empty on next call
      (mockStorage.getProductOffersForSnapshot as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockOffers)
        .mockResolvedValueOnce([]); // Empty batch ends the loop
      (mockStorage.insertPriceHistoryBatch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const count = await service.snapshotAllPrices();

      expect(count).toBe(2);
      expect(mockStorage.insertPriceHistoryBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            productOfferId: 1,
            productId: 1,
            retailerId: 1,
            price: '99.99',
          }),
          expect.objectContaining({
            productOfferId: 2,
            productId: 2,
            retailerId: 1,
            price: '199.99',
          }),
        ])
      );
    });

    it('should handle database errors gracefully', async () => {
      (mockStorage.getProductOffersForSnapshot as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Database error'));

      await expect(service.snapshotAllPrices()).rejects.toThrow('Database error');
    });
  });

  describe('snapshotProductPrices', () => {
    it('should return 0 when product has no offers', async () => {
      (mockStorage.getProductOffersByProductId as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const count = await service.snapshotProductPrices(1);

      expect(count).toBe(0);
    });

    it('should create snapshots for specific product offers', async () => {
      const mockOffers = [
        {
          id: 1,
          productId: 1,
          retailerId: 1,
          price: '99.99',
          originalPrice: '129.99',
          availability: 'in_stock',
          rating: '4.5',
          reviewCount: 100,
        },
      ];

      (mockStorage.getProductOffersByProductId as ReturnType<typeof vi.fn>).mockResolvedValue(mockOffers);
      (mockStorage.getPriceHistoryForOffers as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockStorage.insertPriceHistoryBatch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const count = await service.snapshotProductPrices(1);

      expect(count).toBe(1);
      expect(mockStorage.insertPriceHistoryBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            productId: 1,
            price: '99.99',
          }),
        ])
      );
    });
  });
});
