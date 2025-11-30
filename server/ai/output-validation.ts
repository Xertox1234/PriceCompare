/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- AI validation works with dynamic JSON structures */
/**
 * AI Output Validation System
 *
 * Validates AI-generated outputs against predefined JSON schemas to ensure:
 * - Data structure correctness
 * - Type safety
 * - Required field presence
 * - Value constraints and ranges
 */

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

/** Validation error message constants for consistency and maintainability */
const VALIDATION_MESSAGES = {
  EXPECTED_ARRAY: 'Expected array',
  ARRAY_MIN_ITEMS: (min: number) => `Array must have at least ${min} items`,
  ARRAY_MAX_ITEMS: (max: number) => `Array must have at most ${max} items`,
  ITEM_TYPE_MISMATCH: (expected: string) => `Item must be of type ${expected}`,
  STRING_MIN_LENGTH: (min: number) => `String must be at least ${min} characters`,
  STRING_MAX_LENGTH: (max: number) => `String must be at most ${max} characters`,
  PATTERN_MISMATCH: 'String does not match required pattern',
  EXPECTED_OBJECT: 'Expected object',
  REQUIRED_FIELD_MISSING: (field: string) => `Required field missing: ${field}`,
  TYPE_MISMATCH: 'Type mismatch',
  STRING_TOO_SHORT: (min: number) => `String too short (min ${min})`,
  STRING_TOO_LONG: (max: number) => `String too long (max ${max})`,
  VALUE_NOT_IN_LIST: 'Value not in allowed list',
  NUMBER_TOO_SMALL: (min: number) => `Number too small (min ${min})`,
  NUMBER_TOO_LARGE: (max: number) => `Number too large (max ${max})`,
  JSON_PARSE_ERROR: (msg: string) => `Failed to parse JSON: ${msg}`,
  UNKNOWN_SCHEMA: (name: string) => `Unknown schema: ${name}`,
} as const;
interface JsonObject {
  [key: string]: JsonValue;
}
interface JsonArray extends Array<JsonValue> {}

/** Schema type definitions for type-safe validation */
interface ItemConstraints {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

interface PropertySchema {
  type?: string;
  enum?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
}

interface ObjectItemSchema {
  type: 'object';
  required?: string[];
  properties?: Record<string, PropertySchema>;
}

interface ArraySchema {
  type: 'array';
  items: string | ObjectItemSchema;
  minItems?: number;
  maxItems?: number;
  itemConstraints?: ItemConstraints;
}

export interface ValidationResult<T = JsonValue> {
  valid: boolean;
  errors: ValidationError[];
  data?: T;
}

export interface ValidationError {
  field: string;
  message: string;
  expected?: string | number | string[];
  received?: string | number;
}

/**
 * Schema definitions for AI outputs
 *
 * Each schema can be validated against AI output using validateOutput()
 * or parseAndValidateJSON() for raw string input.
 *
 * @example
 * ```typescript
 * const result = validateOutput('search-queries', ['laptop', 'gaming laptop']);
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export const outputSchemas = {
  'search-queries': {
    type: 'array',
    items: 'string',
    minItems: 3,
    maxItems: 5,
    itemConstraints: {
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9\s\-]+$/
    }
  },

  'trend-analysis': {
    type: 'array',
    items: {
      type: 'object',
      required: ['originalQuery', 'normalizedName', 'category', 'confidence', 'isProduct', 'reason'],
      properties: {
        originalQuery: { type: 'string', minLength: 1 },
        normalizedName: { type: 'string' },
        category: {
          type: 'string',
          enum: [
            'Electronics',
            'Home & Kitchen',
            'Fashion & Apparel',
            'Sports & Outdoors',
            'Health & Beauty',
            'Toys & Games',
            'Books & Media',
            'Automotive',
            'Office & School',
            'Pet Supplies',
            'Other'
          ]
        },
        confidence: { type: 'number', min: 0, max: 100 },
        isProduct: { type: 'boolean' },
        reason: { type: 'string', maxLength: 200 }
      }
    }
  },

  'search-suggestions': {
    type: 'array',
    items: 'string',
    itemConstraints: {
      minLength: 3,
      maxLength: 100
    },
    minItems: 3,
    maxItems: 3
  }
};

/**
 * Validate AI output against a schema
 *
 * @param schemaName - The name of the schema to validate against
 * @param data - The data to validate
 * @returns ValidationResult with validation status and any errors
 *
 * @example
 * ```typescript
 * // Validate search queries
 * const result = validateOutput('search-queries', [
 *   'laptop',
 *   'gaming laptop',
 *   'ultrabook'
 * ]);
 *
 * if (result.valid) {
 *   console.log('Valid data:', result.data);
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Validate trend analysis
 * const result = validateOutput('trend-analysis', [{
 *   originalQuery: 'laptop',
 *   normalizedName: 'Gaming Laptop',
 *   category: 'Electronics',
 *   confidence: 95,
 *   isProduct: true,
 *   reason: 'Clear product intent'
 * }]);
 * ```
 */
export function validateOutput(
  schemaName: keyof typeof outputSchemas,
  data: unknown
): ValidationResult {
  // Validate schema name exists
  if (!(schemaName in outputSchemas)) {
    return {
      valid: false,
      errors: [{ field: 'schema', message: VALIDATION_MESSAGES.UNKNOWN_SCHEMA(schemaName) }]
    };
  }

  const schema = outputSchemas[schemaName];

  const errors: ValidationError[] = [];

  // Validate based on schema type
  if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      errors.push({
        field: 'root',
        message: VALIDATION_MESSAGES.EXPECTED_ARRAY,
        expected: 'array',
        received: typeof data
      });
      return { valid: false, errors };
    }

    // Validate array length
    const arraySchema = schema as ArraySchema;
    if (arraySchema.minItems !== undefined && data.length < arraySchema.minItems) {
      errors.push({
        field: 'array',
        message: VALIDATION_MESSAGES.ARRAY_MIN_ITEMS(arraySchema.minItems),
        expected: `>= ${arraySchema.minItems}`,
        received: data.length
      });
    }

    if (arraySchema.maxItems !== undefined && data.length > arraySchema.maxItems) {
      errors.push({
        field: 'array',
        message: VALIDATION_MESSAGES.ARRAY_MAX_ITEMS(arraySchema.maxItems),
        expected: `<= ${arraySchema.maxItems}`,
        received: data.length
      });
    }

    // Validate array items
    if (typeof schema.items === 'string') {
      // Simple type validation
      data.forEach((item, index) => {
        if (typeof item !== schema.items) {
          errors.push({
            field: `[${index}]`,
            message: VALIDATION_MESSAGES.ITEM_TYPE_MISMATCH(schema.items as string),
            expected: schema.items as string,
            received: typeof item
          });
        }

        // Additional string constraints
        if (schema.items === 'string' && (schema as ArraySchema).itemConstraints) {
          const constraints = (schema as ArraySchema).itemConstraints as ItemConstraints;
          if (constraints.minLength && item.length < constraints.minLength) {
            errors.push({
              field: `[${index}]`,
              message: VALIDATION_MESSAGES.STRING_MIN_LENGTH(constraints.minLength),
              received: item.length
            });
          }
          if (constraints.maxLength && item.length > constraints.maxLength) {
            errors.push({
              field: `[${index}]`,
              message: VALIDATION_MESSAGES.STRING_MAX_LENGTH(constraints.maxLength),
              received: item.length
            });
          }
          if (constraints.pattern && !constraints.pattern.test(item)) {
            errors.push({
              field: `[${index}]`,
              message: VALIDATION_MESSAGES.PATTERN_MISMATCH,
              received: item
            });
          }
        }
      });
    } else if (typeof schema.items === 'object' && schema.items !== null && !Array.isArray(schema.items)) {
      // Object validation
      data.forEach((item, index) => {
        const itemErrors = validateObject(item, schema.items as Record<string, unknown>, `[${index}]`);
        errors.push(...itemErrors);
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    // @ts-expect-error - Union type complexity from validating heterogeneous schemas
    // The data parameter contains validated output but TypeScript cannot narrow the type precisely.
    // This is safe because: (1) we validate structure above, (2) errors.length check ensures validity.
    // TODO: Can be removed once TypeScript improves union type inference in conditional paths.
    data: errors.length === 0 ? data : undefined
  };
}

/**
 * Validate an object against a schema
 */
function validateObject(
  obj: unknown,
  schema: Record<string, unknown>,
  path = 'root'
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    errors.push({
      field: path,
      message: VALIDATION_MESSAGES.EXPECTED_OBJECT,
      expected: 'object',
      received: Array.isArray(obj) ? 'array' : typeof obj
    });
    return errors;
  }

  // Check required fields
  if (schema.required && Array.isArray(schema.required)) {
    (schema.required as string[]).forEach((field: string) => {
      if (!(field in obj)) {
        errors.push({
          field: `${path}.${field}`,
          message: VALIDATION_MESSAGES.REQUIRED_FIELD_MISSING(field),
          expected: 'present',
          received: 'missing'
        });
      }
    });
  }

  // Validate properties
  if (schema.properties && typeof schema.properties === 'object') {
    const properties = schema.properties as Record<string, unknown>;
    Object.keys(properties).forEach((key) => {
      if (!(key in obj)) return; // Skip optional fields

      const propSchema = properties[key] as PropertySchema;
      const value = (obj as Record<string, unknown>)[key];
      const fieldPath = `${path}.${key}`;

      // Type validation
      if (propSchema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== propSchema.type) {
          errors.push({
            field: fieldPath,
            message: VALIDATION_MESSAGES.TYPE_MISMATCH,
            expected: propSchema.type,
            received: actualType
          });
          return;
        }
      }

      // String validation
      if (propSchema.type === 'string' && typeof value === 'string') {
        if (propSchema.minLength && value.length < propSchema.minLength) {
          errors.push({
            field: fieldPath,
            message: VALIDATION_MESSAGES.STRING_TOO_SHORT(propSchema.minLength),
            received: value.length
          });
        }
        if (propSchema.maxLength && value.length > propSchema.maxLength) {
          errors.push({
            field: fieldPath,
            message: VALIDATION_MESSAGES.STRING_TOO_LONG(propSchema.maxLength),
            received: value.length
          });
        }
        if (propSchema.enum && Array.isArray(propSchema.enum) && !propSchema.enum.includes(value)) {
          errors.push({
            field: fieldPath,
            message: VALIDATION_MESSAGES.VALUE_NOT_IN_LIST,
            expected: propSchema.enum.join(', '),
            received: value
          });
        }
      }

      // Number validation
      if (propSchema.type === 'number' && typeof value === 'number') {
        if (propSchema.min !== undefined && value < propSchema.min) {
          errors.push({
            field: fieldPath,
            message: VALIDATION_MESSAGES.NUMBER_TOO_SMALL(propSchema.min),
            received: value
          });
        }
        if (propSchema.max !== undefined && value > propSchema.max) {
          errors.push({
            field: fieldPath,
            message: VALIDATION_MESSAGES.NUMBER_TOO_LARGE(propSchema.max),
            received: value
          });
        }
      }
    });
  }

  return errors;
}

/**
 * Sanitize AI output to remove potentially harmful content
 *
 * Removes markdown code blocks and trims whitespace from strings.
 * Recursively processes arrays and objects.
 *
 * @param data - The data to sanitize
 * @returns Sanitized data with code blocks removed
 *
 * @example
 * ```typescript
 * const dirty = '```json\n{"key": "value"}\n```';
 * const clean = sanitizeOutput(dirty);
 * // Returns: '{"key": "value"}'
 * ```
 *
 * @example
 * ```typescript
 * const arr = ['`code`', 'normal text', '```block```'];
 * const clean = sanitizeOutput(arr);
 * // Returns: ['', 'normal text', '']
 * ```
 */
export function sanitizeOutput(data: unknown): JsonValue {
  if (typeof data === 'string') {
    // Remove markdown code blocks
    let sanitized = data.replace(/```[\s\S]*?```/g, '');
    sanitized = sanitized.replace(/`[^`]*`/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeOutput) as JsonArray;
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: JsonObject = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeOutput(value);
    }
    return sanitized;
  }

  // For primitives (number, boolean, null)
  return data as JsonValue;
}

/**
 * Attempt to parse and validate JSON from AI output
 *
 * Handles markdown code blocks and sanitization before parsing.
 * Extracts JSON from markdown code blocks if present, otherwise sanitizes input.
 *
 * @param rawOutput - Raw string output from AI (may contain markdown)
 * @param schemaName - The schema to validate against
 * @returns ValidationResult with parsed and validated data
 *
 * @example
 * ```typescript
 * // Parse from markdown code block
 * const result = parseAndValidateJSON(
 *   '```json\n["query1", "query2", "query3"]\n```',
 *   'search-queries'
 * );
 *
 * if (result.valid) {
 *   console.log('Parsed queries:', result.data);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Parse plain JSON
 * const result = parseAndValidateJSON(
 *   '["laptop", "gaming laptop", "ultrabook"]',
 *   'search-queries'
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Handle parsing errors
 * const result = parseAndValidateJSON(
 *   'invalid json',
 *   'search-queries'
 * );
 *
 * if (!result.valid) {
 *   console.error('Parse error:', result.errors[0].message);
 * }
 * ```
 */
export function parseAndValidateJSON(
  rawOutput: string,
  schemaName: keyof typeof outputSchemas
): ValidationResult {
  try {
    let sanitized = rawOutput;

    // Try to extract JSON from markdown code blocks first (before sanitizing)
    const jsonMatch = sanitized.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      sanitized = jsonMatch[1].trim();
    } else {
      // Only sanitize if there were no code blocks
      sanitized = (sanitizeOutput(rawOutput) as string).trim();
    }

    // Parse JSON
    const parsed = JSON.parse(sanitized);

    // Validate against schema
    return validateOutput(schemaName, parsed);

  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          field: 'json',
          message: VALIDATION_MESSAGES.JSON_PARSE_ERROR((error as Error).message),
          received: rawOutput.substring(0, 100)
        }
      ]
    };
  }
}

/**
 * Format validation errors for logging
 *
 * Converts an array of validation errors into a formatted multi-line string
 * suitable for logging or display.
 *
 * @param errors - Array of validation errors to format
 * @returns Formatted string with one error per line
 *
 * @example
 * ```typescript
 * const result = validateOutput('search-queries', ['ab']); // Too short
 * if (!result.valid) {
 *   const formatted = formatValidationErrors(result.errors);
 *   console.error('Validation failed:\n' + formatted);
 *   // Output:
 *   //   - [0]: String must be at least 2 characters (expected: >= 2, got: 2)
 * }
 * ```
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map(err => `  - ${err.field}: ${err.message}${err.expected ? ` (expected: ${err.expected}, got: ${err.received})` : ''}`)
    .join('\n');
}
