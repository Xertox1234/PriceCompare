/**
 * Security validation tests
 * Tests for validation helpers and security patterns
 */
import { describe, test, expect } from 'vitest';
import { parseIntSafe, parseIntOptional, parseFloatSafe } from '../../utils/validation-helpers';
import { sanitizeErrorMessage, createErrorResponse, getErrorStatus } from '../../utils/error-sanitizer';

describe('Integer Parsing Security', () => {
  describe('parseIntSafe', () => {
    test('parses valid integers', () => {
      expect(parseIntSafe('123', 'id')).toBe(123);
      expect(parseIntSafe('0', 'id')).toBe(0);
      expect(parseIntSafe('-5', 'id')).toBe(-5);
    });

    test('rejects NaN', () => {
      expect(() => parseIntSafe('NaN', 'id')).toThrow('must be a valid integer');
      expect(() => parseIntSafe('abc', 'id')).toThrow('must be a valid integer');
      // Note: parseInt('12.34') returns 12, not NaN, so decimals are truncated rather than rejected
    });

    test('rejects Infinity', () => {
      // parseInt('Infinity') returns NaN, not Infinity, so it throws "must be a valid integer"
      expect(() => parseIntSafe('Infinity', 'id')).toThrow('must be a valid integer');
      expect(() => parseIntSafe('-Infinity', 'id')).toThrow('must be a valid integer');
    });

    test('validates min constraint', () => {
      expect(() => parseIntSafe('5', 'id', { min: 10 })).toThrow('must be at least 10');
      expect(parseIntSafe('10', 'id', { min: 10 })).toBe(10);
      expect(parseIntSafe('15', 'id', { min: 10 })).toBe(15);
    });

    test('validates max constraint', () => {
      expect(() => parseIntSafe('15', 'id', { max: 10 })).toThrow('must be at most 10');
      expect(parseIntSafe('10', 'id', { max: 10 })).toBe(10);
      expect(parseIntSafe('5', 'id', { max: 10 })).toBe(5);
    });

    test('requires value', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intentionally testing undefined input behavior
      expect(() => parseIntSafe(undefined as any, 'id')).toThrow('is required');
    });
  });

  describe('parseIntOptional', () => {
    test('returns undefined for missing values', () => {
      expect(parseIntOptional(undefined, 'id')).toBeUndefined();
      expect(parseIntOptional('', 'id')).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intentionally testing null input behavior
      expect(parseIntOptional(null as any, 'id')).toBeUndefined();
    });

    test('parses valid integers', () => {
      expect(parseIntOptional('123', 'id')).toBe(123);
      expect(parseIntOptional('0', 'id')).toBe(0);
    });

    test('rejects invalid values', () => {
      expect(() => parseIntOptional('NaN', 'id')).toThrow('must be a valid integer');
      expect(() => parseIntOptional('abc', 'id')).toThrow('must be a valid integer');
    });
  });

  describe('parseFloatSafe', () => {
    test('parses valid floats', () => {
      expect(parseFloatSafe('123.45', 'price')).toBe(123.45);
      expect(parseFloatSafe('0', 'price')).toBe(0);
      expect(parseFloatSafe('-5.5', 'price')).toBe(-5.5);
    });

    test('rejects NaN', () => {
      expect(() => parseFloatSafe('NaN', 'price')).toThrow('must be a valid number');
      expect(() => parseFloatSafe('abc', 'price')).toThrow('must be a valid number');
    });

    test('validates constraints', () => {
      expect(() => parseFloatSafe('5', 'price', { min: 10 })).toThrow('must be at least 10');
      expect(() => parseFloatSafe('15', 'price', { max: 10 })).toThrow('must be at most 10');
    });
  });
});

describe('Error Message Sanitization', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('sanitizeErrorMessage', () => {
    test('returns full error in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Detailed database connection error: host not found');
      expect(sanitizeErrorMessage(error, 'Operation failed')).toContain('database connection');
    });

    test('returns generic message in production for unsafe errors', () => {
      process.env.NODE_ENV = 'production';
      // Use an error that doesn't match any safe error patterns
      const error = new Error('Detailed database connection error: timeout exceeded');
      expect(sanitizeErrorMessage(error, 'Operation failed')).toBe('Operation failed');
    });

    test('allows safe error patterns in production', () => {
      process.env.NODE_ENV = 'production';
      
      expect(sanitizeErrorMessage(new Error('ID must be a valid integer'), 'Failed'))
        .toBe('ID must be a valid integer');
      
      expect(sanitizeErrorMessage(new Error('Email is required'), 'Failed'))
        .toBe('Email is required');
      
      expect(sanitizeErrorMessage(new Error('Invalid credentials'), 'Failed'))
        .toBe('Invalid credentials');
      
      expect(sanitizeErrorMessage(new Error('Resource not found'), 'Failed'))
        .toBe('Resource not found');
    });
  });

  describe('getErrorStatus', () => {
    test('returns 404 for not found errors', () => {
      expect(getErrorStatus(new Error('Resource not found'))).toBe(404);
      expect(getErrorStatus(new Error('User not found'))).toBe(404);
    });

    test('returns 401 for auth errors', () => {
      expect(getErrorStatus(new Error('Unauthorized access'))).toBe(401);
      expect(getErrorStatus(new Error('Authentication required'))).toBe(401);
    });

    test('returns 403 for permission errors', () => {
      expect(getErrorStatus(new Error('Forbidden'))).toBe(403);
      expect(getErrorStatus(new Error('Admin access required'))).toBe(403);
    });

    test('returns 400 for validation errors', () => {
      expect(getErrorStatus(new Error('ID must be valid'))).toBe(400);
      expect(getErrorStatus(new Error('Email is required'))).toBe(400);
      expect(getErrorStatus(new Error('Invalid format'))).toBe(400);
    });

    test('returns 409 for conflict errors', () => {
      expect(getErrorStatus(new Error('User already exists'))).toBe(409);
      expect(getErrorStatus(new Error('Conflict detected'))).toBe(409);
    });

    test('returns 500 for unknown errors', () => {
      expect(getErrorStatus(new Error('Something went wrong'))).toBe(500);
      expect(getErrorStatus(new Error('Database error'))).toBe(500);
    });
  });

  describe('createErrorResponse', () => {
    test('includes details only in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      error.stack = 'Stack trace here';
      
      const response = createErrorResponse(error, 'Test');
      expect(response.details).toBeDefined();
      expect(response.details).toContain('Stack trace');
    });

    test('excludes details in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');
      error.stack = 'Stack trace here';
      
      const response = createErrorResponse(error, 'Test');
      expect(response.details).toBeUndefined();
    });

    test('includes appropriate status code', () => {
      const notFoundError = new Error('Resource not found');
      expect(createErrorResponse(notFoundError, 'Fetch').status).toBe(404);
      
      const validationError = new Error('ID must be valid');
      expect(createErrorResponse(validationError, 'Validate').status).toBe(400);
    });
  });
});

describe('Security Patterns', () => {
  test('prevents NaN injection in ID parsing', () => {
    // Common NaN injection attempts
    const maliciousInputs = ['NaN', 'Infinity', '-Infinity', 'undefined', 'null', '{}', '[]'];
    
    for (const input of maliciousInputs) {
      expect(() => parseIntSafe(input, 'id', { min: 1 })).toThrow();
    }
  });

  test('validates numeric ranges', () => {
    // Ensure large numbers are rejected
    expect(() => parseIntSafe('999999999999', 'id', { max: 10000 })).toThrow();
    
    // Ensure negative numbers are rejected when min is positive
    expect(() => parseIntSafe('-1', 'id', { min: 1 })).toThrow();
  });
});
