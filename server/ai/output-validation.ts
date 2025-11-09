/**
 * AI Output Validation System
 *
 * Validates AI-generated outputs against predefined JSON schemas to ensure:
 * - Data structure correctness
 * - Type safety
 * - Required field presence
 * - Value constraints and ranges
 */

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  expected?: any;
  received?: any;
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
    items: {
      type: 'string',
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
  data: any
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
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({
        field: 'array',
        message: `Array must have at least ${schema.minItems} items`,
        expected: `>= ${schema.minItems}`,
        received: data.length
      });
    }

    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({
        field: 'array',
        message: `Array must have at most ${schema.maxItems} items`,
        expected: `<= ${schema.maxItems}`,
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
            expected: schema.items,
            received: typeof item
          });
        }

        // Additional string constraints
        if (schema.items === 'string' && (schema as any).itemConstraints) {
          const constraints = (schema as any).itemConstraints;
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
    } else if (typeof schema.items === 'object') {
      // Object validation
      data.forEach((item, index) => {
        const itemErrors = validateObject(item, schema.items, `[${index}]`);
        errors.push(...itemErrors);
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  };
}

/**
 * Validate an object against a schema
 */
function validateObject(
  obj: any,
  schema: any,
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
  if (schema.required) {
    schema.required.forEach((field: string) => {
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
  if (schema.properties) {
    Object.keys(schema.properties).forEach((key) => {
      if (!(key in obj)) return; // Skip optional fields

      const propSchema = schema.properties[key];
      const value = obj[key];
      const fieldPath = `${path}.${key}`;

      // Type validation
      if (propSchema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== propSchema.type) {
          errors.push({
            field: fieldPath,
            message: `Type mismatch`,
            expected: propSchema.type,
            received: actualType
          });
          return;
        }
      }

      // String validation
      if (propSchema.type === 'string') {
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
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          errors.push({
            field: fieldPath,
            message: `Value not in allowed list`,
            expected: propSchema.enum.join(', '),
            received: value
          });
        }
      }

      // Number validation
      if (propSchema.type === 'number') {
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
export function sanitizeOutput(data: any): any {
  if (typeof data === 'string') {
    // Remove markdown code blocks
    data = data.replace(/```[\s\S]*?```/g, '');
    data = data.replace(/`[^`]*`/g, '');

    // Trim whitespace
    data = data.trim();

    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeOutput);
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeOutput(value);
    }
    return sanitized;
  }

  return data;
}

/**
 * Attempt to parse and validate JSON from AI output
 */
export function parseAndValidateJSON(
  rawOutput: string,
  schemaName: keyof typeof outputSchemas
): ValidationResult {
  try {
    // Sanitize output first
    let sanitized = sanitizeOutput(rawOutput);

    // Try to extract JSON from markdown code blocks
    const jsonMatch = sanitized.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      sanitized = jsonMatch[1];
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
