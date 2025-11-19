import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Store CSRF token in memory
let csrfToken: string | null = null;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
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
  
  // Don't throw for 401 errors, let components handle them
  if (res.status === 401) {
    throw new Error('Unauthorized');
  }
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || res.statusText);
  }

  // Handle empty responses
  const text = await res.text();
  if (!text) return null as T;

  try {
    return JSON.parse(text);
  } catch {
    return text as T;
  }
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
