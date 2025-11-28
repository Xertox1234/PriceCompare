import { bench, describe } from 'vitest';
import type { Response } from 'express';
import {
  sendSuccess,
  sendError,
  sendPaginated,
  sendErrorFromException,
  type PaginationMeta,
} from '../api-response';

/**
 * Performance Benchmarks for API Response Helpers
 *
 * Measures the overhead of response formatting helpers.
 * Run with: npm run test:bench or vitest bench
 *
 * Baseline expectations:
 * - sendSuccess: <1ms for typical payloads
 * - sendError: <0.5ms
 * - sendPaginated: <1ms
 * - Large payloads (10K items): <10ms
 * - Very large payloads (100K items): <100ms
 */

// Mock response object
function createMockResponse(): Partial<Response> {
  const mockResponse: Partial<Response> = {
    status: () => mockResponse as Response,
    json: () => mockResponse as Response,
    send: () => mockResponse as Response,
    locals: {},
  };
  return mockResponse;
}

describe('API Response Helpers - Performance Benchmarks', () => {
  describe('sendSuccess() benchmarks', () => {
    bench('small payload (10 fields)', () => {
      const res = createMockResponse();
      const data = {
        id: 1,
        name: 'Product',
        price: 99.99,
        category: 'Electronics',
        brand: 'TestBrand',
        inStock: true,
        rating: 4.5,
        reviews: 100,
        sku: 'ABC123',
        image: 'https://example.com/image.jpg',
      };

      sendSuccess(res as Response, data);
    });

    bench('medium payload (100 items array)', () => {
      const res = createMockResponse();
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Product ${i}`,
        price: Math.random() * 1000,
      }));

      sendSuccess(res as Response, data);
    });

    bench('large payload (1K items array)', () => {
      const res = createMockResponse();
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Product ${i}`,
        price: Math.random() * 1000,
        description: 'Lorem ipsum dolor sit amet',
        category: 'Electronics',
      }));

      sendSuccess(res as Response, data);
    });

    bench('very large payload (10K items array)', () => {
      const res = createMockResponse();
      const data = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Product ${i}`,
        price: Math.random() * 1000,
      }));

      sendSuccess(res as Response, data);
    });

    bench('with metadata', () => {
      const res = createMockResponse();
      res.locals = { requestId: 'req-123' };

      const data = { id: 1, name: 'Product' };

      sendSuccess(res as Response, data, 200, {
        version: '2.0',
        requestId: 'custom-id',
      });
    });
  });

  describe('sendError() benchmarks', () => {
    bench('simple error message', () => {
      const res = createMockResponse();

      sendError(res as Response, 'Something went wrong', 500);
    });

    bench('error with details (development)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const res = createMockResponse();
      const stackTrace = 'Error: Test\n    at file.ts:10:5\n    at file.ts:20:3';

      sendError(res as Response, 'Error occurred', 500, stackTrace);

      process.env.NODE_ENV = originalEnv;
    });

    bench('error without details (production)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = createMockResponse();
      const stackTrace = 'Error: Test\n    at file.ts:10:5';

      sendError(res as Response, 'Error occurred', 500, stackTrace);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('sendPaginated() benchmarks', () => {
    bench('paginated - 10 items', () => {
      const res = createMockResponse();
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      const meta: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
      };

      sendPaginated(res as Response, items, meta);
    });

    bench('paginated - 100 items', () => {
      const res = createMockResponse();
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const meta: PaginationMeta = {
        page: 1,
        limit: 100,
        total: 1000,
        totalPages: 10,
      };

      sendPaginated(res as Response, items, meta);
    });

    bench('paginated - 1K items', () => {
      const res = createMockResponse();
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      const meta: PaginationMeta = {
        page: 1,
        limit: 1000,
        total: 10000,
        totalPages: 10,
      };

      sendPaginated(res as Response, items, meta);
    });
  });

  describe('sendErrorFromException() benchmarks', () => {
    bench('Error instance with simple message', () => {
      const res = createMockResponse();
      const error = new Error('Something failed');

      sendErrorFromException(res as Response, error, 'TestOp');
    });

    bench('Error with status code mapping', () => {
      const res = createMockResponse();
      const error = new Error('Product not found');

      sendErrorFromException(res as Response, error, 'GetProduct');
    });

    bench('Error with stack trace (development)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const res = createMockResponse();
      const error = new Error('Test error');
      error.stack = 'Error: Test\n    at file.ts:10:5\n    at file.ts:20:3\n    at file.ts:30:1';

      sendErrorFromException(res as Response, error, 'TestOp');

      process.env.NODE_ENV = originalEnv;
    });

    bench('Non-Error object', () => {
      const res = createMockResponse();

      sendErrorFromException(res as Response, 'String error', 'TestOp');
    });
  });

  describe('Stress tests - extreme payloads', () => {
    bench('100K items array', () => {
      const res = createMockResponse();
      const data = Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        value: Math.random(),
      }));

      sendSuccess(res as Response, data);
    });

    bench('deep nested object (10 levels)', () => {
      const res = createMockResponse();
      let data: Record<string, unknown> = { leaf: 'value' };

      for (let i = 0; i < 10; i++) {
        data = { level: i, nested: data };
      }

      sendSuccess(res as Response, data);
    });

    bench('large strings (1MB total)', () => {
      const res = createMockResponse();
      const largeString = 'x'.repeat(1024 * 100); // 100KB string

      const data = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        content: largeString,
      }));

      sendSuccess(res as Response, data);
    });
  });

  describe('Comparison - overhead vs direct json()', () => {
    bench('baseline: direct res.json() call', () => {
      const res = createMockResponse();
      const data = { id: 1, name: 'Product' };

      (res as Response).status(200).json(data);
    });

    bench('sendSuccess() wrapper overhead', () => {
      const res = createMockResponse();
      const data = { id: 1, name: 'Product' };

      sendSuccess(res as Response, data);
    });

    bench('baseline: manual error response', () => {
      const res = createMockResponse();

      (res as Response).status(500).json({
        error: 'Something went wrong',
      });
    });

    bench('sendError() wrapper overhead', () => {
      const res = createMockResponse();

      sendError(res as Response, 'Something went wrong', 500);
    });
  });
});
