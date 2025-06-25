import { QueryClient } from '@tanstack/react-query';

// Optimized query client configuration for better performance
export const optimizedQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except 408 (timeout)
        if (error && typeof error === 'object' && 'status' in error) {
          const status = error.status as number;
          if (status >= 400 && status < 500 && status !== 408) {
            return false;
          }
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Preload critical data
export function preloadCriticalData() {
  optimizedQueryClient.prefetchQuery({
    queryKey: ['/api/retailers'],
    queryFn: () => fetch('/api/retailers').then(res => res.json()),
    staleTime: 10 * 60 * 1000, // 10 minutes for retailers
  });
}