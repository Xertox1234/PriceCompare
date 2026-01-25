/**
 * Redis Mock Factory
 *
 * Provides complete Redis mock implementations for testing.
 * Prevents "X is not a function" errors by including all methods
 * that code paths might call.
 *
 * Usage:
 *   import { createRedisMock, createRedisClientMock } from '../../test/mocks/redis-mock';
 *
 *   vi.mock('../../config/redis', () => createRedisMock());
 *
 * Pattern: docs/08_TESTING_PATTERNS.md#mock-completeness-for-redis
 * Source: Test debugging session 2026-01-17
 */

import { vi } from 'vitest';

/**
 * Create a complete Redis client mock with all common methods
 *
 * Includes:
 * - String operations (get, set, del, exists, expire, ttl)
 * - Hash operations (hget, hset, hdel, hgetall, hincrby, hincrbyfloat)
 * - List operations (lpush, rpush, lpop, rpop, lrange)
 * - Set operations (sadd, srem, smembers, sismember)
 * - Sorted set operations (zadd, zrem, zrange, zscore)
 * - Key operations (keys, scan, del, exists)
 * - Transaction operations (multi, exec)
 * - Pub/Sub operations (publish, subscribe)
 */
export function createRedisClientMock(overrides: Record<string, unknown> = {}) {
  return {
    // Connection
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    isOpen: true,
    isReady: true,

    // String operations
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setEx: vi.fn().mockResolvedValue('OK'),
    setNX: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(true),
    expireAt: vi.fn().mockResolvedValue(true),
    ttl: vi.fn().mockResolvedValue(-1),
    incr: vi.fn().mockResolvedValue(1),
    incrBy: vi.fn().mockResolvedValue(1),
    decr: vi.fn().mockResolvedValue(0),
    decrBy: vi.fn().mockResolvedValue(0),

    // Hash operations
    hget: vi.fn().mockResolvedValue(null),
    hset: vi.fn().mockResolvedValue(1),
    hdel: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
    hmset: vi.fn().mockResolvedValue('OK'),
    hmget: vi.fn().mockResolvedValue([]),
    hincrby: vi.fn().mockResolvedValue(1),
    hincrbyfloat: vi.fn().mockResolvedValue('1.0'),
    hexists: vi.fn().mockResolvedValue(false),
    hkeys: vi.fn().mockResolvedValue([]),
    hvals: vi.fn().mockResolvedValue([]),
    hlen: vi.fn().mockResolvedValue(0),

    // List operations
    lpush: vi.fn().mockResolvedValue(1),
    rpush: vi.fn().mockResolvedValue(1),
    lpop: vi.fn().mockResolvedValue(null),
    rpop: vi.fn().mockResolvedValue(null),
    lrange: vi.fn().mockResolvedValue([]),
    llen: vi.fn().mockResolvedValue(0),
    lindex: vi.fn().mockResolvedValue(null),
    lset: vi.fn().mockResolvedValue('OK'),
    lrem: vi.fn().mockResolvedValue(0),

    // Set operations
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    sismember: vi.fn().mockResolvedValue(false),
    scard: vi.fn().mockResolvedValue(0),
    spop: vi.fn().mockResolvedValue(null),
    srandmember: vi.fn().mockResolvedValue(null),

    // Sorted set operations
    zadd: vi.fn().mockResolvedValue(1),
    zrem: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    zrangeWithScores: vi.fn().mockResolvedValue([]),
    zrevrange: vi.fn().mockResolvedValue([]),
    zscore: vi.fn().mockResolvedValue(null),
    zcard: vi.fn().mockResolvedValue(0),
    zrank: vi.fn().mockResolvedValue(null),
    zincrby: vi.fn().mockResolvedValue('1'),

    // Key operations
    keys: vi.fn().mockResolvedValue([]),
    scan: vi.fn().mockResolvedValue({ cursor: 0, keys: [] }),
    type: vi.fn().mockResolvedValue('none'),
    rename: vi.fn().mockResolvedValue('OK'),

    // Transaction operations
    multi: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
    watch: vi.fn().mockResolvedValue('OK'),
    unwatch: vi.fn().mockResolvedValue('OK'),

    // Pub/Sub operations
    publish: vi.fn().mockResolvedValue(0),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    psubscribe: vi.fn().mockResolvedValue(undefined),
    punsubscribe: vi.fn().mockResolvedValue(undefined),

    // Lua scripting
    eval: vi.fn().mockResolvedValue(null),
    evalsha: vi.fn().mockResolvedValue(null),

    // Server operations
    ping: vi.fn().mockResolvedValue('PONG'),
    info: vi.fn().mockResolvedValue(''),
    flushAll: vi.fn().mockResolvedValue('OK'),
    flushDb: vi.fn().mockResolvedValue('OK'),

    // Apply overrides
    ...overrides,
  };
}

/**
 * Create a complete vi.mock() replacement for ../../config/redis
 *
 * Includes:
 * - getRedisClient() - Returns ioredis-style client for caching
 * - getRedisSessionClient() - Returns redis-style client for sessions
 * - redisClient - Direct client reference (deprecated)
 *
 * @example
 * vi.mock('../../config/redis', () => createRedisMock());
 *
 * @example With custom overrides
 * vi.mock('../../config/redis', () => createRedisMock({
 *   getRedisClient: vi.fn(() => ({
 *     get: vi.fn().mockResolvedValue('cached-value'),
 *   })),
 * }));
 */
export function createRedisMock(overrides: Record<string, unknown> = {}) {
  const clientMock = createRedisClientMock();

  return {
    // Primary getter for ioredis client (caching, rate limiting)
    getRedisClient: vi.fn(() => clientMock),

    // Session client getter (connect-redis v9)
    getRedisSessionClient: vi.fn(() => null),

    // Direct client reference (legacy, prefer getRedisClient)
    redisClient: clientMock,

    // Apply overrides
    ...overrides,
  };
}

/**
 * Create a null Redis mock (for tests that don't need Redis)
 *
 * All getters return null, simulating Redis being unavailable.
 * Useful for testing graceful degradation.
 */
export function createNullRedisMock() {
  return {
    getRedisClient: vi.fn(() => null),
    getRedisSessionClient: vi.fn(() => null),
    redisClient: null,
  };
}

/**
 * Create an in-memory Redis mock that actually stores data
 *
 * Useful for integration-style tests where you need real
 * get/set behavior without actual Redis.
 */
export function createInMemoryRedisMock() {
  const store = new Map<string, string>();
  const hashStore = new Map<string, Map<string, string>>();

  return createRedisClientMock({
    get: vi.fn((key: string) => Promise.resolve(store.get(key) || null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    }),
    exists: vi.fn((key: string) => Promise.resolve(store.has(key) ? 1 : 0)),
    hget: vi.fn((key: string, field: string) => {
      const hash = hashStore.get(key);
      return Promise.resolve(hash?.get(field) || null);
    }),
    hset: vi.fn((key: string, field: string, value: string) => {
      if (!hashStore.has(key)) hashStore.set(key, new Map());
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Key just set above
      hashStore.get(key)!.set(field, value);
      return Promise.resolve(1);
    }),
    hgetall: vi.fn((key: string) => {
      const hash = hashStore.get(key);
      if (!hash) return Promise.resolve({});
      return Promise.resolve(Object.fromEntries(hash));
    }),
    // Clear method for test cleanup
    _clear: () => {
      store.clear();
      hashStore.clear();
    },
  });
}
