import { useQuery } from '@tanstack/react-query';
import { apiRequest, ApiError } from '@/lib/queryClient';
import type { UserProfileData } from '@/components/profile';
import { createLogger } from '@/utils/logger';

const log = createLogger('UserProfile');

/**
 * Extended user profile response from the API
 * Includes all profile fields beyond basic auth data
 */
export interface UserProfileResponse {
  id: number;
  username: string;
  email: string;
  role: string;
  reputation: number;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  trustLevel: number;
  lastSeenAt: string | null;
  postCount: number;
  topicCount: number;
  likesGiven: number;
  likesReceived: number;
  daysVisited: number;
  createdAt: string;
  csrfToken?: string;
}

/**
 * Fetch extended user profile data for the authenticated user
 *
 * Unlike useAuth() which returns minimal user data for authentication state,
 * this hook fetches the complete user profile including:
 * - Profile fields (bio, location, website, avatarUrl)
 * - Trust level
 * - Activity stats (posts, topics, likes given/received, days visited)
 * - Timestamps (createdAt, lastSeenAt)
 *
 * @returns React Query result with full UserProfileData or null
 *
 * @example
 * ```tsx
 * function ProfilePage() {
 *   const { data: profile, isLoading, error } = useUserProfile();
 *
 *   if (isLoading) return <Spinner />;
 *   if (!profile) return <LoginPrompt />;
 *
 *   return (
 *     <div>
 *       <h1>{profile.username}</h1>
 *       <p>{profile.bio}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUserProfile() {
  return useQuery({
    queryKey: ['user', 'profile'],
    queryFn: async (): Promise<UserProfileData | null> => {
      try {
        const response = await apiRequest<UserProfileResponse>('/api/auth/user');

        // Transform response to UserProfileData format
        // This normalizes the API response and provides defaults for optional fields
        return {
          id: response.id,
          username: response.username,
          email: response.email,
          role: response.role ?? 'user',
          reputation: response.reputation ?? 0,
          avatarUrl: response.avatarUrl ?? null,
          bio: response.bio ?? null,
          location: response.location ?? null,
          website: response.website ?? null,
          trustLevel: response.trustLevel ?? 0,
          lastSeenAt: response.lastSeenAt ?? null,
          postCount: response.postCount ?? 0,
          topicCount: response.topicCount ?? 0,
          likesGiven: response.likesGiven ?? 0,
          likesReceived: response.likesReceived ?? 0,
          daysVisited: response.daysVisited ?? 0,
          createdAt: response.createdAt,
        };
      } catch (error) {
        // Handle authentication errors gracefully
        if (error instanceof ApiError) {
          if (error.status === 401 || error.status === 404) {
            return null;
          }
          log.warn('Profile fetch failed with unexpected status', {
            status: error.status,
            message: error.message,
          });
        } else if (error instanceof Error) {
          log.warn(`Profile fetch failed: ${error.message}`);
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 2 * 60 * 1000, // 2 minutes (shorter than auth since profile data changes more)
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
