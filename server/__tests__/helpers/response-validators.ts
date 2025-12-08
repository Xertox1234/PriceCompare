import { expect } from 'vitest';
import { z } from 'zod';
import {
  successResponseSchema,
  errorResponseSchema,
  paginatedResponseSchema,
  assertSuccessResponse,
  assertErrorResponse,
  assertPaginatedResponse,
  validateSuccessResponse,
  validatePaginatedResponse,
  type ErrorResponse,
  type PaginatedResponse,
} from '../../utils/api-response-schemas';

/**
 * Test Helpers for Response Validation
 *
 * Reusable assertions and validators for route integration tests.
 * Ensures all responses follow standardized envelope format.
 *
 * Usage in route tests:
 * ```typescript
 * import { expectSuccessResponse, expectErrorResponse } from '../helpers/response-validators';
 *
 * it('should return product', async () => {
 *   const response = await request(app).get('/api/products/1');
 *   const product = expectSuccessResponse(response, 200);
 *   expect(product.id).toBe(1);
 * });
 * ```
 */

/**
 * Expect response to be a success response with correct status code
 *
 * @param response - Supertest response object
 * @param expectedStatus - Expected HTTP status code (default: 200)
 * @returns The data field from the response
 */
export function expectSuccessResponse<T = unknown>(
  response: { status: number; body: unknown },
  expectedStatus = 200
): T {
  // Check HTTP status
  expect(response.status).toBe(expectedStatus);

  // Validate envelope structure
  assertSuccessResponse(response.body);

  // Validate with Zod
  const validated = successResponseSchema.parse(response.body);

  // Type assertion: Zod validates envelope structure ({ success: true, data: unknown }),
  // but cannot infer the specific type T provided by the caller. The 'as T' cast is safe
  // because the caller is responsible for ensuring T matches the actual data structure.
  return validated.data as T;
}

/**
 * Expect response to be an error response with correct status code
 *
 * @param response - Supertest response object
 * @param expectedStatus - Expected HTTP status code
 * @param expectedErrorPattern - Optional regex or string to match error message
 * @returns The error response
 */
export function expectErrorResponse(
  response: { status: number; body: unknown },
  expectedStatus: number,
  expectedErrorPattern?: string | RegExp
): ErrorResponse {
  // Check HTTP status
  expect(response.status).toBe(expectedStatus);

  // Validate envelope structure
  assertErrorResponse(response.body);

  // Validate with Zod
  const validated = errorResponseSchema.parse(response.body);

  // Check error message pattern if provided
  if (expectedErrorPattern) {
    if (typeof expectedErrorPattern === 'string') {
      expect(validated.error).toContain(expectedErrorPattern);
    } else {
      expect(validated.error).toMatch(expectedErrorPattern);
    }
  }

  return validated;
}

/**
 * Expect response to be a paginated response
 *
 * @param response - Supertest response object
 * @param expectedStatus - Expected HTTP status code (default: 200)
 * @returns The paginated data and metadata
 */
export function expectPaginatedResponse<T = unknown>(
  response: { status: number; body: unknown },
  expectedStatus = 200
): { data: T[]; meta: PaginatedResponse['meta'] } {
  // Check HTTP status
  expect(response.status).toBe(expectedStatus);

  // Validate envelope structure
  assertPaginatedResponse(response.body);

  // Validate with Zod
  const validated = paginatedResponseSchema.parse(response.body);

  return {
    // Type assertion: Zod validates array structure but not item types.
    // The 'as T[]' cast is safe because caller provides the expected item type T.
    data: validated.data as T[],
    meta: validated.meta,
  };
}

/**
 * Expect response to be a success response with validated data schema
 *
 * @param response - Supertest response object
 * @param dataSchema - Zod schema for validating the data field
 * @param expectedStatus - Expected HTTP status code (default: 200)
 * @returns Validated and typed data
 */
export function expectValidatedResponse<T extends z.ZodTypeAny>(
  response: { status: number; body: unknown },
  dataSchema: T,
  expectedStatus = 200
): z.infer<T> {
  // Check HTTP status
  expect(response.status).toBe(expectedStatus);

  // Validate envelope and data
  return validateSuccessResponse(response.body, dataSchema);
}

/**
 * Expect response to be a paginated response with validated items
 *
 * @param response - Supertest response object
 * @param itemSchema - Zod schema for validating array items
 * @param expectedStatus - Expected HTTP status code (default: 200)
 * @returns Validated items and metadata
 */
export function expectValidatedPaginatedResponse<T extends z.ZodTypeAny>(
  response: { status: number; body: unknown },
  itemSchema: T,
  expectedStatus = 200
): {
  items: z.infer<T>[];
  meta: PaginatedResponse['meta'];
} {
  // Check HTTP status
  expect(response.status).toBe(expectedStatus);

  // Validate envelope, items, and metadata
  return validatePaginatedResponse(response.body, itemSchema);
}

/**
 * Expect 201 Created response
 */
export function expectCreatedResponse<T = unknown>(response: { status: number; body: unknown }): T {
  return expectSuccessResponse<T>(response, 201);
}

/**
 * Expect 204 No Content response
 */
export function expectNoContentResponse(response: { status: number; body: unknown }): void {
  expect(response.status).toBe(204);
  // 204 responses should have no body or empty body
  if (response.body !== undefined) {
    expect(response.body).toEqual({});
  }
}

/**
 * Expect 400 Bad Request error
 */
export function expectBadRequestError(
  response: { status: number; body: unknown },
  errorPattern?: string | RegExp
): ErrorResponse {
  return expectErrorResponse(response, 400, errorPattern);
}

/**
 * Expect 401 Unauthorized error
 */
export function expectUnauthorizedError(
  response: { status: number; body: unknown },
  errorPattern?: string | RegExp
): ErrorResponse {
  return expectErrorResponse(response, 401, errorPattern);
}

/**
 * Expect 403 Forbidden error
 */
export function expectForbiddenError(
  response: { status: number; body: unknown },
  errorPattern?: string | RegExp
): ErrorResponse {
  return expectErrorResponse(response, 403, errorPattern);
}

/**
 * Expect 404 Not Found error
 */
export function expectNotFoundError(
  response: { status: number; body: unknown },
  errorPattern?: string | RegExp
): ErrorResponse {
  return expectErrorResponse(response, 404, errorPattern);
}

/**
 * Expect 409 Conflict error
 */
export function expectConflictError(
  response: { status: number; body: unknown },
  errorPattern?: string | RegExp
): ErrorResponse {
  return expectErrorResponse(response, 409, errorPattern);
}

/**
 * Expect 500 Internal Server Error
 */
export function expectInternalServerError(
  response: { status: number; body: unknown },
  errorPattern?: string | RegExp
): ErrorResponse {
  return expectErrorResponse(response, 500, errorPattern);
}

/**
 * Assert pagination metadata is valid
 */
export function expectValidPagination(meta: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}): void {
  expect(meta.page).toBeGreaterThanOrEqual(1);
  expect(meta.limit).toBeGreaterThanOrEqual(1);
  expect(meta.total).toBeGreaterThanOrEqual(0);
  expect(meta.totalPages).toBeGreaterThanOrEqual(0);

  // Verify totalPages calculation
  const expectedTotalPages = Math.ceil(meta.total / meta.limit) || 0;
  expect(meta.totalPages).toBe(expectedTotalPages);
}

/**
 * Assert response envelope structure without Zod
 * Useful for quick checks when schema validation isn't needed
 */
export function expectEnvelopeStructure(
  response: { body: unknown },
  type: 'success' | 'error'
): void {
  expect(response.body).toHaveProperty('success');
  expect(typeof (response.body as { success: unknown }).success).toBe('boolean');

  if (type === 'success') {
    expect((response.body as { success: boolean }).success).toBe(true);
    expect(response.body).toHaveProperty('data');
  } else {
    expect((response.body as { success: boolean }).success).toBe(false);
    expect(response.body).toHaveProperty('error');
    expect(typeof (response.body as { error: unknown }).error).toBe('string');
  }
}

/**
 * Common response schemas for typical API responses
 */

// Product schema
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});

// User schema (safe - no password)
export const safeUserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  username: z.string(),
  role: z.enum(['user', 'admin']),
  createdAt: z.string().optional(),
});

// Retailer schema
export const retailerSchema = z.object({
  id: z.number(),
  name: z.string(),
  website: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// Alert schema
export const alertSchema = z.object({
  id: z.number(),
  userId: z.number(),
  productId: z.number(),
  targetPrice: z.string(),
  isActive: z.boolean(),
  notifyForum: z.boolean().optional(),
  createdAt: z.string().optional(),
});
