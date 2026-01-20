import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { safeJsonParse } from '../json-helpers';
import { logger } from '../logger';

/**
 * JSON Helpers Unit Test Suite
 *
 * Tests safe JSON parsing utility with error handling and Zod schema validation.
 * Verifies discriminated union pattern, error logging, and edge cases.
 *
 * Test categories:
 * 1. Valid JSON Parsing - Different data types
 * 2. Invalid JSON Parsing - Malformed strings
 * 3. Schema Validation - Zod integration
 * 4. Context Logging - Error context preservation
 * 5. Edge Cases - Empty, null, whitespace, large strings
 *
 * Pattern: docs/06_ERROR_HANDLING_PATTERNS.md (Graceful Degradation)
 * Reference: docs/08_TESTING_PATTERNS.md (Logger Mock Pattern)
 */

// Mock logger to avoid console noise and verify logging
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('JSON Helpers - safeJsonParse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Valid JSON Parsing', () => {
    it('should parse valid JSON object successfully', () => {
      const jsonString = '{"name":"test","value":123}';
      const result = safeJsonParse<Record<string, unknown>>(jsonString, 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'test', value: 123 });
      }
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should parse valid JSON array successfully', () => {
      const jsonString = '[1,2,3,4,5]';
      const result = safeJsonParse<number[]>(jsonString, 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([1, 2, 3, 4, 5]);
      }
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should parse valid JSON string successfully', () => {
      const jsonString = '"hello world"';
      const result = safeJsonParse<string>(jsonString, 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('hello world');
      }
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should parse valid JSON number successfully', () => {
      const jsonString = '42.5';
      const result = safeJsonParse<number>(jsonString, 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42.5);
      }
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should parse valid JSON boolean successfully', () => {
      const jsonString = 'true';
      const result = safeJsonParse<boolean>(jsonString, 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(true);
      }
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should parse nested JSON structures successfully', () => {
      const jsonString = '{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}],"count":2}';
      const result = safeJsonParse<Record<string, unknown>>(jsonString, 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          users: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
          count: 2,
        });
      }
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('Invalid JSON Parsing', () => {
    it('should handle malformed JSON with syntax error', () => {
      const jsonString = '{"name": "test", invalid}';
      const result = safeJsonParse<Record<string, unknown>>(jsonString, 'TestContext');

      expect(result.success).toBe(false);
      if (!result.success) {
        // Error message varies by Node version - just verify it exists
        expect(result.error).toBeTruthy();
        expect(typeof result.error).toBe('string');
      }
      expect(logger.error).toHaveBeenCalledWith(
        'JSON parse failed in TestContext',
        expect.objectContaining({
          error: expect.any(String),
          jsonPreview: '{"name": "test", invalid}',
        })
      );
    });

    it('should handle JSON with trailing comma', () => {
      const jsonString = '{"name": "test",}';
      const result = safeJsonParse<Record<string, unknown>>(jsonString, 'TestContext');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle unclosed JSON object', () => {
      const jsonString = '{"name": "test"';
      const result = safeJsonParse<Record<string, unknown>>(jsonString, 'TestContext');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
      expect(logger.error).toHaveBeenCalledWith(
        'JSON parse failed in TestContext',
        expect.objectContaining({
          jsonPreview: '{"name": "test"',
        })
      );
    });

    it('should handle single quotes instead of double quotes', () => {
      const jsonString = "{'name': 'test'}";
      const result = safeJsonParse<Record<string, unknown>>(jsonString, 'TestContext');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle random non-JSON string', () => {
      const jsonString = 'This is not JSON at all!';
      const result = safeJsonParse<Record<string, unknown>>(jsonString, 'TestContext');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Schema Validation with Zod', () => {
    const userSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
    });

    it('should validate data matching schema successfully', () => {
      const jsonString = '{"id":1,"name":"Alice","email":"alice@example.com"}';
      const result = safeJsonParse(jsonString, 'UserService.parse', userSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          id: 1,
          name: 'Alice',
          email: 'alice@example.com',
        });
        // TypeScript should infer correct type from schema
        expect(typeof result.data.id).toBe('number');
        expect(typeof result.data.name).toBe('string');
      }
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should fail validation for data not matching schema', () => {
      const jsonString = '{"id":"not-a-number","name":"Alice","email":"alice@example.com"}';
      const result = safeJsonParse(jsonString, 'UserService.parse', userSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Validation failed');
      }
      expect(logger.warn).toHaveBeenCalledWith(
        'JSON validation failed in UserService.parse',
        expect.objectContaining({
          error: expect.stringContaining('Validation failed'),
          jsonPreview: expect.stringContaining('"id":"not-a-number"'),
        })
      );
    });

    it('should fail validation for missing required fields', () => {
      const jsonString = '{"id":1,"name":"Alice"}';
      const result = safeJsonParse(jsonString, 'UserService.parse', userSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Validation failed');
        expect(result.error).toContain('email');
      }
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should fail validation for invalid email format', () => {
      const jsonString = '{"id":1,"name":"Alice","email":"not-an-email"}';
      const result = safeJsonParse(jsonString, 'UserService.parse', userSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Validation failed');
      }
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should validate array schemas', () => {
      const arraySchema = z.array(z.number());
      const jsonString = '[1,2,3,4,5]';
      const result = safeJsonParse(jsonString, 'ArrayService.parse', arraySchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([1, 2, 3, 4, 5]);
      }
    });

    it('should fail validation for array with wrong types', () => {
      const arraySchema = z.array(z.number());
      const jsonString = '[1,2,"three",4,5]';
      const result = safeJsonParse(jsonString, 'ArrayService.parse', arraySchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Validation failed');
      }
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should validate complex nested schemas', () => {
      const productSchema = z.object({
        id: z.number(),
        name: z.string(),
        price: z.number().positive(),
        tags: z.array(z.string()),
        metadata: z.object({
          category: z.string(),
          inStock: z.boolean(),
        }),
      });

      const jsonString = `{
        "id": 123,
        "name": "Widget",
        "price": 29.99,
        "tags": ["electronics", "gadgets"],
        "metadata": {
          "category": "Electronics",
          "inStock": true
        }
      }`;

      const result = safeJsonParse(jsonString, 'ProductService.parse', productSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(123);
        expect(result.data.metadata.inStock).toBe(true);
      }
    });
  });

  describe('Context Logging', () => {
    it('should include context in error logs for parse failures', () => {
      const jsonString = 'invalid json';
      safeJsonParse<Record<string, unknown>>(jsonString, 'RetailerStorage.getRetailers');

      expect(logger.error).toHaveBeenCalledWith(
        'JSON parse failed in RetailerStorage.getRetailers',
        expect.objectContaining({
          error: expect.any(String),
          jsonPreview: 'invalid json',
        })
      );
    });

    it('should include context in warning logs for validation failures', () => {
      const schema = z.object({ id: z.number() });
      const jsonString = '{"id":"wrong"}';
      safeJsonParse(jsonString, 'CoordinatorAgent.parseConfig', schema);

      expect(logger.warn).toHaveBeenCalledWith(
        'JSON validation failed in CoordinatorAgent.parseConfig',
        expect.objectContaining({
          error: expect.stringContaining('Validation failed'),
          jsonPreview: '{"id":"wrong"}',
        })
      );
    });

    it('should preserve different context strings across multiple calls', () => {
      const contexts = [
        'ServiceA.method',
        'ServiceB.handler',
        'UtilityC.parser',
      ];

      contexts.forEach(context => {
        safeJsonParse<Record<string, unknown>>('invalid', context);
      });

      expect(logger.error).toHaveBeenCalledTimes(3);
      contexts.forEach(context => {
        expect(logger.error).toHaveBeenCalledWith(
          `JSON parse failed in ${context}`,
          expect.any(Object)
        );
      });
    });

    it('should truncate long JSON strings in preview', () => {
      // Create invalid JSON string longer than 100 characters
      const longJsonString = '{"data":"' + 'x'.repeat(200); // Invalid - missing closing quote and brace
      const result = safeJsonParse<Record<string, unknown>>(longJsonString, 'TestContext');

      expect(result.success).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'JSON parse failed in TestContext',
        expect.objectContaining({
          jsonPreview: longJsonString.substring(0, 100),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const result = safeJsonParse<Record<string, unknown>>('', 'TestContext');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
      expect(logger.error).toHaveBeenCalledWith(
        'JSON parse failed in TestContext',
        expect.objectContaining({
          jsonPreview: '',
        })
      );
    });

    it('should distinguish between null value and "null" string', () => {
      // JSON null (valid)
      const nullResult = safeJsonParse<null>('null', 'TestContext');
      expect(nullResult.success).toBe(true);
      if (nullResult.success) {
        expect(nullResult.data).toBe(null);
      }

      // String "null" (valid JSON string)
      const stringResult = safeJsonParse<string>('"null"', 'TestContext');
      expect(stringResult.success).toBe(true);
      if (stringResult.success) {
        expect(stringResult.data).toBe('null');
      }
    });

    it('should handle whitespace-only strings', () => {
      const result = safeJsonParse<Record<string, unknown>>('   ', 'TestContext');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle JSON with only whitespace around valid content', () => {
      const jsonString = '  {"name":"test"}  ';
      const result = safeJsonParse<Record<string, unknown>>(jsonString, 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'test' });
      }
    });

    it('should handle very large JSON strings', () => {
      // Create large but valid JSON
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      const largeJsonString = JSON.stringify(largeArray);

      const result = safeJsonParse<number[]>(largeJsonString, 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(10000);
        expect(result.data[0]).toBe(0);
        expect(result.data[9999]).toBe(9999);
      }
    });

    it('should handle JSON with special characters', () => {
      const jsonString = '{"emoji":"🎉","unicode":"\\u00A9","newline":"line1\\nline2"}';
      const result = safeJsonParse<Record<string, string>>(jsonString, 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.emoji).toBe('🎉');
        expect(result.data.unicode).toBe('©');
        expect(result.data.newline).toBe('line1\nline2');
      }
    });

    it('should handle JSON with escaped quotes', () => {
      const jsonString = '{"message":"He said \\"Hello\\""}';
      const result = safeJsonParse<Record<string, string>>(jsonString, 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe('He said "Hello"');
      }
    });

    it('should handle zero', () => {
      const result = safeJsonParse<number>('0', 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
    });

    it('should handle negative numbers', () => {
      const result = safeJsonParse<number>('-42.5', 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(-42.5);
      }
    });

    it('should handle scientific notation', () => {
      const result = safeJsonParse<number>('1.23e10', 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(12300000000);
      }
    });

    it('should handle empty array', () => {
      const result = safeJsonParse<unknown[]>('[]', 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
        expect(result.data).toHaveLength(0);
      }
    });

    it('should handle empty object', () => {
      const result = safeJsonParse<Record<string, unknown>>('{}', 'TestContext');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
        expect(Object.keys(result.data)).toHaveLength(0);
      }
    });
  });

  describe('Discriminated Union Pattern', () => {
    it('should return success discriminated union for valid JSON', () => {
      const result = safeJsonParse<{ name: string }>('{"name":"test"}', 'TestContext');

      // Type guard pattern
      if (result.success) {
        // TypeScript should know result.data exists
        expect(result.data.name).toBe('test');
        // @ts-expect-error - error property should not exist on success
        expect(result.error).toBeUndefined();
      } else {
        // Should not reach here
        expect.fail('Expected success result');
      }
    });

    it('should return failure discriminated union for invalid JSON', () => {
      const result = safeJsonParse<Record<string, unknown>>('invalid', 'TestContext');

      // Type guard pattern
      if (result.success) {
        // Should not reach here
        expect.fail('Expected failure result');
      } else {
        // TypeScript should know result.error exists
        expect(result.error).toBeTruthy();
        // @ts-expect-error - data property should not exist on failure
        expect(result.data).toBeUndefined();
      }
    });

    it('should work with early return pattern', () => {
      const parseConfig = (jsonString: string): Record<string, unknown> | null => {
        const result = safeJsonParse<Record<string, unknown>>(jsonString, 'parseConfig');
        if (!result.success) {
          return null;
        }
        return result.data; // TypeScript knows data exists
      };

      expect(parseConfig('{"key":"value"}')).toEqual({ key: 'value' });
      expect(parseConfig('invalid')).toBeNull();
    });
  });

  describe('Real-World Usage Examples', () => {
    it('should handle retailer configuration parsing', () => {
      const configSchema = z.object({
        name: z.string(),
        website: z.string().url(),
        logoUrl: z.string().url().optional(),
        isActive: z.boolean().default(true),
      });

      const jsonString = `{
        "name": "Example Store",
        "website": "https://example.com",
        "logoUrl": "https://example.com/logo.png",
        "isActive": true
      }`;

      const result = safeJsonParse(jsonString, 'RetailerStorage.parseConfig', configSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Example Store');
        expect(result.data.website).toBe('https://example.com');
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should handle scraping agent metadata parsing', () => {
      const metadataSchema = z.object({
        extractedAt: z.string(),
        selectors: z.record(z.string(), z.string()), // Record needs key and value types in Zod v4
        wasSuccessful: z.boolean(), // Renamed to avoid naming collision
      });

      const jsonString = `{
        "extractedAt": "2025-01-01T12:00:00Z",
        "selectors": {
          "price": ".price-value",
          "title": ".product-title"
        },
        "wasSuccessful": true
      }`;

      const result = safeJsonParse(jsonString, 'ExtractionAgent.parseMetadata', metadataSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wasSuccessful).toBe(true);
        expect(result.data.selectors.price).toBe('.price-value');
      }
    });

    it('should handle invalid configuration gracefully', () => {
      const configSchema = z.object({
        apiKey: z.string(),
        timeout: z.number().positive(),
      });

      const jsonString = '{"apiKey":"abc123","timeout":-1}'; // Invalid timeout

      const result = safeJsonParse(jsonString, 'ConfigLoader.load', configSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Validation failed');
        expect(result.error).toContain('timeout');
      }
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
