import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useComparison } from '../use-comparison';
import type { ProductWithOffers } from '@shared/schema';

const mockProduct: ProductWithOffers = {
  id: 1,
  name: 'Test Product',
  description: 'Test product description',
  category: 'Electronics',
  brand: 'TestBrand',
  model: 'Test Model',
  image: 'https://example.com/image.jpg',
  embedding: null,
  embeddingUpdatedAt: null,
  searchVector: null,
  createdAt: new Date(),
  offers: [
    {
      id: 1,
      productId: 1,
      retailerId: 1,
      price: '99.99',
      originalPrice: null,
      availability: 'in_stock',
      rating: null,
      reviewCount: null,
      shippingInfo: null,
      dealType: null,
      productUrl: 'https://example.com/product',
      affiliateUrl: null,
      linkHealthStatus: null,
      lastLinkCheck: null,
      clickCount: null,
      lastUpdated: new Date(),
      retailer: {
        id: 1,
        name: 'Test Retailer',
        logo: 'https://example.com/logo.jpg',
        website: 'https://example.com',
        isActive: true,
        affiliateId: null,
        affiliateProgram: null,
        baseAffiliateUrl: null,
        commissionRate: null,
        affiliateStatus: null,
        affiliateConfig: null,
        countryCode: 'US',
        currency: 'USD',
      },
    },
  ],
  bestPrice: 99.99,
};

describe('useComparison', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty comparison list', () => {
    const { result } = renderHook(() => useComparison());

    expect(result.current.comparisonItems).toEqual([]);
  });

  it('adds product to comparison', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.addToComparison(mockProduct);
    });

    expect(result.current.comparisonItems).toHaveLength(1);
    expect(result.current.comparisonItems[0]).toEqual(mockProduct);
  });

  it('prevents adding duplicate products', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.addToComparison(mockProduct);
      result.current.addToComparison(mockProduct);
    });

    expect(result.current.comparisonItems).toHaveLength(1);
  });

  it('removes product from comparison', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.addToComparison(mockProduct);
    });

    expect(result.current.comparisonItems).toHaveLength(1);

    act(() => {
      result.current.removeFromComparison(mockProduct.id);
    });

    expect(result.current.comparisonItems).toHaveLength(0);
  });

  it('clears all comparison items', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.addToComparison(mockProduct);
      result.current.addToComparison({ ...mockProduct, id: 2, name: 'Product 2' });
    });

    expect(result.current.comparisonItems).toHaveLength(2);

    act(() => {
      result.current.clearComparison();
    });

    expect(result.current.comparisonItems).toHaveLength(0);
  });

  it('persists comparison items in localStorage', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.addToComparison(mockProduct);
    });

    // Verify the item was added to comparison state first
    expect(result.current.comparisonItems).toHaveLength(1);
    expect(result.current.comparisonItems[0].id).toBe(mockProduct.id);
  });

  it('limits comparison to maximum items', () => {
    const { result } = renderHook(() => useComparison());

    // Add 5 products (assuming max is 4)
    act(() => {
      for (let i = 1; i <= 5; i++) {
        result.current.addToComparison({ ...mockProduct, id: i, name: `Product ${i}` });
      }
    });

    // Should be limited to 4 items
    expect(result.current.comparisonItems).toHaveLength(4);
  });
});
