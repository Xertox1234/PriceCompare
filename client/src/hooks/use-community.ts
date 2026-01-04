import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ProductWatch, WatchList, UserReputation, DealSpotting } from '@shared/schema';

// API response types

/**
 * Response type for GET /api/community/watches endpoint
 *
 * Represents the user's watched products with full product details.
 *
 * @remarks
 * This type reflects the standardized API envelope structure.
 * The server returns `{ data: ProductWatch[] }` where data contains the watches array.
 *
 * @see {@link useWatchedProducts} - Hook that consumes this response
 */
export interface WatchedProductsResponse {
  data: ProductWatch[];
}

/**
 * Response type for GET /api/community/most-watched endpoint
 *
 * Represents the most popular products across all users, ranked by watch count.
 * Returns aggregate statistics showing which products are trending in the community.
 *
 * @remarks
 * This type reflects the standardized API envelope structure.
 * The server returns `{ data: WatchStats[] }` where each WatchStats includes:
 * - Product details
 * - Total watch count across all users
 * - Ranking position
 *
 * @see {@link useMostWatchedProducts} - Hook that consumes this response
 */
export interface MostWatchedProductsResponse {
  data: WatchStats[];
}

/**
 * Response type for GET /api/community/reputation endpoint
 *
 * Represents the authenticated user's reputation score and earned badges.
 *
 * @see {@link useUserReputation} - Hook that consumes this response
 */
export interface UserReputationResponse {
  data: UserReputation & { badges: string[] };
}

/**
 * Response type for GET /api/community/leaderboard endpoint
 *
 * Represents the top users by reputation score, ranked from highest to lowest.
 *
 * @see {@link useLeaderboard} - Hook that consumes this response
 */
export interface LeaderboardResponse {
  data: LeaderboardEntry[];
}

/**
 * Response type for GET /api/community/recent-deals endpoint
 *
 * Represents recent deal spottings from the community, chronologically ordered.
 *
 * @see {@link useRecentDeals} - Hook that consumes this response
 */
export interface RecentDealsResponse {
  data: DealSpotting[];
}

/**
 * Response type for GET /api/community/watch-count/:productId endpoint
 *
 * Represents the total number of users watching a specific product.
 *
 * @see {@link useWatchCount} - Hook that consumes this response
 */
export interface WatchCountResponse {
  data: number;
}

/**
 * Response type for GET /api/community/is-watching/:productId endpoint
 *
 * Represents whether the authenticated user is currently watching a product.
 *
 * @see {@link useIsWatching} - Hook that consumes this response
 */
export interface IsWatchingResponse {
  data: boolean;
}

interface WatchStats {
  productId: number;
  productName: string;
  watchCount: number;
}

interface LeaderboardEntry {
  userId: number;
  username: string;
  reputationPoints: number;
  level: number;
  dealsSpotted: number;
  badges: string[];
}

/**
 * Add product to watch list
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @returns Mutation hook for adding products to watchlists
 */
export function useAddProductWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest<unknown>(`/api/community/watch/${productId}`, {
        method: 'POST',
      });
    },
    onSuccess: (_, productId) => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
      void queryClient.invalidateQueries({ queryKey: [`/api/community/watch-count/${productId}`] });
      void queryClient.invalidateQueries({ queryKey: [`/api/community/is-watching/${productId}`] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/most-watched'] });
    },
  });
}

/**
 * Remove product from watch list
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @returns Mutation hook for removing products from watchlists
 */
export function useRemoveProductWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest<unknown>(`/api/community/watch/${productId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, productId) => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
      void queryClient.invalidateQueries({ queryKey: [`/api/community/watch-count/${productId}`] });
      void queryClient.invalidateQueries({ queryKey: [`/api/community/is-watching/${productId}`] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/most-watched'] });
    },
  });
}

/**
 * Get user's watched products
 *
 * Fetches the complete list of products the authenticated user is watching.
 * Returns an array of ProductWatch objects containing full product details
 * plus watch metadata.
 *
 * @returns React Query result containing the watched products array
 *
 * @remarks
 * **Current Behavior**: Fetches all watched products in a single request.
 * This works well for typical user watch patterns (5-20 products).
 *
 * **Performance Considerations**:
 * - ✅ Acceptable: Watch lists with <50 products
 * - ⚠️ Consider optimization: Watch lists with 50-200 products
 * - 🔴 Requires pagination: Watch lists with 200+ products
 *
 * **Authentication**: This endpoint requires user authentication.
 * Unauthenticated requests will receive an empty array.
 *
 * @todo Add pagination support when users exceed 50 watched products
 * @todo Consider implementing virtual scrolling for large watch lists
 * @todo Monitor watch count metrics to determine pagination threshold
 *
 * @example
 * ```tsx
 * function WatchedProductsList() {
 *   const { data: response, isLoading } = useWatchedProducts();
 *
 *   if (isLoading) return <Spinner />;
 *   const products = response?.data ?? [];
 *
 *   return (
 *     <div>
 *       {products.map(watch => (
 *         <ProductCard key={watch.productId} product={watch.product} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWatchedProducts() {
  return useQuery<WatchedProductsResponse>({
    queryKey: ['/api/community/watches'],
    queryFn: async () => {
      return apiRequest<WatchedProductsResponse>('/api/community/watches');
    },
  });
}

/**
 * Get watch count for a product
 *
 * Fetches the total number of users currently watching a specific product.
 * Provides real-time social proof metrics for product popularity.
 *
 * @param productId - The ID of the product to get watch count for
 * @returns React Query result containing the watch count number
 *
 * @remarks
 * **Current Behavior**: Auto-refreshes every 30 seconds to show live watch count.
 * This provides real-time social proof on product detail pages.
 *
 * **Performance Considerations**:
 * - ✅ Acceptable: Auto-refresh for single product view
 * - ⚠️ Consider optimization: Multiple products with auto-refresh (use batch endpoint)
 * - 🔴 Avoid: Auto-refresh on product list pages (100+ simultaneous queries)
 *
 * **Caching Strategy**: 30-second auto-refresh balances freshness with server load.
 * For product lists, fetch counts once without auto-refresh or use batch endpoint.
 *
 * @todo Implement batch watch count endpoint for product lists
 * @todo Add WebSocket support for real-time updates on high-traffic products
 * @todo Monitor query frequency to prevent excessive polling
 *
 * @example
 * ```tsx
 * function ProductWatchBadge({ productId }: { productId: number }) {
 *   const { data: response, isLoading } = useWatchCount(productId);
 *
 *   if (isLoading) return <Skeleton width={60} />;
 *   const count = response?.data ?? 0;
 *
 *   return (
 *     <Badge variant="secondary">
 *       <EyeIcon className="mr-1 h-3 w-3" />
 *       {count} watching
 *     </Badge>
 *   );
 * }
 * ```
 */
export function useWatchCount(productId: number) {
  return useQuery<WatchCountResponse>({
    queryKey: [`/api/community/watch-count/${productId}`],
    queryFn: async () => {
      return apiRequest<WatchCountResponse>(`/api/community/watch-count/${productId}`);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Check if user is watching a product
 *
 * Fetches whether the authenticated user is currently watching a specific product.
 * Returns a boolean that can be used to toggle watch button states or show watch badges.
 *
 * @param productId - The ID of the product to check watch status for
 * @returns React Query result containing a boolean indicating watch status
 *
 * @remarks
 * **Current Behavior**: Fetches watch status once per product view, no auto-refresh.
 * This provides accurate watch state for conditional UI rendering (watch/unwatch buttons).
 *
 * **Performance Considerations**:
 * - ✅ Acceptable: Single product check (lightweight boolean query)
 * - ⚠️ Consider optimization: Multiple simultaneous checks (use batch endpoint)
 * - 🔴 Avoid: Polling for watch status changes (use WebSocket or query invalidation)
 *
 * **Caching Strategy**: Watch status is cached and invalidated when:
 * - User adds product to watch list (`useAddProductWatch` mutation)
 * - User removes product from watch list (`useRemoveProductWatch` mutation)
 * - This ensures UI always reflects latest watch state without polling
 *
 * **Authentication**: Returns `false` for unauthenticated users.
 *
 * @todo Implement batch watch status endpoint for product lists
 * @todo Add optimistic updates to improve perceived performance
 * @todo Consider adding WebSocket updates for multi-device watch sync
 *
 * @example
 * ```tsx
 * function WatchButton({ productId }: { productId: number }) {
 *   const { data: response, isLoading } = useIsWatching(productId);
 *   const addWatch = useAddProductWatch();
 *   const removeWatch = useRemoveProductWatch();
 *
 *   const isWatching = response?.data ?? false;
 *
 *   const handleToggle = () => {
 *     if (isWatching) {
 *       removeWatch.mutate(productId);
 *     } else {
 *       addWatch.mutate(productId);
 *     }
 *   };
 *
 *   return (
 *     <Button onClick={handleToggle} disabled={isLoading}>
 *       {isWatching ? 'Unwatch' : 'Watch'}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useIsWatching(productId: number) {
  return useQuery<IsWatchingResponse>({
    queryKey: [`/api/community/is-watching/${productId}`],
    queryFn: async () => {
      return apiRequest<IsWatchingResponse>(`/api/community/is-watching/${productId}`);
    },
  });
}

/**
 * Get most watched products across the community
 *
 * Fetches trending products based on total watch count from all users.
 * Results are sorted by popularity (most watches first) and limited to
 * the specified count.
 *
 * @param limit - Maximum number of products to return (default: 10)
 * @returns React Query result containing trending products with watch statistics
 *
 * @remarks
 * **Current Behavior**: Fetches top N products in a single request with 1-minute
 * auto-refresh. This provides real-time trending data for community features.
 *
 * **Performance Considerations**:
 * - ✅ Acceptable: Limits ≤50 products
 * - ⚠️ Consider optimization: Limits 50-100 products
 * - 🔴 Requires pagination: Limits >100 products
 *
 * **Caching Strategy**: Results auto-refresh every 60 seconds to keep
 * trending data current. Consider increasing interval if real-time updates
 * aren't critical for your use case.
 *
 * @todo Add caching layer for frequently requested limit values
 * @todo Consider implementing infinite scroll for large limit values
 * @todo Monitor query performance metrics to optimize auto-refresh interval
 *
 * @example
 * ```tsx
 * function TrendingProducts() {
 *   const { data: response, isLoading } = useMostWatchedProducts(20);
 *
 *   if (isLoading) return <Skeleton count={20} />;
 *   const trending = response?.data ?? [];
 *
 *   return (
 *     <div>
 *       <h2>Trending Products</h2>
 *       {trending.map((stat, index) => (
 *         <TrendingCard
 *           key={stat.productId}
 *           rank={index + 1}
 *           product={stat}
 *           watchCount={stat.watchCount}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMostWatchedProducts(limit = 10) {
  return useQuery<MostWatchedProductsResponse>({
    queryKey: ['/api/community/most-watched', limit],
    queryFn: async () => {
      return apiRequest<MostWatchedProductsResponse>(`/api/community/most-watched?limit=${limit}`);
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Get authenticated user's reputation score and badges
 *
 * @returns React Query result with reputation data and earned badges
 *
 * @remarks
 * **Performance**: Single small object, negligible overhead
 * **Auto-refresh**: Updates every 60 seconds
 *
 * @example
 * ```tsx
 * const { data: response } = useUserReputation();
 * const rep = response?.data;
 * return <Badge>{rep?.totalPoints} pts</Badge>;
 * ```
 */
export function useUserReputation() {
  return useQuery<UserReputationResponse>({
    queryKey: ['/api/community/reputation'],
    queryFn: async () => apiRequest<UserReputationResponse>('/api/community/reputation'),
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Get community leaderboard ranked by reputation
 *
 * @param limit - Max users to return (default: 10)
 * @returns React Query result with top-ranked users
 *
 * @remarks
 * **Performance**: ✅ Acceptable for limit ≤50
 * **Auto-refresh**: Updates every 2 minutes
 *
 * @example
 * ```tsx
 * const { data: response } = useLeaderboard(20);
 * return response?.data.map((entry, idx) => (
 *   <LeaderCard key={entry.userId} rank={idx + 1} {...entry} />
 * ));
 * ```
 */
export function useLeaderboard(limit = 10) {
  return useQuery<LeaderboardResponse>({
    queryKey: ['/api/community/leaderboard', limit],
    queryFn: async () =>
      apiRequest<LeaderboardResponse>(`/api/community/leaderboard?limit=${limit}`),
    refetchInterval: 120000, // Refresh every 2 minutes
  });
}

/**
 * Get recent deal spottings from the community
 *
 * Fetches the latest deals spotted by community members, sorted by most recent first.
 * Deal spottings include product details, price information, and the user who spotted it.
 *
 * @param limit - Maximum number of deals to return (default: 10)
 * @returns React Query result containing recent deal spottings
 *
 * @remarks
 * **Current Behavior**: Fetches top N recent deals in a single request with 1-minute
 * auto-refresh. This provides real-time community activity for deal discovery.
 *
 * **Performance Considerations**:
 * - ✅ Acceptable: Limits ≤50 deals
 * - ⚠️ Consider optimization: Limits 50-100 deals
 * - 🔴 Requires pagination: Limits >100 deals
 *
 * **Caching Strategy**: Results auto-refresh every 60 seconds to show latest
 * community activity. Each user may spot deals at different times, so fresh
 * data ensures users see the most current opportunities.
 *
 * @todo Add pagination support for browsing historical deals
 * @todo Consider implementing infinite scroll for deal browsing UI
 * @todo Monitor deal volume metrics to optimize auto-refresh interval
 *
 * @example
 * ```tsx
 * function RecentDealsSection() {
 *   const { data: response, isLoading } = useRecentDeals(15);
 *
 *   if (isLoading) return <Spinner />;
 *   const deals = response?.data ?? [];
 *
 *   return (
 *     <div>
 *       <h2>Latest Community Deals</h2>
 *       {deals.map((deal) => (
 *         <DealCard
 *           key={deal.id}
 *           product={deal.product}
 *           price={deal.price}
 *           spottedBy={deal.spottedBy}
 *           timestamp={deal.createdAt}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRecentDeals(limit = 10) {
  return useQuery<RecentDealsResponse>({
    queryKey: ['/api/community/recent-deals', limit],
    queryFn: async () =>
      apiRequest<RecentDealsResponse>(`/api/community/recent-deals?limit=${limit}`),
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * WATCH LIST MANAGEMENT HOOKS
 */

export interface WatchListWithStats extends WatchList {
  watchCount: number;
  highPriorityCount: number;
}

export type WatchListSharePermission = 'view' | 'edit';

export interface SharedWatchListWithStats extends WatchListWithStats {
  ownerUserId: number;
  ownerUsername: string;
  sharedPermission: WatchListSharePermission;
}

export interface WatchListProduct extends ProductWatch {
  productName?: string;
  productImage?: string;
}

/**
 * Response type for GET /api/watchlists/:id endpoint
 *
 * Represents the full watchlist object with metadata and associated products.
 * The server returns this complete structure, not just the products array.
 *
 * @remarks
 * This type reflects the actual API response structure from the server.
 * We extract the `products` field when using `useWatchListProducts()` hook.
 *
 * **Design Decision**: This differs from a hypothetical `/api/watchlists/:id/products`
 * endpoint (which doesn't exist) that would return products directly. The current
 * design allows reusing a single endpoint for both full watchlist data and just products.
 *
 * @see {@link useWatchListProducts} - Hook that extracts products from this response
 */
export interface WatchListApiResponse {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  products: WatchListProduct[];
}

// Create a new watch list
export function useCreateWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
    }) => {
      return apiRequest<WatchList>('/api/watchlists', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: async () => {
      // Refetch to get latest data from server (including the new watchlist)
      // Note: useWatchListUpdates() WebSocket hook also invalidates on 'created' events,
      // but refetchQueries() ensures immediate data availability for the component
      await queryClient.refetchQueries({ queryKey: ['/api/watchlists'] });
    },
  });
}

// Get all user's watch lists
export function useWatchLists() {
  return useQuery<WatchListWithStats[]>({
    queryKey: ['/api/watchlists'],
    queryFn: async () => {
      // API returns WatchListWithStats with watchCount and highPriorityCount already calculated
      const result = await apiRequest<{
        watchLists: WatchListWithStats[];
      }>('/api/watchlists');

      return result.watchLists;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useSharedWatchLists() {
  return useQuery<SharedWatchListWithStats[]>({
    queryKey: ['/api/watchlists/shared'],
    queryFn: async () => {
      // API returns SharedWatchListWithStats with watchCount and highPriorityCount already calculated
      const result = await apiRequest<{
        watchLists: SharedWatchListWithStats[];
      }>('/api/watchlists/shared');

      return result.watchLists;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useShareWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      watchListId: number;
      email: string;
      permission: WatchListSharePermission;
    }) => {
      return apiRequest<{
        shareId: number;
        sharedWithUserId: number;
        sharedWithUsername: string;
        permission: WatchListSharePermission;
      }>(`/api/watchlists/${data.watchListId}/shares`, {
        method: 'POST',
        body: JSON.stringify({ email: data.email, permission: data.permission }),
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['/api/watchlists/shared'] });
    },
  });
}

export function useRemoveProductFromWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { watchListId: number; productId: number }) => {
      return apiRequest<{ success: true }>(
        `/api/watchlists/${data.watchListId}/products/${data.productId}`,
        {
          method: 'DELETE',
        }
      );
    },
    onSuccess: async (_, { watchListId }) => {
      await queryClient.refetchQueries({ queryKey: ['/api/watchlists', watchListId, 'products'] });
      await queryClient.refetchQueries({ queryKey: ['/api/watchlists/shared'] });
      await queryClient.refetchQueries({ queryKey: ['/api/watchlists'] });
    },
  });
}

// Get a specific watch list with details
export function useWatchList(listId: number) {
  return useQuery<WatchListWithStats>({
    queryKey: ['/api/watchlists', listId],
    queryFn: async () => {
      return apiRequest<WatchListWithStats>(`/api/watchlists/${listId}`);
    },
    enabled: !!listId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Update a watch list
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Ownership validated - Server ensures user owns the watch list
 * @returns Mutation hook for updating watch list metadata
 */
export function useUpdateWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      updates,
    }: {
      listId: number;
      updates: {
        name?: string;
        description?: string | null;
        color?: string | null;
        icon?: string | null;
        sortOrder?: number;
      };
    }) => {
      return apiRequest<WatchList>(`/api/watchlists/${listId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, { listId }) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists', listId] });
    },
  });
}

/**
 * Delete a watch list
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Ownership validated - Server ensures user owns the watch list
 * @returns Mutation hook for deleting watch lists
 */
export function useDeleteWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId: number) => {
      return apiRequest<{ success: boolean }>(`/api/watchlists/${listId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
    },
  });
}

/**
 * Toggle public sharing for a watch list
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required
 */
export function useSetWatchListPublic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ watchListId, isPublic }: { watchListId: number; isPublic: boolean }) => {
      return apiRequest<{ isPublic: boolean; publicShareToken: string | null }>(
        `/api/watchlists/${watchListId}/public`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isPublic }),
        }
      );
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['/api/watchlists'] });
    },
  });
}

/**
 * Fetch a public watchlist by token (no auth)
 */
export function usePublicWatchList(token: string | null) {
  return useQuery<WatchListApiResponse>({
    queryKey: ['/api/watchlists/public', token],
    queryFn: async () => {
      if (!token) throw new Error('Missing token');
      return apiRequest<WatchListApiResponse>(`/api/watchlists/public/${token}`);
    },
    enabled: !!token,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Get products in a watch list
 *
 * Fetches the full watchlist from the server and extracts just the products array.
 * The server returns the complete `WatchListApiResponse` object, and this hook
 * provides a convenient way to access only the products.
 *
 * @param listId - The ID of the watchlist to fetch products for
 * @returns React Query result containing the products array
 *
 * @remarks
 * **Current Behavior**: Fetches all products in the watchlist in a single request.
 * This works well for typical watchlist sizes (1-50 products).
 *
 * **Performance Considerations**:
 * - ✅ Acceptable: Watchlists with <100 products
 * - ⚠️ Consider optimization: Watchlists with 100-500 products
 * - 🔴 Requires pagination: Watchlists with 500+ products
 *
 * @todo Add pagination support when watchlists exceed 100 products
 * @todo Consider implementing virtual scrolling for large product lists
 * @todo Monitor watchlist size metrics to determine pagination threshold
 *
 * @example
 * ```tsx
 * function WatchListProducts({ listId }: { listId: number }) {
 *   const { data: products, isLoading } = useWatchListProducts(listId);
 *
 *   if (isLoading) return <Spinner />;
 *   return (
 *     <div>
 *       {products?.map(product => (
 *         <ProductCard key={product.id} product={product} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWatchListProducts(listId: number) {
  return useQuery<WatchListProduct[]>({
    queryKey: ['/api/watchlists', listId, 'products'],
    queryFn: async () => {
      // Call the watchlist endpoint and extract products from the response
      const watchlist = await apiRequest<WatchListApiResponse>(`/api/watchlists/${listId}`);
      return watchlist.products;
    },
    enabled: !!listId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Update a product watch (category, notes, priority, target price, list)
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Ownership validated - Server ensures user owns the product watch
 * @returns Mutation hook for updating product watch metadata
 */
export function useUpdateProductWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      watchId,
      updates,
    }: {
      watchId: number;
      updates: {
        category?: string | null;
        notes?: string | null;
        priority?: number;
        targetPrice?: string | null;
        watchListId?: number | null;
      };
    }) => {
      return apiRequest<ProductWatch>(`/api/community/product-watches/${watchId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, { updates }) => {
      // Invalidate watch lists
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });

      // If moving to a different list, invalidate that list's products
      if (updates.watchListId !== undefined) {
        void queryClient.invalidateQueries({
          queryKey: ['/api/watchlists', updates.watchListId, 'products'],
        });
      }
    },
  });
}

/**
 * Add a product to a specific watch list
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Ownership validated - Server ensures user owns the watch list
 * @returns Mutation hook for adding products to watch lists
 */
export function useAddProductToWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, productId }: { listId: number; productId: number }) => {
      return apiRequest<ProductWatch>(`/api/watchlists/${listId}/products`, {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
    },
    onSuccess: (_, { listId, productId }) => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists', listId] });
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists', listId, 'products'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
      void queryClient.invalidateQueries({ queryKey: [`/api/community/watch-count/${productId}`] });
      void queryClient.invalidateQueries({ queryKey: [`/api/community/is-watching/${productId}`] });
    },
  });
}

/**
 * Move multiple products to a different watch list (bulk operation)
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Ownership validated - Server ensures user owns all product watches
 * @security Input validation - Server validates productWatchIds array and targetListId
 * @returns Mutation hook for bulk moving products between watch lists
 */
export function useMoveProductsToWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productWatchIds,
      targetListId,
    }: {
      productWatchIds: number[];
      targetListId: number | null;
    }) => {
      return apiRequest<{ success: boolean }>('/api/community/product-watches/bulk-move', {
        method: 'POST',
        body: JSON.stringify({ productWatchIds, targetListId }),
      });
    },
    onSuccess: () => {
      // Invalidate all watch list queries
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
    },
  });
}

/**
 * Remove multiple products from watch lists (bulk delete)
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Input validation - Server validates productWatchIds array
 * @returns Mutation hook for bulk deletion of product watches
 */
export function useBulkRemoveProductWatches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productWatchIds: number[]) => {
      return apiRequest<{ success: boolean }>('/api/community/product-watches/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ productWatchIds }),
      });
    },
    onSuccess: () => {
      // Invalidate all watch list queries
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/most-watched'] });
    },
  });
}

/**
 * Export watch lists as JSON file
 *
 * Fetches all user watch lists with products and downloads them as a JSON file.
 * This hook does NOT auto-fetch - it must be manually triggered via `refetch()`.
 *
 * @returns React Query result that triggers file download when refetched
 *
 * @remarks
 * **Current Behavior**: Manual trigger only (`enabled: false`). When refetch() is called:
 * 1. Fetches complete watchlist export from server
 * 2. Creates a JSON blob with formatted data
 * 3. Triggers browser download with timestamped filename
 *
 * **Performance Considerations**:
 * - ✅ Acceptable: Export <10 watchlists with <500 total products
 * - ⚠️ Consider optimization: Export 10-50 watchlists or 500-2000 products (may be slow)
 * - 🔴 Requires streaming: Export >50 watchlists or >2000 products (browser memory limits)
 *
 * **Download Behavior**:
 * - Filename format: `watchlists-YYYY-MM-DD.json` (ISO date)
 * - Download triggers immediately upon successful fetch
 * - No retry on failure (user must manually retry)
 *
 * @todo Add streaming export for large datasets (>2000 products)
 * @todo Consider adding export format options (JSON, CSV)
 * @todo Add progress indicator for large exports
 *
 * @example
 * ```tsx
 * function ExportButton() {
 *   const { refetch, isLoading } = useExportWatchLists();
 *
 *   const handleExport = async () => {
 *     try {
 *       await refetch();
 *       toast.success('Watchlists exported successfully');
 *     } catch (error) {
 *       toast.error('Export failed');
 *     }
 *   };
 *
 *   return (
 *     <Button onClick={() => void handleExport()} disabled={isLoading}>
 *       {isLoading ? 'Exporting...' : 'Export Watchlists'}
 *       <DownloadIcon className="ml-2 h-4 w-4" />
 *     </Button>
 *   );
 * }
 * ```
 */
export function useExportWatchLists() {
  return useQuery({
    queryKey: ['watchlists', 'export'],
    queryFn: async () => {
      // Fetch export data using apiRequest for consistency
      const data = await apiRequest<WatchListExportData>('/api/community/watch-lists/export');

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watchlists-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return data;
    },
    enabled: false, // Don't auto-fetch - only trigger manually via refetch()
    retry: false, // Don't retry download operations
  });
}

interface WatchListExportData {
  exportDate: string;
  userId: number;
  watchLists: Array<{
    name: string;
    description: string | null;
    color: string | null;
    icon: string | null;
    products: Array<{
      productId: number;
      productName?: string;
      category: string | null;
      notes: string | null;
      priority: number | null;
      targetPrice: string | null;
    }>;
  }>;
}

interface WatchListImportData {
  watchLists?: Array<{
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    products?: Array<{
      productId: number;
      notes?: string;
      priority?: number;
      targetPrice?: string;
    }>;
  }>;
  [key: string]: unknown;
}

/**
 * Import watch lists from JSON
 *
 * @security CSRF protected - Automatic via apiRequest()
 * @security Authentication required - Enforced by server withAuth middleware
 * @security Input validation - Server validates importData structure and user ownership
 * @returns Mutation hook for importing watch lists with created/skipped counts
 */
export function useImportWatchLists() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importData: WatchListImportData) => {
      return apiRequest<{ created: number; skipped: number }>('/api/community/watch-lists/import', {
        method: 'POST',
        body: JSON.stringify(importData),
      });
    },
    onSuccess: () => {
      // Invalidate all watch list queries
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
    },
  });
}
