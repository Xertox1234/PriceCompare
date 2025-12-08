/**
 * Application-wide constants
 * Centralized location for magic values to improve maintainability
 */

// ============================================================================
// UI Configuration
// ============================================================================

/**
 * Maximum number of toast notifications that can be displayed at once
 */
export const TOAST_LIMIT = 1;

/**
 * Delay in milliseconds before a toast is automatically removed
 * Current value: ~16.67 minutes (1,000,000ms)
 */
export const TOAST_REMOVE_DELAY = 1_000_000;

/**
 * Maximum number of products that can be added to comparison
 */
export const MAX_COMPARISON_ITEMS = 4;

// ============================================================================
// Cache & Performance Configuration
// ============================================================================

/**
 * React Query cache times in milliseconds
 * Used for controlling how long data is considered "fresh" and when it should be garbage collected
 */
export const CACHE_TIME = {
  /** 2 minutes - for frequently changing data */
  SHORT: 2 * 60 * 1000,
  /** 5 minutes - for moderately stable data */
  MEDIUM: 5 * 60 * 1000,
  /** 10 minutes - for stable data */
  LONG: 10 * 60 * 1000,
  /** 15 minutes - for rarely changing data */
  VERY_LONG: 15 * 60 * 1000,
  /** 30 minutes - for garbage collection */
  GC_TIME: 30 * 60 * 1000,
} as const;

/**
 * Debounce delays in milliseconds
 */
export const DEBOUNCE_DELAY = {
  /** 200ms - for search suggestions */
  FAST: 200,
  /** 300ms - for standard search/filter inputs */
  STANDARD: 300,
  /** 500ms - for expensive operations */
  SLOW: 500,
} as const;

// ============================================================================
// Asset URLs
// ============================================================================

/**
 * Default fallback image for products without images
 */
export const DEFAULT_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=300&fit=crop';

/**
 * Hero section background image
 */
export const HERO_BACKGROUND_IMAGE =
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1920&h=700&fit=crop';

// ============================================================================
// Feature Flags & Limits
// ============================================================================

/**
 * Number of skeleton loaders to show when loading products
 */
export const PRODUCT_SKELETON_COUNT = 6;

/**
 * Minimum number of products to show "Load More" button
 */
export const LOAD_MORE_THRESHOLD = 6;

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Type-safe cache time keys
 */
export type CacheTimeKey = keyof typeof CACHE_TIME;

/**
 * Type-safe debounce delay keys
 */
export type DebounceDelayKey = keyof typeof DEBOUNCE_DELAY;
