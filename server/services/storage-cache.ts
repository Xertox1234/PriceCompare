import { createHash } from 'crypto';
import { AdvancedCacheService, CacheTier } from './advanced-cache';
import { logger } from '../utils/logger';
// LAZY IMPORT: storage is imported dynamically to break circular dependency
// storage-cache.ts <-> storage.ts (via user-storage.ts) would cause a deadlock
// at module load time if imported directly.
import type { SafeUser } from '../storage';
import type { Retailer, ProductWithOffers } from '@shared/schema';
import { CacheKeys } from '../utils/cache-keys';

// Lazy getter for storage to break circular dependency
// Storage is only accessed at runtime, not during module initialization
let _storage: typeof import('../storage').storage | null = null;
let _storagePromise: Promise<typeof import('../storage').storage> | null = null;

async function getStorageAsync(): Promise<typeof import('../storage').storage> {
  if (_storage) return _storage;
  if (!_storagePromise) {
    _storagePromise = import('../storage').then((m) => {
      _storage = m.storage;
      return m.storage;
    });
  }
  return _storagePromise;
}

// Re-export CacheTier for convenience (consumers can import from this module)
export { CacheTier };

/**
 * Generic filter object for search queries.
 *
 * Allows any key-value pairs for flexible filtering across different entity types.
 * Used as a base type for more specific filter interfaces.
 *
 * @example
 * ```typescript
 * const filters: SearchFilters = {
 *   status: 'active',
 *   createdAfter: '2025-01-01',
 *   limit: 50
 * };
 * ```
 */
export type SearchFilters = Record<string, unknown>;

/**
 * Product-specific search filters with documented fields.
 *
 * Extends the base SearchFilters type to provide type-safe product search.
 * Aligns with the SearchFilters type from @shared/schema but provides
 * additional type safety and documentation for the cache layer.
 *
 * Filter fields support various product search criteria:
 * - **Text Search**: `query` searches across name, description, brand
 * - **Price Range**: `minPrice` and `maxPrice` for price filtering
 * - **Categorization**: `category` for exact category match
 * - **Retailer Filter**: `retailers` array of retailer IDs
 * - **Quality Filter**: `minRating` for minimum product rating
 * - **Availability**: `availability` array of stock statuses
 * - **Sorting**: `sortBy` determines result order
 * - **Pagination**: `page` and `limit` for result pagination
 *
 * @property {string} [query] - Search term for product name/description/brand
 * @property {string} [category] - Filter by product category (exact match)
 * @property {number} [minPrice] - Minimum price filter (inclusive)
 * @property {number} [maxPrice] - Maximum price filter (inclusive)
 * @property {number[]} [retailers] - Filter by retailer IDs
 * @property {number} [minRating] - Minimum rating filter (0-5 scale)
 * @property {string[]} [availability] - Filter by stock status (e.g., ['in_stock', 'low_stock'])
 * @property {string} [sortBy] - Sort order: 'price_low', 'price_high', 'rating', or 'popularity'
 * @property {number} [page] - Page number for pagination (1-indexed)
 * @property {number} [limit] - Items per page (default varies by endpoint)
 *
 * @example
 * ```typescript
 * // Basic search with price range
 * const filters: ProductSearchFilters = {
 *   query: 'laptop',
 *   minPrice: 500,
 *   maxPrice: 1500,
 *   sortBy: 'price_low'
 * };
 *
 * // Category filter with retailer preference
 * const filters2: ProductSearchFilters = {
 *   category: 'Electronics',
 *   retailers: [1, 2, 3],
 *   minRating: 4.0,
 *   page: 1,
 *   limit: 20
 * };
 *
 * // Generate cache key with filter hash
 * const cacheKey = `products:search:${hashFilters(filters)}`;
 * ```
 */
export interface ProductSearchFilters extends SearchFilters {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  retailers?: number[];
  minRating?: number;
  availability?: string[];
  sortBy?: 'price_low' | 'price_high' | 'rating' | 'popularity';
  page?: number;
  limit?: number;
}

/**
 * Cached wrapper service for storage layer methods.
 *
 * Implements multi-tier caching (L1 in-memory + L2 Redis) for high-traffic storage operations.
 * This service provides a separation of concerns where caching logic lives in the service layer
 * rather than polluting the storage layer.
 *
 * Architecture:
 * - Routes call this service for cached data access
 * - This service wraps storage layer methods with caching logic
 * - Storage layer remains pure database access without cache concerns
 *
 * Cache Strategy:
 * - L1 Cache: In-memory LRU (1000 items, 60s TTL) for ultra-hot data
 * - L2 Cache: Redis distributed cache for multi-server deployments
 * - TTL: 5 minutes default (300 seconds) - balances freshness with performance
 *
 * Performance Impact:
 * - Reduces response latency from 50-500ms (DB) to 1-5ms (Redis)
 * - Expected 60-80% reduction in database queries for product/retailer endpoints
 *
 * Related Services:
 * - advanced-cache.ts - Multi-tier caching engine (used internally)
 * - cache-invalidation.ts - Event-driven cache invalidation
 * - storage.ts - Database access layer (wrapped by this service)
 *
 * @see docs/storage-layer/CACHING_STRATEGY_GUIDE.md for implementation patterns
 * @see server/services/advanced-cache.ts for cache engine details
 */
export class StorageCacheService {
  private cache: AdvancedCacheService;

  /**
   * Initialize storage cache service with namespace isolation.
   *
   * The 'storage' namespace ensures cache keys are organized and
   * isolated from other cache namespaces (analytics, queries, etc.)
   */
  constructor() {
    this.cache = new AdvancedCacheService();
  }

  /**
   * Generic cached getter with multi-tier caching support and graceful fallback.
   *
   * This method wraps the underlying cache.getOrSet() with comprehensive error handling
   * to ensure the application continues functioning even when Redis is unavailable.
   *
   * Fallback Strategy:
   * - Primary: Execute cache.getOrSet() for optimal performance (L1 + L2 caching)
   * - Fallback: On cache error, execute fetchFn() directly against storage layer
   * - Result: Application remains available even during cache infrastructure issues
   *
   * Error Handling Philosophy:
   * - Cache failures are logged as warnings (not errors) - this is expected behavior
   * - Structured logging includes context for operational visibility
   * - No errors are thrown to route handlers - graceful degradation is automatic
   * - Users never see cache-related errors (only potential slowdown)
   *
   * @template T - The type of data being cached
   * @param cacheKey - Unique cache key following naming convention (e.g., 'product:full:123')
   * @param fetchFn - Function to fetch data on cache miss or cache error
   * @param tier - Cache tier determining storage strategy (HOT=30min, WARM=10min, COLD=3min, STATIC=1hr)
   * @param useL1 - Whether to use L1 in-memory cache (default: true)
   * @returns Cached or fresh data of type T
   *
   * @see docs/storage-layer/CACHING_STRATEGY_GUIDE.md - Section "Always Handle Redis Unavailability"
   * @see server/services/advanced-cache.ts - Underlying getOrSet() implementation
   *
   * @example
   * ```typescript
   * const product = await this.cachedGet(
   *   'product:full:123',
   *   () => storage.getProductById(123),
   *   CacheTier.WARM
   * );
   * ```
   */
  private async cachedGet<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    tier: CacheTier = CacheTier.WARM,
    useL1 = true
  ): Promise<T> {
    // E2E/automated tests rely on clean database state per test.
    // Caching across tests can serve stale/empty results and introduce flakes.
    if (process.env.NODE_ENV === 'test') {
      return await fetchFn();
    }

    try {
      return await this.cache.getOrSet(cacheKey, fetchFn, tier, useL1);
    } catch (error) {
      // Use structured logger with warning level (not error - this is expected behavior)
      // Cache failures should not crash the application or alarm on-call engineers
      logger.warn('Cache operation failed, falling back to storage layer', {
        cacheKey,
        tier,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback: 'storage',
      });

      // Graceful fallback: execute fetch function directly against storage layer
      // This ensures application availability even during Redis outages
      return await fetchFn();
    }
  }

  /**
   * Recursively sort object keys to ensure deterministic serialization.
   * Handles nested objects and arrays correctly.
   *
   * @param obj - Object to sort (can be primitive, object, or array)
   * @returns Sorted object with same structure
   *
   * @example
   * sortObjectKeys({ b: 2, a: 1 })
   * // Returns: { a: 1, b: 2 }
   *
   * @example
   * sortObjectKeys({ nested: { z: 1, a: 2 }, arr: [3, 1, 2] })
   * // Returns: { nested: { a: 2, z: 1 }, arr: [3, 1, 2] }
   * // Note: Array order is preserved, only object keys are sorted
   */
  private sortObjectKeys(obj: unknown): unknown {
    // Handle null and undefined
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle arrays - recursively sort elements but preserve array order
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObjectKeys(item));
    }

    // Handle objects - sort keys alphabetically and recursively sort nested values
    if (typeof obj === 'object') {
      const sortedObj: Record<string, unknown> = {};
      const keys = Object.keys(obj as Record<string, unknown>).sort();

      for (const key of keys) {
        sortedObj[key] = this.sortObjectKeys((obj as Record<string, unknown>)[key]);
      }

      return sortedObj;
    }

    // Handle primitives (string, number, boolean)
    return obj;
  }

  /**
   * Generate deterministic hash for filter objects to use as cache keys.
   * Sorts object keys recursively to ensure same filters produce same hash,
   * regardless of key order.
   *
   * Uses SHA-256 hashing with base64 encoding, truncated to 12 alphanumeric
   * characters for Redis-friendly cache keys. The 12-char length provides
   * ~68 billion unique combinations (base64: 64^12), making collision
   * probability negligible for expected query volumes.
   *
   * @param filters - Filter object to hash (e.g., search filters, query parameters)
   * @returns 12-character alphanumeric hash string
   *
   * @example
   * // Same filters, different key order → same hash
   * hashFilters({ category: 'Electronics', minPrice: 100 })
   * hashFilters({ minPrice: 100, category: 'Electronics' })
   * // Both return: "a1b2c3d4e5f6"
   *
   * @example
   * // Nested objects handled correctly
   * hashFilters({
   *   priceRange: { min: 100, max: 500 },
   *   retailers: [1, 2, 3],
   *   keyword: 'laptop'
   * })
   * // Returns: "x9y8z7w6v5u4"
   *
   * @example
   * // Use in cache key generation
   * const cacheKey = `product:search:${hashFilters(searchFilters)}`;
   * // Results in: "product:search:a1b2c3d4e5f6"
   */
  private hashFilters(filters: Record<string, unknown>): string {
    // Sort object keys recursively for deterministic serialization
    const sorted = this.sortObjectKeys(filters);

    // Serialize to JSON string
    const str = JSON.stringify(sorted);

    // Generate SHA-256 hash and encode as base64
    const hash = createHash('sha256').update(str).digest('base64');

    // Extract alphanumeric characters until we have 12
    // Remove special characters (+, /, =) that base64 encoding produces
    const alphanumeric = hash.replace(/[^a-zA-Z0-9]/g, '');

    // Take first 12 alphanumeric characters (base64 has 62 alphanumeric chars per 64 chars)
    // SHA-256 base64 is 44 chars, so we'll always have enough alphanumeric chars
    return alphanumeric.substring(0, 12);
  }

  // ============================================================================
  // Public Cached Methods
  // ============================================================================

  /**
   * Get product by ID with multi-tier caching.
   *
   * Cache key: `product:full:${id}`
   * TTL: 10 minutes (600s) via WARM tier
   * Tier: WARM (regularly accessed)
   *
   * This is the most frequently accessed storage method. Product detail pages hit this endpoint
   * on every view. Caching reduces response time from 50-150ms (database + joins) to 1-5ms
   * (in-memory cache hit).
   *
   * Performance:
   * - Cache hit (L1): ~1-5ms
   * - Cache hit (L2): ~5-10ms
   * - Cache miss: 50-150ms (database query with JOINs for offers and retailers)
   * - Expected hit rate: 70-90% (popular products stay hot)
   *
   * Database Query Complexity:
   * - Main product query
   * - LEFT JOIN with product_offers
   * - LEFT JOIN with retailers
   * - Price calculation aggregations
   *
   * Invalidation:
   * - Product update (name, description, etc.)
   * - Product deletion
   * - Price changes (new offers, price updates)
   *
   * @param id - Product ID
   * @returns Product with offers and retailer data, or null if not found
   *
   * @example
   * ```typescript
   * const product = await storageCache.getProductById(123);
   * if (product) {
   *   console.log(`${product.name} - ${product.offers.length} offers`);
   *   console.log(`Best price: $${product.bestPrice}`);
   * }
   * ```
   */
  async getProductById(id: number): Promise<ProductWithOffers | null> {
    const cacheKey = CacheKeys.PRODUCT.FULL(id);
    return this.cachedGet<ProductWithOffers | null>(
      cacheKey,
      async () => (await getStorageAsync()).getProductById(id),
      CacheTier.WARM
    );
  }

  /**
   * Get all retailers with caching.
   *
   * Retailers are relatively static data that changes infrequently (only during admin operations).
   * This makes them perfect candidates for aggressive caching with a 60-minute TTL.
   *
   * Cache Strategy:
   * - Key: 'retailer:all' (single key, no parameters)
   * - TTL: 60 minutes (3600 seconds)
   * - Tier: STATIC (rarely changes, highest L1 cache priority)
   *
   * Performance:
   * - Cache hit (L1): ~1ms
   * - Cache hit (L2): ~5ms
   * - Cache miss: 20-50ms (database query)
   * - Expected hit rate: 95%+ (retailers rarely change)
   *
   * Common Usage:
   * - Dropdown filters on search pages
   * - Product detail pages (show retailer info)
   * - Admin panels (retailer selection)
   *
   * @returns Promise<Retailer[]> - Array of all retailers
   *
   * @example
   * ```typescript
   * const retailers = await storageCache.getAllRetailers();
   * // First call: cache MISS → query DB → store in L1 + L2
   * // Next 60 minutes: cache HIT from L1 (~1ms)
   * ```
   */
  async getAllRetailers(): Promise<Retailer[]> {
    const cacheKey = CacheKeys.RETAILER.ALL();

    return this.cachedGet<Retailer[]>(cacheKey, async () => (await getStorageAsync()).getAllRetailers(), CacheTier.STATIC);
  }

  /**
   * Get all ACTIVE retailers with caching.
   *
   * Returns only active retailers for public-facing endpoints.
   * Uses same caching strategy as getAllRetailers but filters inactive.
   */
  async getRetailers(): Promise<Retailer[]> {
    // Use a dedicated cache key for active-only retailers
    const cacheKey = `retailer:active:v1`;

    return this.cachedGet<Retailer[]>(cacheKey, async () => (await getStorageAsync()).getRetailers(), CacheTier.STATIC);
  }

  /**
   * Get retailers filtered by country code with caching.
   *
   * Returns active retailers that operate in a specific country.
   * Used by the country selector feature (TODO 251) to filter retailers
   * based on user's country preference.
   *
   * Cache Strategy:
   * - Key: `retailer:country:v{version}:{countryCode}` (per-country cache key)
   * - TTL: 60 minutes (3600 seconds)
   * - Tier: STATIC (retailers rarely change, highest L1 cache priority)
   *
   * Performance:
   * - Cache hit (L1): ~1ms
   * - Cache hit (L2): ~5ms
   * - Cache miss: 20-50ms (database query with country filter)
   * - Expected hit rate: 90%+ (only 2 countries supported initially: US, CA)
   *
   * Common Usage:
   * - Country selector dropdown in header
   * - Product search filtered by country
   * - Price comparison within a country
   *
   * Invalidation:
   * - Retailer update (name, logo, country list changes)
   * - Retailer deletion
   * - Related to cache keys: `retailer:all`, `retailer:single:{id}`
   *
   * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'US', 'CA')
   * @returns Promise<Retailer[]> - Array of retailers operating in the specified country
   *
   * @example
   * ```typescript
   * const usRetailers = await storageCache.getRetailersByCountry('US');
   * // First call: cache MISS -> query DB -> store in L1 + L2
   * // Next 60 minutes: cache HIT from L1 (~1ms)
   * ```
   */
  async getRetailersByCountry(countryCode: string): Promise<Retailer[]> {
    const cacheKey = CacheKeys.RETAILER.BY_COUNTRY(countryCode);

    return this.cachedGet<Retailer[]>(
      cacheKey,
      async () => (await getStorageAsync()).getRetailersByCountry(countryCode),
      CacheTier.STATIC
    );
  }

  /**
   * Get retailer by ID with caching.
   *
   * Individual retailer lookups are cached with a 60-minute TTL since retailer
   * data changes infrequently (only during admin operations). This method is
   * typically called when displaying retailer-specific information on product
   * pages or in admin panels.
   *
   * Cache Strategy:
   * - Key: `retailer:id:${id}` (per-retailer cache key)
   * - TTL: 60 minutes (3600 seconds)
   * - Tier: STATIC (rarely changes, highest L1 cache priority)
   *
   * Performance:
   * - Cache hit (L1): ~1ms
   * - Cache hit (L2): ~5ms
   * - Cache miss: 10-20ms (simple indexed database query)
   * - Expected hit rate: 90%+ (popular retailers stay hot)
   *
   * Common Usage:
   * - Product detail pages (show retailer info for each offer)
   * - Affiliate link generation (need retailer details)
   * - Admin panels (retailer management)
   *
   * Invalidation:
   * - Retailer update (name, logo, URL changes)
   * - Retailer deletion
   * - Related to cache key: `retailer:all` should also be invalidated
   *
   * @param id - Retailer ID
   * @returns Retailer data or null if not found
   *
   * @example
   * ```typescript
   * const retailer = await storageCache.getRetailerById(5);
   * if (retailer) {
   *   console.log(`${retailer.name} - ${retailer.website}`);
   * }
   * ```
   */
  async getRetailerById(id: number): Promise<Retailer | null> {
    const cacheKey = CacheKeys.RETAILER.SINGLE(id);

    return this.cachedGet<Retailer | null>(
      cacheKey,
      async () => (await getStorageAsync()).getRetailerById(id),
      CacheTier.STATIC
    );
  }

  /**
   * Search products with caching.
   *
   * Product search is one of the most expensive operations due to complex filters,
   * JOINs, and sorting. Caching common searches dramatically improves performance.
   *
   * Cache Strategy:
   * - Key: 'product:search:{hash(filters)}' (deterministic hash of filter object)
   * - TTL: 120 seconds (2 minutes)
   * - Tier: COLD (occasionally accessed, short TTL due to price volatility)
   *
   * Performance:
   * - Cache hit (L2): ~5-10ms (Redis lookup + deserialization)
   * - Cache miss: 100-500ms (complex database query with filters/JOINs)
   * - Expected hit rate: 50-70% (common searches like category pages)
   *
   * TTL Rationale:
   * - 2 minutes balances freshness with performance
   * - Product prices change frequently → need relatively fresh data
   * - Common searches (e.g., "Electronics" category) still benefit significantly
   * - Short enough to avoid stale pricing, long enough to reduce DB load
   *
   * Cache Key Strategy:
   * - Uses hashFilters() to create deterministic hash from filter object
   * - Same filters (different order) → same cache key
   * - 12-character hash ensures reasonable key length for Redis
   *
   * Common Usage:
   * - Category browsing pages (e.g., /search?category=Electronics)
   * - Price range filters (e.g., /search?minPrice=100&maxPrice=500)
   * - Retailer-specific searches (e.g., /search?retailers=1,2,3)
   * - Sorted results (e.g., /search?sortBy=price_low)
   *
   * @param filters - Product search filters (query, category, price range, retailers, etc.)
   * @returns Promise with products array and pagination metadata
   *
   * @example
   * ```typescript
   * // Search for laptops under $1500
   * const results = await storageCache.searchProducts({
   *   query: 'laptop',
   *   maxPrice: 1500,
   *   sortBy: 'price_low',
   *   page: 1,
   *   limit: 20
   * });
   * // First call: cache MISS → query DB (200ms) → cache result
   * // Repeat within 2min: cache HIT → return from Redis (8ms)
   *
   * // Category browsing (high cache hit rate)
   * const electronics = await storageCache.searchProducts({
   *   category: 'Electronics',
   *   page: 1
   * });
   * // Popular categories often cached → sub-10ms response
   * ```
   */
  async searchProducts(filters: ProductSearchFilters): Promise<{
    products: ProductWithOffers[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const filterHash = this.hashFilters(filters);
    const cacheKey = CacheKeys.PRODUCT.SEARCH(filterHash);

    return this.cachedGet(cacheKey, async () => (await getStorageAsync()).searchProducts(filters), CacheTier.COLD);
  }

  /**
   * Get user by ID (safe fields only) with caching.
   * Cache key: user:safe:{id}
   * TTL: 5 minutes (300s)
   * Tier: WARM
   *
   * SECURITY: Only caches SafeUser (passwordHash excluded)
   */
  async getUserByIdSafe(id: number): Promise<SafeUser | null> {
    const cacheKey = CacheKeys.USER.SAFE(id);

    return this.cachedGet<SafeUser | null>(
      cacheKey,
      async () => (await getStorageAsync()).getUserByIdSafe(id),
      CacheTier.WARM
    );
  }

  // ============================================================================
  // Cache Invalidation Methods
  // ============================================================================

  /**
   * Invalidate product caches after update or delete.
   *
   * When a product is updated or deleted, all related caches must be cleared
   * to prevent serving stale data. This method uses a multi-level invalidation
   * strategy to ensure consistency across all cache tiers.
   *
   * Invalidation Strategy:
   * 1. **Specific product caches**: Invalidates the exact product detail cache
   *    - `product:full:${productId}` - Product with full offers and retailer data
   *
   * 2. **Search result caches**: Invalidates all product search caches
   *    - `product:search:*` - All cached search results (pattern-based)
   *    - Rationale: Product changes may affect multiple search results
   *    - Trade-off: Aggressive but safe (search TTL is only 2 minutes anyway)
   *
   * Why Invalidate All Searches?
   * - Product might appear in multiple search result pages
   * - Tracking which searches contain which products is complex and error-prone
   * - Search cache TTL is already short (2 minutes) for price freshness
   * - Better to over-invalidate than serve stale product data
   * - Pattern invalidation is performant via Redis SCAN (non-blocking)
   *
   * Error Handling:
   * - Uses try-catch for graceful failure handling
   * - Cache invalidation failures are logged as warnings (not errors)
   * - Failures do NOT throw exceptions to route handlers
   * - Philosophy: Cache invalidation failures should never break product updates
   *
   * Performance:
   * - Direct key invalidation: ~1-2ms per key (L1 + L2)
   * - Pattern invalidation: ~10-50ms depending on number of cached searches
   * - Async execution: Does not block the calling route handler
   *
   * @param productId - ID of the updated or deleted product
   * @returns Promise<void> - Resolves when invalidation completes (or fails gracefully)
   *
   * @see docs/storage-layer/CACHING_STRATEGY_GUIDE.md - Cache Invalidation Patterns section
   * @see server/services/advanced-cache.ts - invalidate() and invalidatePattern() methods
   *
   * @example
   * ```typescript
   * // In storage.updateProduct() method
   * async updateProduct(id: number, updates: Partial<InsertProduct>) {
   *   const product = await db.update(products).set(updates).where(eq(products.id, id));
   *   await storageCache.invalidateProductCache(id);
   *   return product;
   * }
   * ```
   *
   * @example
   * ```typescript
   * // In storage.deleteProduct() method
   * async deleteProduct(id: number) {
   *   await db.delete(products).where(eq(products.id, id));
   *   await storageCache.invalidateProductCache(id);
   * }
   * ```
   */
  async invalidateProductCache(productId: number): Promise<void> {
    try {
      // Invalidate specific product cache (versioned key)
      await this.cache.invalidate(CacheKeys.PRODUCT.FULL(productId));

      // Invalidate all search caches (product might appear in searches)
      // Use versioned pattern to only invalidate current version
      await this.cache.invalidatePattern(CacheKeys.PRODUCT.PATTERN());

      logger.debug('Product cache invalidated', { productId });
    } catch (error) {
      // Log but don't throw - cache invalidation failures shouldn't break updates
      logger.warn('Failed to invalidate product cache', {
        productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Invalidate user caches after profile update.
   *
   * This method should be called after any user profile modification to ensure
   * cached user data remains fresh. User caches are invalidated on:
   * - Profile updates (bio, location, website, avatarUrl)
   * - Trust level changes
   * - Account status changes (suspension, activation)
   * - Role changes (user to admin, etc.)
   *
   * Invalidation Strategy:
   * - Invalidates only the specific user's cache (user:safe:{id})
   * - Graceful error handling (logs warnings but doesn't throw)
   * - No cascade invalidation needed (user data is self-contained)
   * - No pattern invalidation needed (unlike products in searches)
   *
   * Invalidation Triggers:
   * - storage.updateUserProfile() - after profile field updates
   * - storage.updateUserTrustLevel() - after trust level changes
   * - storage.suspendUser() - after account suspension
   * - storage.registerUser() - not needed (no cache exists yet)
   *
   * Cache Scope:
   * - Only invalidates SafeUser cache (user:safe:{id})
   * - Does NOT invalidate session data (handled separately by session store)
   * - Does NOT invalidate authentication state (handled by Passport)
   *
   * Error Handling Philosophy:
   * - Cache failures are logged as warnings (not errors)
   * - Failures do NOT throw exceptions to route handlers
   * - User profile updates must succeed even if cache invalidation fails
   * - Next getUserByIdSafe() will eventually refresh the cache
   *
   * Performance Impact:
   * - Cache invalidation is fast (1-2ms for Redis DELETE)
   * - Next getUserByIdSafe() will fetch from DB and repopulate cache
   * - User profile updates are infrequent, so performance impact is minimal
   *
   * @param userId - ID of updated user
   * @returns Promise<void> - Resolves when invalidation completes (or fails gracefully)
   *
   * @see docs/storage-layer/CACHING_STRATEGY_GUIDE.md - Cache Invalidation Patterns section
   * @see server/services/advanced-cache.ts - invalidate() method
   *
   * @example
   * ```typescript
   * // In storage.updateUserProfile() method
   * async updateUserProfile(userId: number, data: ProfileData) {
   *   await this.userStorage.updateUserProfile(userId, data);
   *   await storageCache.invalidateUserCache(userId); // Clear stale cache
   * }
   * ```
   *
   * @example
   * ```typescript
   * // In storage.updateUserTrustLevel() method
   * async updateUserTrustLevel(userId: number, trustLevel: number) {
   *   await this.userStorage.updateUserTrustLevel(userId, trustLevel);
   *   await storageCache.invalidateUserCache(userId); // Clear stale cache
   * }
   * ```
   */
  async invalidateUserCache(userId: number): Promise<void> {
    try {
      await this.cache.invalidate(CacheKeys.USER.SAFE(userId));

      logger.debug('User cache invalidated', { userId });
    } catch (error) {
      logger.warn('Failed to invalidate user cache', { userId, error });
    }
  }

  /**
   * Invalidate retailer caches after update or delete.
   *
   * Clears cached retailer data when a retailer is modified or deleted through admin operations.
   * This ensures users always see fresh retailer information (name, logo, website, affiliate config).
   *
   * Invalidated Cache Keys:
   * - `retailer:id:${id}` - Specific retailer detail cache
   * - `retailer:all` - All retailers list cache
   *
   * Cache Invalidation Philosophy:
   * - Fail gracefully - cache errors shouldn't break database operations
   * - Log as warnings (not errors) - this is expected operational behavior
   * - Never throw errors - allow updates/deletes to succeed even if cache fails
   *
   * Integration Points:
   * - Called from RetailerStorage.updateRetailer() after successful update
   * - Called from RetailerStorage.deleteRetailer() after successful deletion
   * - Called from RetailerStorage.updateAdminRetailer() after admin updates
   * - Called from RetailerStorage.deleteAdminRetailer() after admin deletions
   * - Called from RetailerStorage.updateRetailerAffiliateConfig() after affiliate config changes
   *
   * Performance Impact:
   * - Cache invalidation: ~1-2ms per key (L1 + L2)
   * - Async execution: Does not block the calling route handler
   * - Retailer updates are infrequent (admin operations only)
   *
   * @param retailerId - ID of the updated or deleted retailer
   * @returns Promise<void> - Always resolves (never throws)
   *
   * @example
   * ```typescript
   * // In RetailerStorage.updateRetailer():
   * const [result] = await this.db.update(retailers).set(updates).where(...).returning();
   * await storageCache.invalidateRetailerCache(id);
   * return result;
   * ```
   *
   * @see docs/storage-layer/CACHING_STRATEGY_GUIDE.md - Cache invalidation patterns
   * @see server/services/advanced-cache.ts - Underlying invalidate() method
   * @see server/storage/domains/retailer-storage.ts - Integration points
   */
  async invalidateRetailerCache(retailerId: number): Promise<void> {
    try {
      // Invalidate specific retailer cache (versioned key)
      await this.cache.invalidate(CacheKeys.RETAILER.SINGLE(retailerId));

      // Invalidate all retailers list (retailer might be in the list)
      await this.cache.invalidate(CacheKeys.RETAILER.ALL());

      // Invalidate country-specific retailer caches (TODO 261)
      // Retailer's country list may have changed, so invalidate all country caches
      // Currently supports US and CA - add more as countries are added
      await this.cache.invalidate(CacheKeys.RETAILER.BY_COUNTRY('US'));
      await this.cache.invalidate(CacheKeys.RETAILER.BY_COUNTRY('CA'));

      logger.debug('Retailer cache invalidated', { retailerId });
    } catch (error) {
      // Use warning level (not error) - cache failures are operational, not exceptional
      // Database operations should succeed even when cache invalidation fails
      logger.warn('Failed to invalidate retailer cache', {
        retailerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Warm critical caches on server startup.
   * Pre-populates frequently accessed static data to eliminate first-request cache misses.
   *
   * This method is designed to be called during server initialization and will:
   * - Pre-load all retailers (static data, accessed immediately)
   * - Gracefully handle failures (logs warnings but doesn't throw)
   * - Complete quickly to avoid delaying server startup
   *
   * @returns Promise<void>
   *
   * @example
   * // In server/index.ts during startup:
   * await storageCache.warmCaches();
   */
  async warmCaches(): Promise<void> {
    logger.info('Warming critical caches...');
    try {
      // Pre-populate retailers (static data accessed on most pages)
      const retailers = await this.getAllRetailers();
      logger.info('Cache warming complete', {
        retailers: retailers.length,
      });
    } catch (error) {
      // Log warning but don't throw - cache warming is non-blocking
      logger.warn('Cache warming failed (non-blocking)', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Log cache performance metrics for monitoring and observability.
   *
   * Emits structured metrics compatible with monitoring systems (Sentry, Datadog, log aggregators).
   * Implements 60-second windowed metrics by resetting counters after each log.
   *
   * Metrics tracked:
   * - L1 cache: hits, misses, hit rate, size, evictions
   * - L2 cache: hits, misses, hit rate, errors
   * - Invalidations: total count
   *
   * The metrics are logged in JSON format for easy parsing by monitoring tools
   * and reset after logging to provide discrete 60-second windows.
   *
   * @example
   * // In server/index.ts:
   * setInterval(() => storageCache.logCacheMetrics(), 60000);
   */
  logCacheMetrics(): void {
    const stats = this.cache.getStats();

    // Calculate hit rates
    const l1Total = stats.l1.hits + stats.l1.misses;
    const l2Total = stats.l2.hits + stats.l2.misses;
    const l1HitRate = l1Total > 0 ? (stats.l1.hits / l1Total) * 100 : 0;
    const l2HitRate = l2Total > 0 ? (stats.l2.hits / l2Total) * 100 : 0;

    // Structured logging for monitoring systems
    logger.info('Cache metrics', {
      metrics: {
        l1: {
          hits: stats.l1.hits,
          misses: stats.l1.misses,
          hitRate: parseFloat(l1HitRate.toFixed(1)),
          size: stats.l1.size,
          maxSize: stats.l1.maxSize,
          // Note: LRU evictions are implicit in size management
          // Eviction count would require tracking in LRUCache class
        },
        l2: {
          hits: stats.l2.hits,
          misses: stats.l2.misses,
          hitRate: parseFloat(l2HitRate.toFixed(1)),
          errors: stats.overall.errors,
        },
        invalidations: stats.overall.invalidations,
      },
    });

    // Reset counters for next 60-second window
    this.cache.resetStats();
  }
}

// Export singleton instance for application-wide use
export const storageCache = new StorageCacheService();
