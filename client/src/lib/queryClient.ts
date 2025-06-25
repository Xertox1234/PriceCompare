import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  const defaultOptions: RequestInit = {
    method: 'GET',
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    ...options,
  };

  const res = await fetch(url, defaultOptions);
  
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
  if (!text) return null;
  
  try {
    return JSON.parse(text);
  } catch {
    return text;
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
