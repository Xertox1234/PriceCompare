import { QueryClient, QueryFunction } from '@tanstack/react-query';
import {
  ApiResponse,
  isErrorResponse,
  isSuccessResponse,
  isPaginatedResponse,
  unwrapApiResponse,
} from '@shared/api-types';

// Store CSRF token in memory
let csrfToken: string | null = null;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Custom error class for API errors with status codes
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Make an API request and automatically unwrap envelope responses
 *
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Unwrapped data of type T
 * @throws ApiError with status code and details
 */
export async function apiRequest<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Merge existing headers
  if (options.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  // Add CSRF token for non-GET requests
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const defaultOptions: RequestInit = {
    method: 'GET',
    headers,
    credentials: 'include',
    ...options,
  };

  const res = await fetch(url, defaultOptions);

  // Extract CSRF token from response headers
  const newCsrfToken = res.headers.get('X-CSRF-Token');
  if (newCsrfToken) {
    csrfToken = newCsrfToken;
  }

  // Handle empty responses (204 No Content)
  if (res.status === 204) {
    return null as T;
  }

  // Parse response body
  const text = await res.text();
  if (!text) {
    if (!res.ok) {
      throw new ApiError(res.statusText || 'Request failed', res.status);
    }
    return null as T;
  }

  let parsedResponse: unknown;
  try {
    parsedResponse = JSON.parse(text);
  } catch {
    // Non-JSON response
    if (!res.ok) {
      throw new ApiError(text || res.statusText, res.status);
    }
    return text as T;
  }

  // Check if response is in envelope format
  if (
    typeof parsedResponse === 'object' &&
    parsedResponse !== null &&
    'success' in parsedResponse
  ) {
    const envelopeResponse = parsedResponse as ApiResponse<T>;

    // Handle error responses
    if (isErrorResponse(envelopeResponse)) {
      throw new ApiError(envelopeResponse.error, res.status, envelopeResponse.details);
    }

    // Unwrap and return data from success responses
    if (isSuccessResponse(envelopeResponse)) {
      // Handle paginated responses
      if (isPaginatedResponse(envelopeResponse)) {
        return envelopeResponse.data as T;
      }
      // Handle regular success responses
      return envelopeResponse.data;
    }
  }

  // Legacy format (direct data) - return as-is for backward compatibility
  // This allows gradual migration and handles endpoints not yet standardized
  if (!res.ok) {
    throw new ApiError(
      typeof parsedResponse === 'object' && parsedResponse !== null && 'error' in parsedResponse
        ? String((parsedResponse as { error: unknown }).error)
        : res.statusText,
      res.status
    );
  }

  return parsedResponse as T;
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export function getQueryFn<T>(options: { on401: UnauthorizedBehavior }): QueryFunction<T> {
  return async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: 'include',
    });

    if (options.on401 === 'returnNull' && res.status === 401) {
      return null as T;
    }

    await throwIfResNotOk(res);
    const data: unknown = await res.json();

    // Handle standardized API responses
    if (typeof data === 'object' && data !== null && 'success' in data) {
      const apiResponse = data as ApiResponse<T>;

      if (isErrorResponse(apiResponse)) {
        throw new Error(apiResponse.error);
      }

      // Unwrap the response envelope
      return unwrapApiResponse(apiResponse) as T;
    }

    // Legacy responses - return as-is
    return data as T;
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      // Performance optimization: Longer cache times for product data
      staleTime: 10 * 60 * 1000, // 10 minutes (increased from 5)
      gcTime: 30 * 60 * 1000, // 30 minutes (increased from 10)
      // Improved retry logic with exponential backoff
      retry: (failureCount, error) => {
        // Don't retry unauthorized errors
        if (error && error.message === 'Unauthorized') {
          return false;
        }
        // Retry up to 3 times (increased from 2)
        return failureCount < 3;
      },
      // Exponential backoff for retries: 1s, 2s, 4s
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Enable network mode for better offline handling
      networkMode: 'online',
    },
    mutations: {
      // Increased retry attempts for mutations
      retry: 2, // Increased from 1
      // Exponential backoff for mutations
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      // Network mode for mutations
      networkMode: 'online',
    },
  },
});

/**
 * Custom hook composition helper that combines apiRequest with useQuery
 *
 * Provides a standardized pattern for creating type-safe API query hooks
 * with automatic error handling, CSRF token management, and response unwrapping.
 *
 * @template T - The expected response data type
 * @param url - API endpoint URL
 * @param options - Optional fetch options (method, headers, body, etc.)
 * @returns Query function compatible with React Query
 *
 * @example
 * ```typescript
 * import { useQuery } from '@tanstack/react-query';
 * import { createApiQueryFn } from '@/lib/queryClient';
 *
 * export function useProducts() {
 *   return useQuery<Product[]>({
 *     queryKey: ['products'],
 *     queryFn: createApiQueryFn<Product[]>('/api/products'),
 *   });
 * }
 *
 * // With dynamic parameters
 * export function useProduct(id: number) {
 *   return useQuery<Product>({
 *     queryKey: ['product', id],
 *     queryFn: createApiQueryFn<Product>(`/api/products/${id}`),
 *     enabled: !!id,
 *   });
 * }
 * ```
 */
export function createApiQueryFn<T>(url: string, options?: RequestInit): () => Promise<T> {
  return async () => {
    return apiRequest<T>(url, options);
  };
}
