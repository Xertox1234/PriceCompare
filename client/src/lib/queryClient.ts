import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Store CSRF token in memory
let csrfToken: string | null = null;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * API Response Envelope Types
 * All API endpoints now return standardized envelope format
 */
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiErrorResponse {
  success: false;
  error: string;
  details?: string;
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Type guard for discriminated union
 */
function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Custom error class for API errors
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
export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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
    credentials: "include",
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
    if (!isSuccessResponse(envelopeResponse)) {
      throw new ApiError(
        envelopeResponse.error,
        res.status,
        envelopeResponse.details
      );
    }

    // Unwrap and return data from success responses
    return envelopeResponse.data;
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

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
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
