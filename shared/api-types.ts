/**
 * Shared API Response Types
 *
 * Standardized response formats for all API endpoints.
 * Uses discriminated unions for type-safe response handling.
 *
 * IMPORTANT NOTES:
 * - Discriminated union pattern: check 'success' field for type narrowing
 * - All prices are strings to match Decimal type mapping
 * - Follows RFC 7807 / RFC 9457 standards for error responses
 *
 * Phase 1: Foundation - Created for Issue #147 (API Standardization)
 */

/**
 * Response metadata included in all responses
 */
export interface ApiResponseMeta {
  timestamp: string;
  version: string;
  requestId?: string;
}

/**
 * Pagination metadata for paginated responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore?: boolean;
  nextPage?: number | null;
  prevPage?: number | null;
}

/**
 * Success response with data
 * Used when operation succeeds and returns data
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiResponseMeta;
}

/**
 * Error response
 * Used when operation fails
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: string; // Development-only error details
}

/**
 * Paginated success response
 * Used for list endpoints with pagination
 */
export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

/**
 * Discriminated union of all possible API responses
 * The 'success' field acts as the discriminator
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse | ApiPaginatedResponse<T>;

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> | ApiPaginatedResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Type guard to check if response is paginated
 */
export function isPaginatedResponse<T>(
  response: ApiResponse<T>
): response is ApiPaginatedResponse<T> {
  return response.success === true && 'meta' in response;
}

/**
 * Extract data from API response with type narrowing
 * Throws error if response is not successful
 */
export function unwrapApiResponse<T>(response: ApiResponse<T>): T | T[] {
  if (isErrorResponse(response)) {
    throw new Error(response.error);
  }

  if (isPaginatedResponse(response)) {
    return response.data;
  }

  return response.data;
}

/**
 * Helper type to infer data type from API response
 */
export type InferApiData<T> = T extends ApiResponse<infer D> ? D : never;

/**
 * Generic wrapper for list responses with count metadata
 *
 * Used when API returns an array of items along with a count.
 * Common for endpoints that filter/search but don't use pagination.
 *
 * @example
 * ```typescript
 * // API returns: { data: [...items], count: 42 }
 * useQuery<ListResponse<Product>>({
 *   queryFn: () => apiRequest<ListResponse<Product>>('/api/products/search')
 * });
 * ```
 */
export interface ListResponse<T> {
  data: T[];
  count: number;
}

/**
 * Generic wrapper for single object responses
 *
 * Used when API returns a single object wrapped in a data field.
 * Provides consistent typing for individual resource endpoints.
 *
 * @example
 * ```typescript
 * // API returns: { data: { id: 1, name: "..." } }
 * useQuery<DataResponse<User>>({
 *   queryFn: () => apiRequest<DataResponse<User>>('/api/users/1')
 * });
 * ```
 */
export interface DataResponse<T> {
  data: T;
}

// =============================================================================
// Price History Type Guards and Validation
// =============================================================================

/**
 * Price history entry from API responses
 *
 * Note: price is a string because PostgreSQL decimal types map to strings
 * in Drizzle ORM to preserve precision.
 */
export interface PriceHistoryEntry {
  id: number;
  productOfferId: number;
  productId: number;
  retailerId: number;
  price: string;
  originalPrice?: string | null;
  availability?: string | null;
  rating?: string | null;
  reviewCount?: number | null;
  source?: string | null;
  confidence?: string | null;
  metadata?: string | null;
  recordedAt: string | Date;
  aggregatedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

/**
 * Type guard to check if an unknown value is a valid PriceHistoryEntry
 *
 * Validates essential fields required for chart rendering:
 * - id (number)
 * - price (string - will be parsed to number)
 * - recordedAt (string or Date - required for time series)
 *
 * @param data - Unknown value to validate
 * @returns True if data is a valid PriceHistoryEntry
 *
 * @example
 * ```typescript
 * const entries = apiResponse.data;
 * const validEntries = entries.filter(isPriceHistoryEntry);
 * ```
 */
export function isPriceHistoryEntry(data: unknown): data is PriceHistoryEntry {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const entry = data as Record<string, unknown>;

  // Required fields (matches database schema: all these are NOT NULL)
  if (typeof entry.id !== 'number' || entry.id <= 0) return false;
  if (typeof entry.productOfferId !== 'number' || entry.productOfferId <= 0) return false;
  if (typeof entry.productId !== 'number' || entry.productId <= 0) return false;
  if (typeof entry.retailerId !== 'number' || entry.retailerId <= 0) return false;

  // Price must be a string (Decimal type in DB) and parseable as a valid number
  if (typeof entry.price !== 'string') return false;
  const priceNum = parseFloat(entry.price);
  if (isNaN(priceNum) || priceNum < 0) return false;

  // recordedAt is required (NOT NULL in schema)
  if (entry.recordedAt === undefined || entry.recordedAt === null) return false;
  if (typeof entry.recordedAt !== 'string' && !(entry.recordedAt instanceof Date)) {
    return false;
  }

  return true;
}

/**
 * Type guard to check if a value is an array of valid PriceHistoryEntry objects
 *
 * @param data - Unknown value to validate
 * @returns True if data is an array of valid PriceHistoryEntry objects
 */
export function isPriceHistoryArray(data: unknown): data is PriceHistoryEntry[] {
  if (!Array.isArray(data)) {
    return false;
  }

  // For performance, only validate first few entries for large arrays
  const samplesToCheck = Math.min(data.length, 5);
  for (let i = 0; i < samplesToCheck; i++) {
    if (!isPriceHistoryEntry(data[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Price history API response structure
 */
export interface PriceHistoryApiResponse {
  data: PriceHistoryEntry[];
  count: number;
}

/**
 * Type guard to validate PriceHistoryApiResponse structure
 *
 * @param response - Unknown API response to validate
 * @returns True if response matches expected structure
 */
export function isPriceHistoryApiResponse(response: unknown): response is PriceHistoryApiResponse {
  if (typeof response !== 'object' || response === null) {
    return false;
  }

  const resp = response as Record<string, unknown>;

  if (!Array.isArray(resp.data)) return false;
  if (typeof resp.count !== 'number') return false;

  // Validate data array contents
  return isPriceHistoryArray(resp.data);
}

/**
 * Chart data point interface for transformed price data
 */
export interface ChartPriceDataPoint {
  id: number;
  productId: number;
  retailerId: number;
  retailerName: string;
  retailerLogo: string | null;
  price: string;
  recordedAt: Date | string;
}

/**
 * Type guard for chart price data points
 *
 * Validates all required fields for chart rendering:
 * - id, productId, retailerId: positive numbers
 * - retailerName: non-empty string
 * - price: parseable string representing valid number >= 0
 * - recordedAt: string (ISO date) or Date object
 *
 * @param data - Unknown value to validate
 * @returns True if data is a valid ChartPriceDataPoint
 */
export function isChartPriceDataPoint(data: unknown): data is ChartPriceDataPoint {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const point = data as Record<string, unknown>;

  // Required numeric fields (all must be positive)
  if (typeof point.id !== 'number' || point.id <= 0) return false;
  if (typeof point.productId !== 'number' || point.productId <= 0) return false;
  if (typeof point.retailerId !== 'number' || point.retailerId <= 0) return false;

  // retailerName is required for chart display
  if (typeof point.retailerName !== 'string' || point.retailerName.length === 0) return false;

  // Price must be parseable as a valid non-negative number
  if (typeof point.price !== 'string') return false;
  const priceNum = parseFloat(point.price);
  if (isNaN(priceNum) || priceNum < 0) return false;

  // recordedAt must exist and be valid
  if (point.recordedAt === undefined || point.recordedAt === null) return false;
  if (typeof point.recordedAt !== 'string' && !(point.recordedAt instanceof Date)) {
    return false;
  }

  return true;
}

/**
 * Safely parse a price string to a number
 *
 * @param price - Price value (string or unknown)
 * @param fallback - Fallback value if parsing fails (default: 0)
 * @returns Parsed price as number, or fallback if invalid
 *
 * @example
 * ```typescript
 * const numericPrice = safeParsePriceToNumber(entry.price);
 * const priceWithDefault = safeParsePriceToNumber(entry.price, -1);
 * ```
 */
export function safeParsePriceToNumber(price: unknown, fallback = 0): number {
  if (typeof price === 'number') {
    return isNaN(price) ? fallback : price;
  }

  if (typeof price !== 'string') {
    return fallback;
  }

  const parsed = parseFloat(price);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Validate and filter an array of price history entries
 *
 * Filters out invalid entries and returns the count of invalid entries.
 * Use this at API boundaries to ensure data integrity.
 *
 * @param data - Array of unknown data to validate
 * @returns Object containing validated entries and count of invalid entries
 */
export function validatePriceHistoryEntries(data: unknown[]): PriceHistoryEntry[] {
  const validEntries: PriceHistoryEntry[] = [];

  for (const entry of data) {
    if (isPriceHistoryEntry(entry)) {
      validEntries.push(entry);
    }
  }

  return validEntries;
}

/**
 * Validate price history entries with detailed diagnostics
 *
 * Returns both valid entries and information about invalid entries for logging.
 *
 * @param data - Array of unknown data to validate
 * @returns Object with validated entries and invalid entry details
 */
export function validatePriceHistoryEntriesWithDiagnostics(data: unknown[]): {
  validEntries: PriceHistoryEntry[];
  invalidCount: number;
  firstInvalidSamples: unknown[];
} {
  const validEntries: PriceHistoryEntry[] = [];
  const firstInvalidSamples: unknown[] = [];

  for (const entry of data) {
    if (isPriceHistoryEntry(entry)) {
      validEntries.push(entry);
    } else if (firstInvalidSamples.length < 3) {
      firstInvalidSamples.push(entry);
    }
  }

  return {
    validEntries,
    invalidCount: data.length - validEntries.length,
    firstInvalidSamples,
  };
}
