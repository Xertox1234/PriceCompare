import { useState, useCallback, useMemo } from "react";

export interface ComparisonProduct {
  id: number;
  name: string;
  imageUrl?: string;
  currentPrice?: number;
}

export interface ComparisonSettings {
  mode: 'side-by-side' | 'overlay';
  timeRange: number; // days
  syncTimeRanges: boolean;
  normalizeScales: boolean;
}

export function useProductComparison() {
  const [products, setProducts] = useState<ComparisonProduct[]>([]);
  const [settings, setSettings] = useState<ComparisonSettings>({
    mode: 'side-by-side',
    timeRange: 30,
    syncTimeRanges: true,
    normalizeScales: false,
  });

  // Add product to comparison
  const addProduct = useCallback((product: ComparisonProduct) => {
    setProducts((prev) => {
      // Check if already exists
      if (prev.some((p) => p.id === product.id)) {
        return prev;
      }
      // Limit to 4 products
      if (prev.length >= 4) {
        return [...prev.slice(1), product];
      }
      return [...prev, product];
    });
  }, []);

  // Remove product from comparison
  const removeProduct = useCallback((productId: number) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  // Clear all products
  const clearAll = useCallback(() => {
    setProducts([]);
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<ComparisonSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Toggle mode
  const toggleMode = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      mode: prev.mode === 'side-by-side' ? 'overlay' : 'side-by-side',
    }));
  }, []);

  // Check if product is in comparison
  const isInComparison = useCallback(
    (productId: number) => products.some((p) => p.id === productId),
    [products]
  );

  // Calculate normalized price scales if needed
  const priceScale = useMemo(() => {
    if (!settings.normalizeScales || products.length === 0) {
      return null;
    }

    const prices = products
      .map((p) => p.currentPrice)
      .filter((p): p is number => p !== undefined);

    if (prices.length === 0) return null;

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return {
      min: minPrice * 0.9, // 10% below min
      max: maxPrice * 1.1, // 10% above max
    };
  }, [products, settings.normalizeScales]);

  return {
    products,
    settings,
    addProduct,
    removeProduct,
    clearAll,
    updateSettings,
    toggleMode,
    isInComparison,
    priceScale,
    hasProducts: products.length > 0,
    canAddMore: products.length < 4,
  };
}
