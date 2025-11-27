import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, ApiError } from '@/lib/queryClient';
import type { User } from '@shared/schema';

/**
 * Fetch the currently authenticated user
 *
 * Returns the current user's data if authenticated, or null if not authenticated.
 * Automatically handles authentication errors (401/404) by returning null,
 * while re-throwing unexpected errors for proper error handling.
 *
 * @returns React Query result with User data or null
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { data: user, isLoading } = useAuth();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!user) return <div>Please log in</div>;
 *
 *   return <div>Welcome, {user.username}!</div>;
 * }
 * ```
 */
export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async (): Promise<User | null> => {
      try {
        const response = await apiRequest<User>('/api/auth/user');
        return response;
      } catch (error) {
        // Type-guard the error for proper handling
        if (error instanceof ApiError) {
          // Return null for expected auth failures (401 Unauthorized, 404 Not Found)
          if (error.status === 401 || error.status === 404) {
            return null;
          }
          // Log unexpected API errors for debugging
          console.warn('Auth check failed with unexpected status:', {
            status: error.status,
            message: error.message,
            details: error.details,
          });
        } else if (error instanceof Error) {
          // Log network or other errors
          console.warn('Auth check failed:', error.message);
        } else {
          console.warn('Auth check failed with unknown error:', error);
        }

        // Re-throw unexpected errors so React Query can retry
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Log out the current user
 *
 * Invalidates the current user's session and refreshes the page to reset all state.
 * Automatically invalidates all auth-related queries in the React Query cache.
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   const logout = useLogout();
 *
 *   return (
 *     <button
 *       onClick={() => logout.mutate()}
 *       disabled={logout.isPending}
 *     >
 *       {logout.isPending ? 'Logging out...' : 'Log out'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return apiRequest('/api/auth/logout', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'user'], null);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      // Refresh the page to reset all state
      window.location.reload();
    },
  });
}