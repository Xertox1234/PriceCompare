/**
 * Home Page Data Hooks
 *
 * Fetches real product data from the backend for the home page.
 * Replaces static template-data.ts with live API data.
 */
import { useQuery } from "@tanstack/react-query";
import { ProductWithOffers } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Type for product data expected by template components
export interface ProductData {
  id: number;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  hoverImage?: string;
  rating: number;
  reviewCount: number;
  priceChange?: 'up' | 'down' | 'stable';
  priceChangePercent?: number;
  retailer?: string;
  discount?: number;
  inWatchlist?: boolean;
  countdownTimer?: number;
  sold?: number;
  available?: number;
}

// Types for product specifications
export interface ProductSpecification {
  specGroup?: string;
  specName: string;
  specValue: string;
  specUnit?: string;
}

export interface ProductSpecificationGroup {
  groupName: string;
  specs: ProductSpecification[];
}

// Response type for full product details
export interface ProductFullResponse {
  success: boolean;
  data: ProductWithOffers & {
    specifications?: ProductSpecification[];
    specGroups?: ProductSpecificationGroup[];
  };
}

// Transform backend ProductWithOffers to template ProductData format
function transformProduct(product: ProductWithOffers): ProductData {
  const bestOffer = product.offers?.[0];
  const price = product.bestPrice ?? (bestOffer ? parseFloat(bestOffer.price) : 0);
  const originalPrice = bestOffer?.originalPrice ? parseFloat(bestOffer.originalPrice) : undefined;
  const discount = originalPrice && originalPrice > price
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : undefined;

  return {
    id: product.id,
    name: product.name,
    category: product.category ?? 'General',
    price,
    originalPrice,
    image: product.image ?? '/placeholder-product.png',
    rating: bestOffer?.rating ? parseFloat(bestOffer.rating) : 4.0,
    reviewCount: bestOffer?.reviewCount ?? 0,
    retailer: product.brand ?? undefined,
    discount,
    priceChange: discount ? 'down' : 'stable',
    priceChangePercent: discount,
  };
}

// Fetch all products (for general use)
export function useAllProducts() {
  return useQuery<ProductWithOffers[]>({
    queryKey: ['/api/products'],
    queryFn: () => apiRequest<ProductWithOffers[]>('/api/products'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
  });
}

// Fetch trending/most watched products
export function useTrendingProducts(limit = 6) {
  return useQuery<Array<{ productId: number; watchCount: number; product: ProductWithOffers }>>({
    queryKey: ['/api/community/most-watched', limit],
    queryFn: () => apiRequest<Array<{ productId: number; watchCount: number; product: ProductWithOffers }>>(`/api/community/most-watched?limit=${limit}`),
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch products by category
export function useProductsByCategory(category: string, limit = 8) {
  return useQuery<{ results: ProductWithOffers[] }>({
    queryKey: ['/api/products/search', category, limit],
    queryFn: () => apiRequest<{ results: ProductWithOffers[] }>(`/api/products/search?category=${encodeURIComponent(category)}&limit=${limit}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!category,
  });
}

// Fetch featured/deal products (products with discounts)
export function useDealProducts(limit = 6) {
  return useQuery<{ results: ProductWithOffers[] }>({
    queryKey: ['/api/products/search', 'deals', limit],
    queryFn: () => apiRequest<{ results: ProductWithOffers[] }>(`/api/products/search?sortBy=price_low&limit=${limit * 2}`),
    staleTime: 5 * 60 * 1000,
    select: (data) => {
      // Filter to products that have original price > current price
      const deals = data.results?.filter(p => {
        const offer = p.offers?.[0];
        if (!offer?.originalPrice) return false;
        return parseFloat(offer.originalPrice) > parseFloat(offer.price);
      }) ?? [];
      return { results: deals.slice(0, limit) };
    },
  });
}

// Fetch new arrivals (most recently added products)
export function useNewArrivals(limit = 8) {
  return useQuery<ProductWithOffers[]>({
    queryKey: ['/api/products', 'new-arrivals', limit],
    queryFn: async () => {
      // Products endpoint returns in order, we assume newest first
      const products = await apiRequest<ProductWithOffers[]>('/api/products');
      // Return the most recent products (by createdAt if available, or just first N)
      return products.slice(0, limit);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch best sellers (products with highest review counts/ratings)
export function useBestSellers(limit = 8) {
  return useQuery<{ results: ProductWithOffers[] }>({
    queryKey: ['/api/products/search', 'best-sellers', limit],
    queryFn: () => apiRequest<{ results: ProductWithOffers[] }>(`/api/products/search?sortBy=rating&limit=${limit}`),
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch single product by ID
export function useProduct(productId: number | null) {
  return useQuery<ProductWithOffers>({
    queryKey: ['/api/products', productId],
    queryFn: () => apiRequest<ProductWithOffers>(`/api/products/${productId}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!productId,
  });
}

// Fetch product with full details including specifications
export function useProductFull(productId: number | null) {
  return useQuery<ProductWithOffers & { specifications?: ProductSpecification[]; specGroups?: ProductSpecificationGroup[] }>({
    queryKey: ['/api/products', productId, 'full'],
    queryFn: () => apiRequest<ProductWithOffers & { specifications?: ProductSpecification[]; specGroups?: ProductSpecificationGroup[] }>(`/api/products/${productId}/full`),
    staleTime: 5 * 60 * 1000,
    enabled: !!productId,
  });
}

// Fetch retailers for category filtering
export function useRetailers() {
  return useQuery<Array<{ id: number; name: string; logo?: string }>>({
    queryKey: ['/api/retailers'],
    queryFn: () => apiRequest<Array<{ id: number; name: string; logo?: string }>>('/api/retailers'),
    staleTime: 60 * 60 * 1000, // 1 hour - retailers don't change often
  });
}

// Combined hook for home page data
export function useHomePageData() {
  const allProducts = useAllProducts();
  const trending = useTrendingProducts(6);
  const deals = useDealProducts(6);
  const newArrivals = useNewArrivals(8);
  const bestSellers = useBestSellers(8);
  const laptops = useProductsByCategory('Laptops', 8);
  const smartphones = useProductsByCategory('Smartphones', 8);

  const isLoading = allProducts.isLoading || trending.isLoading;
  const error = allProducts.error || trending.error;

  // Transform all products to template format
  const transformedProducts = {
    all: allProducts.data?.map(transformProduct) ?? [],
    trending: trending.data?.map(item => transformProduct(item.product)) ?? [],
    deals: deals.data?.results?.map(transformProduct) ?? [],
    newArrivals: newArrivals.data?.map(transformProduct) ?? [],
    bestSellers: bestSellers.data?.results?.map(transformProduct) ?? [],
    laptops: laptops.data?.results?.map(transformProduct) ?? [],
    smartphones: smartphones.data?.results?.map(transformProduct) ?? [],
  };

  return {
    products: transformedProducts,
    isLoading,
    error,
    // Raw data for custom transformations
    raw: {
      allProducts: allProducts.data,
      trending: trending.data,
      deals: deals.data,
      newArrivals: newArrivals.data,
      bestSellers: bestSellers.data,
      laptops: laptops.data,
      smartphones: smartphones.data,
    },
  };
}

// Export transform function for use in components
export { transformProduct };
