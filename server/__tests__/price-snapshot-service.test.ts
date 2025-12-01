/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle query builder mocks require complex chain typing */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriceSnapshotService } from '../services/price-snapshot-service';
import { db } from '../db';

// Mock the database
vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

describe('PriceSnapshotService', () => {
  let service: PriceSnapshotService;

  beforeEach(() => {
    service = new PriceSnapshotService();
    vi.clearAllMocks();
  });

  describe('snapshotAllPrices', () => {
    it('should return 0 when no product offers exist', async () => {
      // Mock empty product offers
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      } as any);

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

      // Mock database select
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockOffers),
      } as any);

      // Mock database insert
      const mockInsert = vi.fn().mockResolvedValue({ rowCount: 2 });
      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as any);

      const count = await service.snapshotAllPrices();

      expect(count).toBe(2);
      expect(mockInsert).toHaveBeenCalledWith(
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
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      await expect(service.snapshotAllPrices()).rejects.toThrow('Database error');
    });
  });

  describe('snapshotProductPrices', () => {
    it('should return 0 when product has no offers', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

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

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockOffers),
        }),
      } as any);

      const mockInsert = vi.fn().mockResolvedValue({ rowCount: 1 });
      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as any);

      const count = await service.snapshotProductPrices(1);

      expect(count).toBe(1);
      expect(mockInsert).toHaveBeenCalledWith(
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
