/**
 * Mock Types for Test Files
 * 
 * Provides type-safe mock interfaces to replace `any` types in tests.
 * These types use ReturnType<typeof vi.fn> for mock functions.
 */

import type { Mock } from 'vitest';

/**
 * Type helper for vitest mock functions
 */
export type MockFn<T = unknown> = Mock<(...args: unknown[]) => T>;

/**
 * Mock Redis client interface for testing
 * Covers common Redis operations used in tests
 */
export interface MockRedisClient {
  get: MockFn<Promise<string | null>>;
  set: MockFn<Promise<void>>;
  setex: MockFn<Promise<void>>;
  del: MockFn<Promise<number>>;
  keys: MockFn<Promise<string[]>>;
  scan: MockFn<Promise<[string, string[]]>>;
  publish: MockFn<Promise<number>>;
  incr: MockFn<Promise<number>>;
  expire: MockFn<Promise<number>>;
  zscore: MockFn<Promise<string | null>>;
  zincrby: MockFn<Promise<string>>;
  zrevrange: MockFn<Promise<string[]>>;
  zcard: MockFn<Promise<number>>;
  zpopmin: MockFn<Promise<string[]>>;
  pipeline: MockFn<MockRedisPipeline>;
  duplicate: MockFn<MockRedisSubscriber>;
}

/**
 * Mock Redis pipeline interface
 */
export interface MockRedisPipeline {
  zincrby: MockFn<MockRedisPipeline>;
  expire: MockFn<MockRedisPipeline>;
  exec: MockFn<Promise<unknown[]>>;
}

/**
 * Mock Redis subscriber (from duplicate())
 */
export interface MockRedisSubscriber {
  subscribe: MockFn<Promise<void>>;
  on: MockFn<void>;
  quit: MockFn<Promise<void>>;
}

/**
 * Mock Storage interface for database tests
 */
export interface MockStorage {
  getProductById: MockFn<Promise<unknown>>;
  getRetailers: MockFn<Promise<unknown[]>>;
  createProduct: MockFn<Promise<unknown>>;
  updateProduct: MockFn<Promise<unknown>>;
  deleteProduct: MockFn<Promise<void>>;
  getPriceHistory: MockFn<Promise<unknown[]>>;
}

/**
 * Mock Express Request interface for middleware tests
 */
export interface MockRequest {
  body: Record<string, unknown>;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  ip: string;
  user?: { id: number; role: string };
  session?: Record<string, unknown>;
}

/**
 * Mock Express Response interface for middleware tests
 */
export interface MockResponse {
  status: MockFn<MockResponse>;
  json: MockFn<MockResponse>;
  send: MockFn<MockResponse>;
  set: MockFn<MockResponse>;
  setHeader: MockFn<void>;
  getHeader: MockFn<string | undefined>;
  locals: Record<string, unknown>;
}

/**
 * Mock WebSocket interface for socket tests
 */
export interface MockSocket {
  id: string;
  userId?: number;
  handshake: {
    address: string;
    headers: Record<string, string>;
  };
  join: MockFn<void>;
  leave: MockFn<void>;
  emit: MockFn<void>;
  on: MockFn<void>;
  off: MockFn<void>;
  disconnect: MockFn<void>;
  rooms: Set<string>;
}

/**
 * Helper function to create a type-safe mock function
 * Usage: const mockFn = createMockFn<(arg: string) => Promise<number>>();
 */
export function createMockFn<T extends (...args: never[]) => unknown>(): Mock<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vi.fn();
}
