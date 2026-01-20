/**
 * JSON Parsing Utilities
 *
 * Provides safe JSON parsing with error handling and optional Zod schema validation.
 * Prevents uncaught exceptions from malformed JSON strings.
 *
 * Pattern: Graceful Degradation (docs/06_ERROR_HANDLING_PATTERNS.md)
 * - Parse failures return discriminated union with success: false
 * - Errors logged with structured context
 * - No crashes from malformed JSON
 */

import type { ZodSchema } from 'zod';
import { logger } from './logger';

/**
 * Discriminated union result type for safe JSON parsing
 */
export type ParseResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Safely parse JSON string with optional Zod schema validation
 *
 * @param jsonString - JSON string to parse
 * @param context - Context for error logging (e.g., "RetailerStorage.getRetailers")
 * @param schema - Optional Zod schema for validation
 * @returns ParseResult with success flag and data or error message
 *
 * @example
 * // Without schema validation
 * const result = safeJsonParse<Record<string, unknown>>(jsonString, 'MyService.method');
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 *
 * @example
 * // With Zod schema validation
 * const configSchema = z.object({ apiKey: z.string() });
 * const result = safeJsonParse(jsonString, 'ConfigLoader', configSchema);
 * if (result.success) {
 *   // result.data is typed according to schema
 *   console.log(result.data.apiKey);
 * }
 */
export function safeJsonParse<T>(
  jsonString: string,
  context: string,
  schema?: ZodSchema<T>
): ParseResult<T> {
  try {
    const parsed: unknown = JSON.parse(jsonString);

    // If schema provided, validate parsed data
    if (schema) {
      const validationResult = schema.safeParse(parsed);
      if (!validationResult.success) {
        const errorMessage = `Validation failed: ${validationResult.error.message}`;
        logger.warn(`JSON validation failed in ${context}`, {
          error: errorMessage,
          jsonPreview: jsonString.substring(0, 100),
        });
        return { success: false, error: errorMessage };
      }
      return { success: true, data: validationResult.data };
    }

    // SAFETY: No schema provided, caller accepts responsibility for type T via generic parameter
    return { success: true, data: parsed as T };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`JSON parse failed in ${context}`, {
      error: errorMessage,
      jsonPreview: jsonString.substring(0, 100),
    });
    return { success: false, error: errorMessage };
  }
}
