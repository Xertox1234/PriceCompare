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
 */
export function validateOutput(
  schemaName: keyof typeof outputSchemas,
  data: unknown
): ValidationResult {
  const schema = outputSchemas[schemaName];
  if (!schema) {
    return {
      valid: false,
      errors: [{ field: 'schema', message: `Unknown schema: ${schemaName}` }]
    };
  }

  const errors: ValidationError[] = [];

  // Validate based on schema type
  if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      errors.push({
        field: 'root',
        message: 'Expected array',
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
        message: `Array must have at least ${arraySchema.minItems} items`,
        expected: `>= ${arraySchema.minItems}`,
        received: data.length
      });
    }

    if (arraySchema.maxItems !== undefined && data.length > arraySchema.maxItems) {
      errors.push({
        field: 'array',
        message: `Array must have at most ${arraySchema.maxItems} items`,
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
            message: `Item must be of type ${schema.items}`,
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
              message: `String must be at least ${constraints.minLength} characters`,
              received: item.length
            });
          }
          if (constraints.maxLength && item.length > constraints.maxLength) {
            errors.push({
              field: `[${index}]`,
              message: `String must be at most ${constraints.maxLength} characters`,
              received: item.length
            });
          }
          if (constraints.pattern && !constraints.pattern.test(item)) {
            errors.push({
              field: `[${index}]`,
              message: `String does not match required pattern`,
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
    // @ts-ignore - Union type complexity
    data: errors.length === 0 ? data : undefined
  };
}

/**
 * Validate an object against a schema
 */
function validateObject(
  obj: unknown,
  schema: Record<string, unknown>,
  path: string = 'root'
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    errors.push({
      field: path,
      message: 'Expected object',
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
          message: `Required field missing: ${field}`,
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
            message: `Type mismatch`,
            expected: propSchema.type as string,
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
            message: `String too short (min ${propSchema.minLength})`,
            received: value.length
          });
        }
        if (propSchema.maxLength && value.length > propSchema.maxLength) {
          errors.push({
            field: fieldPath,
            message: `String too long (max ${propSchema.maxLength})`,
            received: value.length
          });
        }
        if (propSchema.enum && Array.isArray(propSchema.enum) && !propSchema.enum.includes(value)) {
          errors.push({
            field: fieldPath,
            message: `Value not in allowed list`,
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
            message: `Number too small (min ${propSchema.min})`,
            received: value
          });
        }
        if (propSchema.max !== undefined && value > propSchema.max) {
          errors.push({
            field: fieldPath,
            message: `Number too large (max ${propSchema.max})`,
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
          message: `Failed to parse JSON: ${(error as Error).message}`,
          received: rawOutput.substring(0, 100)
        }
      ]
    };
  }
}

/**
 * Format validation errors for logging
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map(err => `  - ${err.field}: ${err.message}${err.expected ? ` (expected: ${err.expected}, got: ${err.received})` : ''}`)
    .join('\n');
}
