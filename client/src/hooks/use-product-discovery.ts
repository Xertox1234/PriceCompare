import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DiscoveredProduct {
  title: string;
  price: number | null;
  url: string;
  retailer: string;
  domain: string;
}

interface DiscoveryResult {
  source: 'database' | 'retailers';
  message: string;
  products?: Array<{
    id: number;
    name: string;
    // ... other product fields from database
  }>;
  discoveredProducts?: DiscoveredProduct[];
  count: number;
  retailerResults?: Array<{
    retailer: string;
    domain: string;
    success: boolean;
    productsFound: number;
    error?: string;
  }>;
}

/**
 * Hook for discovering products from Canadian retailers
 *
 * When a search returns no results from the database, this hook
 * can be used to search retailers directly via Playwright scraping.
 */
export function useProductDiscovery() {
  return useMutation<DiscoveryResult, Error, { query: string; maxResultsPerRetailer?: number }>({
    mutationFn: async ({ query, maxResultsPerRetailer = 5 }) => {
      const response = await apiRequest<DiscoveryResult>('/api/discover/search', {
        method: 'POST',
        body: JSON.stringify({ query, maxResultsPerRetailer }),
      });
      return response;
    },
  });
}
