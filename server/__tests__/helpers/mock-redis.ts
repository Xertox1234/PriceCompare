/**
 * Shared Redis Mock for Tests
 *
 * Centralizes the Redis client mock to eliminate duplication across test files.
 * Import this file to apply the mock automatically.
 *
 * @example
 * ```typescript
 * import './helpers/mock-redis';
 * // Redis client is now mocked
 * ```
 */

import { vi } from 'vitest';

// Create the mock client once
const mockRedisClient = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  scan: vi.fn(),
  publish: vi.fn(),
  // Popularity tracker methods
  pipeline: vi.fn(() => ({
    zincrby: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
  zincrby: vi.fn(),
  zscore: vi.fn(),
  zrevrange: vi.fn(),
  zcard: vi.fn(),
  zpopmin: vi.fn(),
  duplicate: vi.fn(() => ({
    subscribe: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
  })),
};

vi.mock('../../config/redis', () => ({
  redisClient: mockRedisClient,
  getRedisClient: vi.fn(() => mockRedisClient),
  getRedisSessionClient: vi.fn(() => null),
  isRedisConnected: vi.fn(() => true),
  initializeRedis: vi.fn(() => Promise.resolve()),
  closeRedis: vi.fn(() => Promise.resolve()),
}));
