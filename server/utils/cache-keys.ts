/**
 * Cache Key Versioning System
 *
 * Centralized cache key generation with version support.
 * Increment CACHE_VERSION when making schema or serialization changes
 * that would make old cached data incompatible.
 *
 * Benefits:
 * - Prevents stale data issues after schema changes
 * - Single source of truth for cache key formats
 * - Easy cache invalidation via version bump
 * - Type-safe cache key generation
 *
 * When to Increment Version:
 * - Database schema changes affecting cached entities
 * - Changes to serialization format (e.g., JSON structure)
 * - Changes to what data is included in cached responses
 * - Breaking changes to TypeScript types in @shared/schema
 *
 * Usage Example:
 * ```typescript
 * import { CacheKeys } from './utils/cache-keys';
 *
 * // Get versioned cache key
 * const key = CacheKeys.PRODUCT.FULL(123);
 * // Returns: "product:full:v1:123"
 *
 * // After schema change, increment CACHE_VERSION to 2
 * // Old keys: "product:full:v1:123" (ignored)
 * // New keys: "product:full:v2:123" (fresh data)
 * ```
 */

/**
 * Current cache version - increment when schema changes
 *
 * Version History:
 * - v1: Initial implementation (2025-12-02)
 */
const CACHE_VERSION = 1;

/**
 * Cache key generators organized by entity type
 * Each generator function returns a versioned cache key
 */
export const CacheKeys = {
  /**
   * Product cache keys
   */
  PRODUCT: {
    /**
     * Full product data with offers (used by getProductById)
     * @param id - Product ID
     * @returns Versioned cache key: "product:full:v{version}:{id}"
     */
    FULL: (id: number) => `product:full:v${CACHE_VERSION}:${id}`,

    /**
     * Product search results (used by searchProducts)
     * @param hash - SHA-256 hash of search filters
     * @returns Versioned cache key: "product:search:v{version}:{hash}"
     */
    SEARCH: (hash: string) => `product:search:v${CACHE_VERSION}:${hash}`,

    /**
     * Pattern for invalidating all product caches
     * @returns Versioned pattern: "product:*:v{version}:*"
     */
    PATTERN: () => `product:*:v${CACHE_VERSION}:*`,
  },

  /**
   * Retailer cache keys
   */
  RETAILER: {
    /**
     * Single retailer data (used by getRetailerById)
     * @param id - Retailer ID
     * @returns Versioned cache key: "retailer:single:v{version}:{id}"
     */
    SINGLE: (id: number) => `retailer:single:v${CACHE_VERSION}:${id}`,

    /**
     * All retailers list (used by getAllRetailers)
     * @returns Versioned cache key: "retailer:all:v{version}"
     */
    ALL: () => `retailer:all:v${CACHE_VERSION}`,

    /**
     * Pattern for invalidating all retailer caches
     * @returns Versioned pattern: "retailer:*:v{version}*"
     */
    PATTERN: () => `retailer:*:v${CACHE_VERSION}*`,
  },

  /**
   * User cache keys
   */
  USER: {
    /**
     * Safe user data (no sensitive fields)
     * @param id - User ID
     * @returns Versioned cache key: "user:safe:v{version}:{id}"
     */
    SAFE: (id: number) => `user:safe:v${CACHE_VERSION}:${id}`,

    /**
     * Pattern for invalidating all user caches
     * @returns Versioned pattern: "user:*:v{version}:*"
     */
    PATTERN: () => `user:*:v${CACHE_VERSION}:*`,
  },
} as const;

/**
 * Get current cache version
 * Useful for debugging and logging
 */
export function getCurrentCacheVersion(): number {
  return CACHE_VERSION;
}

/**
 * Helper to invalidate all caches for a specific version
 * Use when migrating from one version to another
 *
 * @param version - Version to invalidate (default: current version)
 * @returns Pattern matching all keys for the version
 */
export function getVersionPattern(version: number = CACHE_VERSION): string {
  return `*:v${version}:*`;
}
