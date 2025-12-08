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
