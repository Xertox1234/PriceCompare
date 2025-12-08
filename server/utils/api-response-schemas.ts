import { z } from 'zod';

/**
 * Zod Schemas for API Response Validation
 *
 * Runtime validation schemas for standardized API responses.
 * Use these in tests to ensure responses match expected format.
 *
 * Usage:
 * ```typescript
 * import { successResponseSchema, errorResponseSchema } from './api-response-schemas';
 *
 * // In tests
 * const result = successResponseSchema.parse(response.body);
 * expect(result.success).toBe(true);
 * expect(result.data).toBeDefined();
 * ```
 */

/**
 * Pagination metadata schema
 */
export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasMore: z.boolean().optional(),
  nextPage: z.number().int().positive().nullable().optional(),
  prevPage: z.number().int().positive().nullable().optional(),
});

/**
 * API response metadata schema
 */
export const apiResponseMetaSchema = z.object({
  timestamp: z.string().datetime(),
  version: z.string(),
  requestId: z.string().optional(),
});

/**
 * Success response schema (generic)
 * Use with .extend() to add specific data validation
 */
export const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.unknown(), // Can be refined with specific schemas
  meta: apiResponseMetaSchema.optional(),
});

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1),
  details: z.string().optional(), // Only in development
});

/**
 * Paginated response schema (generic)
 * Use with .extend() to add specific data validation
 */
export const paginatedResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(z.unknown()), // Can be refined with specific item schemas
  meta: paginationMetaSchema,
});

/**
 * Union of all response types for discriminated union validation
 */
export const apiResponseSchema = z.discriminatedUnion('success', [
  successResponseSchema,
  errorResponseSchema,
]);

/**
 * Type-safe response validators with specific data schemas
 */

/**
 * Create a success response validator with specific data schema
 *
 * @example
 * const productSchema = z.object({ id: z.number(), name: z.string() });
 * const productResponseValidator = createSuccessValidator(productSchema);
 * const validated = productResponseValidator.parse(response.body);
 */
export function createSuccessValidator<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: apiResponseMetaSchema.optional(),
  });
}

/**
 * Create a paginated response validator with specific item schema
 *
 * @example
 * const productSchema = z.object({ id: z.number(), name: z.string() });
 * const productsValidator = createPaginatedValidator(productSchema);
 * const validated = productsValidator.parse(response.body);
 */
export function createPaginatedValidator<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: paginationMetaSchema,
  });
}

/**
 * Common data schemas for typical responses
 */

// Generic ID-based resource
export const idResourceSchema = z.object({
  id: z.number().int().positive(),
});

// Success message
export const successMessageSchema = z.object({
  message: z.string(),
});

// Created resource with ID
export const createdResourceSchema = z.object({
  id: z.number().int().positive(),
  createdAt: z.string().datetime().optional(),
});

/**
 * Validators for common response patterns
 */

// Success with message
export const successMessageResponseValidator = createSuccessValidator(successMessageSchema);

// Success with ID
export const idResponseValidator = createSuccessValidator(idResourceSchema);

// Success with created resource
export const createdResourceValidator = createSuccessValidator(createdResourceSchema);

/**
 * Test helpers
 */

/**
 * Assert response is a success response
 */
export function assertSuccessResponse(
  response: unknown
): asserts response is { success: true; data: unknown } {
  const result = successResponseSchema.safeParse(response);
  if (!result.success) {
    throw new Error(
      `Expected success response, got: ${JSON.stringify(result.error.issues, null, 2)}`
    );
  }
}

/**
 * Assert response is an error response
 */
export function assertErrorResponse(
  response: unknown
): asserts response is { success: false; error: string } {
  const result = errorResponseSchema.safeParse(response);
  if (!result.success) {
    throw new Error(
      `Expected error response, got: ${JSON.stringify(result.error.issues, null, 2)}`
    );
  }
}

/**
 * Assert response is paginated
 */
export function assertPaginatedResponse(response: unknown): asserts response is {
  success: true;
  data: unknown[];
  meta: z.infer<typeof paginationMetaSchema>;
} {
  const result = paginatedResponseSchema.safeParse(response);
  if (!result.success) {
    throw new Error(
      `Expected paginated response, got: ${JSON.stringify(result.error.issues, null, 2)}`
    );
  }
}

/**
 * Validate response matches expected format and return typed data
 *
 * @example
 * const product = validateSuccessResponse(response.body, productSchema);
 * // product is now typed as Product
 */
export function validateSuccessResponse<T extends z.ZodTypeAny>(
  response: unknown,
  dataSchema: T
): z.infer<T> {
  const validator = createSuccessValidator(dataSchema);
  const result = validator.parse(response) as { success: true; data: z.infer<T> };
  return result.data;
}

/**
 * Validate paginated response and return typed items
 */
export function validatePaginatedResponse<T extends z.ZodTypeAny>(
  response: unknown,
  itemSchema: T
): {
  items: z.infer<T>[];
  meta: z.infer<typeof paginationMetaSchema>;
} {
  const validator = createPaginatedValidator(itemSchema);
  const result = validator.parse(response);
  return {
    items: result.data,
    meta: result.meta,
  };
}

/**
 * Type exports for use in tests
 */
export type SuccessResponse<T = unknown> = z.infer<typeof successResponseSchema> & { data: T };
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type PaginatedResponse<T = unknown> = z.infer<typeof paginatedResponseSchema> & {
  data: T[];
};
export type ApiResponse = z.infer<typeof apiResponseSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type ApiResponseMeta = z.infer<typeof apiResponseMetaSchema>;
