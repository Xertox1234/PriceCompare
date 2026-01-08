/**
 * Client-side validation helper functions
 * SECURITY: Prevents type confusion and NaN injection attacks
 */

/**
 * Safely parse an integer from a string, with validation
 * @param value - The value to parse
 * @param fieldName - Name of the field for error messages
 * @param options - Optional min/max constraints
 * @returns The parsed integer
 * @throws Error if parsing fails or constraints are violated
 */
export function parseIntSafe(
  value: string | number | undefined,
  fieldName = 'value',
  options?: { min?: number; max?: number }
): number {
  if (value === undefined) {
    throw new Error(`${fieldName} is required`);
  }

  // SECURITY: Validate string format before parsing to prevent injection
  // Reject any string that isn't strictly a valid integer format
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Only allow optional +/- sign followed by digits
    if (!/^[+-]?\d+$/.test(trimmed)) {
      throw new Error(`${fieldName} must be a valid integer`);
    }
  }

  const parsed = typeof value === 'number' ? value : parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid integer`);
  }

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a finite number`);
  }

  if (options?.min !== undefined && parsed < options.min) {
    throw new Error(`${fieldName} must be at least ${options.min}`);
  }

  if (options?.max !== undefined && parsed > options.max) {
    throw new Error(`${fieldName} must be at most ${options.max}`);
  }

  return parsed;
}

/**
 * Safely parse an optional integer from a string
 * @param value - The value to parse
 * @param fieldName - Name of the field for error messages
 * @param options - Optional min/max constraints
 * @returns The parsed integer or undefined if value is undefined
 * @throws Error if parsing fails or constraints are violated
 */
export function parseIntOptional(
  value: string | number | undefined,
  fieldName = 'value',
  options?: { min?: number; max?: number }
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseIntSafe(value, fieldName, options);
}
