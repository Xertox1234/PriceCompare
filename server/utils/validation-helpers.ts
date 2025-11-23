/**
 * Validation helper functions
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
  fieldName: string = 'value',
  options?: { min?: number; max?: number }
): number {
  if (value === undefined) {
    throw new Error(`${fieldName} is required`);
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
  fieldName: string = 'value',
  options?: { min?: number; max?: number }
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseIntSafe(value, fieldName, options);
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password strength requirements
 * @param password - The password to validate
 * @returns Object with valid flag and array of error messages
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Safely parse a float from a string, with validation
 * @param value - The value to parse
 * @param fieldName - Name of the field for error messages
 * @param options - Optional min/max constraints
 * @returns The parsed float
 * @throws Error if parsing fails or constraints are violated
 */
export function parseFloatSafe(
  value: string | number | undefined,
  fieldName: string = 'value',
  options?: { min?: number; max?: number }
): number {
  if (value === undefined) {
    throw new Error(`${fieldName} is required`);
  }

  const parsed = typeof value === 'number' ? value : parseFloat(value);

  if (isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
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
