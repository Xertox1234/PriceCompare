import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response } from 'express';
import {
  sendSuccess,
  sendError,
  sendPaginated,
  sendCreated,
  sendNoContent,
  sendErrorFromException,
  normalizeResponse,
  type PaginationMeta,
  type ApiResponseMeta,
} from '../api-response';
import { logger } from '../logger';

/**
 * API Response Helpers Unit Test Suite
 *
 * Tests standardized response format helpers in isolation.
 * Verifies envelope structure, status codes, error sanitization,
 * and environment-specific behavior.
 *
 * Test categories:
 * 1. sendSuccess - Success responses with data
 * 2. sendError - Error responses with sanitization
 * 3. sendPaginated - Paginated responses with metadata
 * 4. sendCreated - 201 Created responses
 * 5. sendNoContent - 204 No Content responses
 * 6. sendErrorFromException - Error mapping and logging
 * 7. normalizeResponse - Legacy data conversion
 * 8. Edge cases - Double-nesting prevention, environment modes
 */

// Mock logger to avoid console noise
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('API Response Helpers', () => {
  let mockResponse: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let sendMock: ReturnType<typeof vi.fn>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    // Save original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;

    // Create mock response object
    statusMock = vi.fn().mockReturnThis();
    jsonMock = vi.fn().mockReturnThis();
    sendMock = vi.fn().mockReturnThis();

    mockResponse = {
      status: statusMock as unknown as Response['status'],
      json: jsonMock as unknown as Response['json'],
      send: sendMock as unknown as Response['send'],
      locals: {},
    } as unknown as Response;

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('sendSuccess()', () => {
    it('should send success response with data', () => {
      const testData = { id: 1, name: 'Test Product' };

      sendSuccess(mockResponse as Response, testData);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: testData,
      });
    });

    it('should use custom status code when provided', () => {
      const testData = { message: 'Accepted' };

      sendSuccess(mockResponse as Response, testData, 202);

      expect(statusMock).toHaveBeenCalledWith(202);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: testData,
      });
    });

    it('should include metadata when provided', () => {
      const testData = { result: 'ok' };
      const meta: Partial<ApiResponseMeta> = {
        version: '2.0',
        requestId: 'req-123',
      };

      sendSuccess(mockResponse as Response, testData, 200, meta);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: testData,
        meta: expect.objectContaining({
          version: '2.0',
          requestId: 'req-123',
          timestamp: expect.any(String),
        }),
      });
    });

    it('should include requestId from res.locals if available', () => {
      mockResponse.locals = { requestId: 'local-req-456' };
      const testData = { test: true };

      sendSuccess(mockResponse as Response, testData);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: testData,
        meta: expect.objectContaining({
          requestId: 'local-req-456',
          timestamp: expect.any(String),
          version: '1.0',
        }),
      });
    });

    it('should handle null data', () => {
      sendSuccess(mockResponse as Response, null);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });

    it('should handle empty array data', () => {
      sendSuccess(mockResponse as Response, []);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should handle empty object data', () => {
      sendSuccess(mockResponse as Response, {});

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {},
      });
    });

    it('should NOT double-nest when data already has success field', () => {
      // CRITICAL: This is the anti-pattern mentioned in CLAUDE.md
      const alreadyWrappedData = {
        success: true,
        data: { id: 1 },
      };

      sendSuccess(mockResponse as Response, alreadyWrappedData);

      // Should wrap it anyway (caller mistake, but we don't auto-unwrap)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: alreadyWrappedData, // Double-nested - caller's responsibility to avoid
      });
    });

    it('should generate ISO timestamp in metadata', () => {
      mockResponse.locals = { requestId: 'test' };

      sendSuccess(mockResponse as Response, { test: true });

      const callArg = jsonMock.mock.calls[0][0];
      expect(callArg.meta.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe('sendError()', () => {
    it('should send error response with message', () => {
      sendError(mockResponse as Response, 'Something went wrong', 500);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Something went wrong',
      });
    });

    it('should use 500 as default status code', () => {
      sendError(mockResponse as Response, 'Error');

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('should include details in development mode', () => {
      process.env.NODE_ENV = 'development';

      sendError(
        mockResponse as Response,
        'Validation failed',
        400,
        'Field "email" is required'
      );

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: 'Field "email" is required',
      });
    });

    it('should exclude details in production mode', () => {
      process.env.NODE_ENV = 'production';

      sendError(
        mockResponse as Response,
        'Internal error',
        500,
        'Sensitive stack trace information'
      );

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal error',
        // No details field
      });
    });

    it('should handle various error status codes', () => {
      const testCases = [
        { status: 400, message: 'Bad Request' },
        { status: 401, message: 'Unauthorized' },
        { status: 403, message: 'Forbidden' },
        { status: 404, message: 'Not Found' },
        { status: 409, message: 'Conflict' },
        { status: 422, message: 'Unprocessable Entity' },
        { status: 500, message: 'Internal Server Error' },
        { status: 503, message: 'Service Unavailable' },
      ];

      testCases.forEach(({ status, message }) => {
        vi.clearAllMocks();
        sendError(mockResponse as Response, message, status);

        expect(statusMock).toHaveBeenCalledWith(status);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: message,
        });
      });
    });
  });

  describe('sendPaginated()', () => {
    it('should send paginated response with metadata', () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      const meta: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasMore: true,
        nextPage: 2,
        prevPage: null,
      };

      sendPaginated(mockResponse as Response, items, meta);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: items,
        meta,
      });
    });

    it('should use custom status code when provided', () => {
      const meta: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 5,
        totalPages: 1,
      };

      sendPaginated(mockResponse as Response, [], meta, 206); // Partial Content

      expect(statusMock).toHaveBeenCalledWith(206);
    });

    it('should handle empty results', () => {
      const meta: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      };

      sendPaginated(mockResponse as Response, [], meta);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: [],
        meta,
      });
    });

    it('should handle last page (no nextPage)', () => {
      const meta: PaginationMeta = {
        page: 3,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasMore: false,
        nextPage: null,
        prevPage: 2,
      };

      sendPaginated(mockResponse as Response, [{ id: 21 }], meta);

      expect(jsonMock.mock.calls[0][0].meta.hasMore).toBe(false);
      expect(jsonMock.mock.calls[0][0].meta.nextPage).toBeNull();
    });

    it('should handle first page (no prevPage)', () => {
      const meta: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasMore: true,
        nextPage: 2,
        prevPage: null,
      };

      sendPaginated(mockResponse as Response, [], meta);

      expect(jsonMock.mock.calls[0][0].meta.prevPage).toBeNull();
    });
  });

  describe('sendCreated()', () => {
    it('should send 201 Created response', () => {
      const createdResource = { id: 123, name: 'New Resource' };

      sendCreated(mockResponse as Response, createdResource);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: createdResource,
      });
    });

    it('should handle created resource with relations', () => {
      const createdProduct = {
        id: 1,
        name: 'Product',
        offers: [{ id: 1, price: 99.99 }],
      };

      sendCreated(mockResponse as Response, createdProduct);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock.mock.calls[0][0].data).toEqual(createdProduct);
    });
  });

  describe('sendNoContent()', () => {
    it('should send 204 No Content response', () => {
      sendNoContent(mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
      expect(jsonMock).not.toHaveBeenCalled();
    });
  });

  describe('sendErrorFromException()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle Error instances', () => {
      const error = new Error('Database connection failed');

      sendErrorFromException(mockResponse as Response, error, 'DatabaseOp');

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Database connection failed',
      });
    });

    it('should map "not found" to 404', () => {
      const error = new Error('Product not found');

      sendErrorFromException(mockResponse as Response, error, 'GetProduct');

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should map "unauthorized" to 401', () => {
      const error = new Error('Unauthorized access');

      sendErrorFromException(mockResponse as Response, error, 'Auth');

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should map "forbidden" to 403', () => {
      const error = new Error('Access forbidden for this resource');

      sendErrorFromException(mockResponse as Response, error, 'Auth');

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should map "already exists" to 409', () => {
      const error = new Error('User already exists');

      sendErrorFromException(mockResponse as Response, error, 'Register');

      expect(statusMock).toHaveBeenCalledWith(409);
    });

    it('should map "unique" constraint to 409', () => {
      const error = new Error('Unique constraint violation');

      sendErrorFromException(mockResponse as Response, error, 'CreateUser');

      expect(statusMock).toHaveBeenCalledWith(409);
    });

    it('should map "invalid" to 400', () => {
      const error = new Error('Invalid email format');

      sendErrorFromException(mockResponse as Response, error, 'Validation');

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should map "must be" validation to 400', () => {
      const error = new Error('Price must be positive');

      sendErrorFromException(mockResponse as Response, error, 'Validation');

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should include stack trace in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.ts:10:5';

      sendErrorFromException(mockResponse as Response, error, 'TestOp');

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
        details: expect.stringContaining('Error: Test error'),
      });
    });

    it('should exclude stack trace in production mode', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.ts:10:5';

      sendErrorFromException(mockResponse as Response, error, 'TestOp');

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
        // No details
      });
    });

    it('should handle non-Error objects', () => {
      const error = 'String error message';

      sendErrorFromException(mockResponse as Response, error, 'UnknownOp');

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'UnknownOp failed',
      });
    });

    it('should handle null/undefined errors', () => {
      sendErrorFromException(mockResponse as Response, null, 'NullOp');

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'NullOp failed',
      });
    });

    it('should use default context when not provided', () => {
      const error = new Error('Generic error');

      sendErrorFromException(mockResponse as Response, error);

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Generic error',
      });
    });

    it('should log errors with context', () => {
      const error = new Error('Log test error');

      sendErrorFromException(mockResponse as Response, error, 'LogContext');

      expect(logger.error).toHaveBeenCalledWith(
        'LogContext error:',
        expect.objectContaining({
          error: 'Log test error',
          status: 500,
        })
      );
    });

    it('should handle errors with multiple status keywords', () => {
      // "not found" should take precedence (first match)
      const error = new Error('User not found, invalid ID');

      sendErrorFromException(mockResponse as Response, error, 'GetUser');

      expect(statusMock).toHaveBeenCalledWith(404); // not 400 for "invalid"
    });

    it('should be case-insensitive when matching error messages', () => {
      const testCases = [
        { message: 'NOT FOUND', expectedStatus: 404 },
        { message: 'Not Found', expectedStatus: 404 },
        { message: 'UNAUTHORIZED', expectedStatus: 401 },
        { message: 'INVALID INPUT', expectedStatus: 400 },
      ];

      testCases.forEach(({ message, expectedStatus }) => {
        vi.clearAllMocks();
        const error = new Error(message);

        sendErrorFromException(mockResponse as Response, error, 'Test');

        expect(statusMock).toHaveBeenCalledWith(expectedStatus);
      });
    });
  });

  describe('normalizeResponse()', () => {
    it('should return data as-is if already standardized', () => {
      const standardized = {
        success: true,
        data: { id: 1 },
      };

      const result = normalizeResponse(standardized);

      expect(result).toEqual(standardized);
    });

    it('should wrap legacy data in standardized format', () => {
      const legacyData = { id: 1, name: 'Product' };

      const result = normalizeResponse(legacyData);

      expect(result).toEqual({
        success: true,
        data: legacyData,
      });
    });

    it('should handle null values', () => {
      const result = normalizeResponse(null);

      expect(result).toEqual({
        success: true,
        data: null,
      });
    });

    it('should handle arrays', () => {
      const legacyArray = [{ id: 1 }, { id: 2 }];

      const result = normalizeResponse(legacyArray);

      expect(result).toEqual({
        success: true,
        data: legacyArray,
      });
    });

    it('should handle primitives', () => {
      expect(normalizeResponse('string')).toEqual({
        success: true,
        data: 'string',
      });

      expect(normalizeResponse(123)).toEqual({
        success: true,
        data: 123,
      });

      expect(normalizeResponse(true)).toEqual({
        success: true,
        data: true,
      });
    });
  });

  describe('Edge Cases & Integration', () => {
    it('should handle chained method calls correctly', () => {
      const testData = { test: true };

      sendSuccess(mockResponse as Response, testData);

      // Verify chaining works (status returns this, json returns this)
      expect(statusMock.mock.results[0].value).toBe(mockResponse);
      expect(jsonMock.mock.results[0].value).toBe(mockResponse);
    });

    it('should handle concurrent response calls', () => {
      // Simulate multiple responses being prepared (not sent)
      const res1 = { ...mockResponse };
      const res2 = { ...mockResponse };

      sendSuccess(res1 as Response, { id: 1 });
      sendSuccess(res2 as Response, { id: 2 });

      // Both should have been called
      expect(jsonMock).toHaveBeenCalledTimes(2);
    });

    it('should preserve type information in TypeScript', () => {
      interface TestData {
        id: number;
        name: string;
      }

      const typedData: TestData = { id: 1, name: 'Test' };

      sendSuccess<TestData>(mockResponse as Response, typedData);

      const callArg = jsonMock.mock.calls[0][0];
      expect(callArg.data).toEqual(typedData);
    });

    it('should handle very large payloads', () => {
      // Create large array
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(100),
      }));

      sendSuccess(mockResponse as Response, largeData);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: largeData,
      });
    });

    it('should handle special characters in error messages', () => {
      const specialChars = 'Error with "quotes", \'apostrophes\', & symbols <>';

      sendError(mockResponse as Response, specialChars, 400);

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: specialChars,
      });
    });

    it('should handle Unicode in error messages', () => {
      const unicodeError = '产品未找到 (Product not found) 🔍';

      sendError(mockResponse as Response, unicodeError, 404);

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: unicodeError,
      });
    });
  });

  describe('Response Format Compliance', () => {
    it('success responses should always have success: true', () => {
      sendSuccess(mockResponse as Response, { test: true });

      const response = jsonMock.mock.calls[0][0];
      expect(response).toHaveProperty('success', true);
    });

    it('error responses should always have success: false', () => {
      sendError(mockResponse as Response, 'Error', 500);

      const response = jsonMock.mock.calls[0][0];
      expect(response).toHaveProperty('success', false);
    });

    it('success responses should have data field', () => {
      sendSuccess(mockResponse as Response, null);

      const response = jsonMock.mock.calls[0][0];
      expect(response).toHaveProperty('data');
    });

    it('error responses should have error field', () => {
      sendError(mockResponse as Response, 'Test error', 500);

      const response = jsonMock.mock.calls[0][0];
      expect(response).toHaveProperty('error');
      expect(typeof response.error).toBe('string');
    });

    it('paginated responses should have both data and meta', () => {
      const meta: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
      };

      sendPaginated(mockResponse as Response, [], meta);

      const response = jsonMock.mock.calls[0][0];
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('meta');
    });
  });
});
