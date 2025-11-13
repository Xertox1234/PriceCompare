import { useAuth } from './use-auth';

/**
 * Hook to get current user data
 * This is a convenience wrapper around useAuth
 */
export function useUser() {
  const { data: user, ...rest } = useAuth();

  return {
    user,
    ...rest,
  };
}
