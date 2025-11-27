/**
 * Shared API Response Types
 *
 * Standardized response formats for all API endpoints.
 * Uses discriminated unions for type-safe response handling.
 */

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
export type ApiResponse<T> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse
  | ApiPaginatedResponse<T>;

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
export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is ApiErrorResponse {
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
