import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProductComparison } from '../useProductComparison';

describe('useProductComparison', () => {
  const mockProduct1 = {
    id: 1,
    name: 'Product 1',
    currentPrice: 99.99,
  };

  const mockProduct2 = {
    id: 2,
    name: 'Product 2',
    currentPrice: 89.99,
  };

  const mockProduct3 = {
    id: 3,
    name: 'Product 3',
    currentPrice: 79.99,
  };

  it('should initialize with empty products', () => {
    const { result } = renderHook(() => useProductComparison());

    expect(result.current.products).toEqual([]);
    expect(result.current.hasProducts).toBe(false);
    expect(result.current.canAddMore).toBe(true);
  });

  it('should add a product', () => {
    const { result } = renderHook(() => useProductComparison());

    act(() => {
      result.current.addProduct(mockProduct1);
    });

    expect(result.current.products).toHaveLength(1);
    expect(result.current.products[0]).toEqual(mockProduct1);
    expect(result.current.hasProducts).toBe(true);
  });

  it('should not add duplicate products', () => {
    const { result } = renderHook(() => useProductComparison());

    act(() => {
      result.current.addProduct(mockProduct1);
      result.current.addProduct(mockProduct1); // Duplicate
    });

    expect(result.current.products).toHaveLength(1);
  });

  it('should limit to 4 products', () => {
    const { result } = renderHook(() => useProductComparison());
    const mockProduct4 = { id: 4, name: 'Product 4', currentPrice: 69.99 };
    const mockProduct5 = { id: 5, name: 'Product 5', currentPrice: 59.99 };

    act(() => {
      result.current.addProduct(mockProduct1);
      result.current.addProduct(mockProduct2);
      result.current.addProduct(mockProduct3);
      result.current.addProduct(mockProduct4);
      result.current.addProduct(mockProduct5); // Should replace first
    });

    expect(result.current.products).toHaveLength(4);
    expect(result.current.products[0].id).toBe(2); // Product 1 removed
    expect(result.current.products[3].id).toBe(5); // Product 5 added
    expect(result.current.canAddMore).toBe(false);
  });

  it('should remove a product', () => {
    const { result } = renderHook(() => useProductComparison());

    act(() => {
      result.current.addProduct(mockProduct1);
      result.current.addProduct(mockProduct2);
    });

    expect(result.current.products).toHaveLength(2);

    act(() => {
      result.current.removeProduct(1);
    });

    expect(result.current.products).toHaveLength(1);
    expect(result.current.products[0].id).toBe(2);
  });

  it('should clear all products', () => {
    const { result } = renderHook(() => useProductComparison());

    act(() => {
      result.current.addProduct(mockProduct1);
      result.current.addProduct(mockProduct2);
      result.current.addProduct(mockProduct3);
    });

    expect(result.current.products).toHaveLength(3);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.products).toHaveLength(0);
    expect(result.current.hasProducts).toBe(false);
  });

  it('should toggle mode', () => {
    const { result } = renderHook(() => useProductComparison());

    expect(result.current.settings.mode).toBe('side-by-side');

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.settings.mode).toBe('overlay');

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.settings.mode).toBe('side-by-side');
  });

  it('should update settings', () => {
    const { result } = renderHook(() => useProductComparison());

    act(() => {
      result.current.updateSettings({
        timeRange: 90,
        normalizeScales: true,
      });
    });

    expect(result.current.settings.timeRange).toBe(90);
    expect(result.current.settings.normalizeScales).toBe(true);
  });

  it('should check if product is in comparison', () => {
    const { result } = renderHook(() => useProductComparison());

    act(() => {
      result.current.addProduct(mockProduct1);
    });

    expect(result.current.isInComparison(1)).toBe(true);
    expect(result.current.isInComparison(2)).toBe(false);
  });

  it('should calculate price scale when normalizeScales is true', () => {
    const { result } = renderHook(() => useProductComparison());

    act(() => {
      result.current.addProduct(mockProduct1); // 99.99
      result.current.addProduct(mockProduct2); // 89.99
      result.current.addProduct(mockProduct3); // 79.99
    });

    // No scale when normalizeScales is false
    expect(result.current.priceScale).toBeNull();

    act(() => {
      result.current.updateSettings({ normalizeScales: true });
    });

    // Should calculate scale with 10% padding
    expect(result.current.priceScale).not.toBeNull();
    expect(result.current.priceScale!.min).toBeCloseTo(79.99 * 0.9, 2);
    expect(result.current.priceScale!.max).toBeCloseTo(99.99 * 1.1, 2);
  });

  it('should return null price scale when no prices available', () => {
    const { result } = renderHook(() => useProductComparison());
    const productWithoutPrice = { id: 1, name: 'Product 1' };

    act(() => {
      result.current.addProduct(productWithoutPrice);
      result.current.updateSettings({ normalizeScales: true });
    });

    expect(result.current.priceScale).toBeNull();
  });
});
