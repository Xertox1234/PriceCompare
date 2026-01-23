/**
 * Test Fixtures and Utilities
 *
 * Centralized test utilities to eliminate duplication across test files.
 * Provides factory functions for creating test data, mock objects, and
 * test context management.
 *
 * Usage:
 * ```typescript
 * import { createTestProduct, createMockRedis, setupTestTransaction } from './helpers/test-fixtures';
 *
 * const product = createTestProduct({ name: 'Custom Name' });
 * const mockRedis = createMockRedis();
 * ```
 *
 * @see docs/08_TESTING_PATTERNS.md - Testing patterns and best practices
 */

import { vi } from 'vitest';
import { sql } from 'drizzle-orm';
import type { Product, Retailer, PriceHistory, ProductOffer } from '@shared/schema';
import type { MockRedisClient } from './mock-types';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type * as schema from '@shared/schema';

/**
 * Database type union (supports both pg and neon drivers)
 */
type Database = NodePgDatabase<typeof schema> | NeonDatabase<typeof schema>;

/**
 * Test context with common test utilities
 * Provides capturedValues for tracking mock calls and a reset method
 */
export interface TestContext {
  capturedValues: Map<string, unknown>;
  capturedCalls: Map<string, unknown[][]>;
  mockDb: Partial<Database>;
  mockRedis: MockRedisClient;
  reset: () => void;
}

/**
 * Create a test context with common test utilities
 *
 * @returns Test context with captured values, calls, mocks, and reset method
 *
 * @example
 * ```typescript
 * const ctx = createTestContext();
 * ctx.capturedValues.set('userId', 123);
 * ctx.capturedCalls.set('getUser', [[123]]);
 * ctx.reset(); // Clear all captured data
 * ```
 */
export function createTestContext(): TestContext {
  const capturedValues = new Map<string, unknown>();
  const capturedCalls = new Map<string, unknown[][]>();
  const mockDb = createMockDb();
  const mockRedis = createMockRedis();

  const reset = () => {
    capturedValues.clear();
    capturedCalls.clear();
    vi.clearAllMocks();
  };

  return {
    capturedValues,
    capturedCalls,
    mockDb,
    mockRedis,
    reset,
  };
}

/**
 * Create a mock database instance for testing
 *
 * Provides chainable mock methods for Drizzle ORM operations.
 * Use this for unit tests where you don't need a real database.
 *
 * @returns Partial database mock with common Drizzle methods
 *
 * @example
 * ```typescript
 * const mockDb = createMockDb();
 * const selectMock = mockDb.select as ReturnType<typeof vi.fn>;
 * selectMock.mockReturnValue({
 *   from: vi.fn().mockReturnThis(),
 *   where: vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }])
 * });
 * ```
 */
export function createMockDb(): Partial<Database> {
  const selectMock = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue([]),
  });

  const insertMock = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      onConflictDoNothing: vi.fn().mockResolvedValue([]),
    }),
  });

  const updateMock = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  });

  const deleteMock = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  });

  const transactionMock = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    // Execute callback with the mock db as transaction context
    return await callback(createMockDb());
  });

  const executeMock = vi.fn().mockResolvedValue(undefined);

  return {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    transaction: transactionMock,
    execute: executeMock,
  } as Partial<Database>;
}

/**
 * Create a mock Redis client for testing
 *
 * Provides mock implementations of common Redis operations.
 * All methods return resolved promises by default.
 *
 * @returns Mock Redis client with common methods
 *
 * @example
 * ```typescript
 * const mockRedis = createMockRedis();
 * mockRedis.get.mockResolvedValue('cached-value');
 * mockRedis.setex.mockResolvedValue();
 * ```
 */
export function createMockRedis(): MockRedisClient {
  return {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve()),
    setex: vi.fn(() => Promise.resolve()),
    del: vi.fn(() => Promise.resolve(0)),
    keys: vi.fn(() => Promise.resolve([])),
    scan: vi.fn(() => Promise.resolve(['0', []] as [string, string[]])),
    publish: vi.fn(() => Promise.resolve(0)),
    incr: vi.fn(() => Promise.resolve(1)),
    expire: vi.fn(() => Promise.resolve(1)),
    zscore: vi.fn(() => Promise.resolve(null)),
    zincrby: vi.fn(() => Promise.resolve('1')),
    zrevrange: vi.fn(() => Promise.resolve([])),
    zcard: vi.fn(() => Promise.resolve(0)),
    zpopmin: vi.fn(() => Promise.resolve([])),
    pipeline: vi.fn(() => ({
      zincrby: vi.fn(function (this: unknown) {
        return this;
      }),
      expire: vi.fn(function (this: unknown) {
        return this;
      }),
      exec: vi.fn(() => Promise.resolve([])),
    })) as MockRedisClient['pipeline'],
    duplicate: vi.fn(() => ({
      subscribe: vi.fn(() => Promise.resolve()),
      on: vi.fn(() => undefined),
      quit: vi.fn(() => Promise.resolve()),
    })) as MockRedisClient['duplicate'],
  };
}

/**
 * Create a test product fixture with sensible defaults
 *
 * NOTE: Does NOT include `id` field - database will auto-generate it.
 * If you need a specific ID for testing, pass it in overrides.
 *
 * @param overrides - Partial product data to override defaults
 * @returns Product insert data (without id)
 *
 * @example
 * ```typescript
 * const product = createTestProduct({ name: 'iPhone 15', category: 'Smartphones' });
 * const savedProduct = await db.insert(products).values(product).returning();
 * ```
 */
export function createTestProduct(overrides?: Partial<Product>): Omit<Product, 'id'> {
  const now = new Date();
  now.setHours(12, 0, 0, 0); // Noon local time (timezone-safe)

  return {
    name: 'Test Product',
    description: 'A test product for automated testing',
    category: 'Electronics',
    image: 'https://example.com/test-product.jpg',
    brand: 'Test Brand',
    model: 'TEST-001',
    embedding: null,
    embeddingUpdatedAt: null,
    searchVector: null,
    createdAt: now,
    ...overrides,
  };
}

/**
 * Create a test retailer fixture with sensible defaults
 *
 * NOTE: Does NOT include `id` field - database will auto-generate it.
 * If you need a specific ID for testing, pass it in overrides.
 *
 * @param overrides - Partial retailer data to override defaults
 * @returns Retailer insert data (without id)
 *
 * @example
 * ```typescript
 * const retailer = createTestRetailer({ name: 'Amazon', website: 'https://amazon.com' });
 * const savedRetailer = await db.insert(retailers).values(retailer).returning();
 * ```
 */
export function createTestRetailer(overrides?: Partial<Retailer>): Omit<Retailer, 'id'> {
  return {
    name: 'Test Retailer',
    logo: 'https://example.com/test-logo.png',
    website: 'https://testretailer.com',
    isActive: true,
    affiliateId: null,
    affiliateProgram: null,
    baseAffiliateUrl: null,
    commissionRate: null,
    affiliateStatus: 'inactive',
    affiliateConfig: null,
    countryCode: 'US',
    currency: 'USD',
    ...overrides,
  };
}

/**
 * Create a test product offer fixture with sensible defaults
 *
 * NOTE: Does NOT include `id` field - database will auto-generate it.
 * If you need a specific ID for testing, pass it in overrides.
 *
 * @param overrides - Partial offer data to override defaults
 * @returns Product offer insert data (without id)
 *
 * @example
 * ```typescript
 * const offer = createTestProductOffer({
 *   productId: 1,
 *   retailerId: 1,
 *   price: '99.99'
 * });
 * await db.insert(productOffers).values(offer);
 * ```
 */
export function createTestProductOffer(
  overrides?: Partial<ProductOffer>
): Omit<ProductOffer, 'id'> {
  const now = new Date();
  now.setHours(12, 0, 0, 0); // Noon local time (timezone-safe)

  return {
    productId: 1,
    retailerId: 1,
    price: '99.99',
    originalPrice: null,
    availability: 'in_stock',
    rating: null,
    reviewCount: 0,
    shippingInfo: null,
    dealType: null,
    productUrl: 'https://testretailer.com/product/1',
    affiliateUrl: null,
    linkHealthStatus: 'unknown',
    lastLinkCheck: null,
    clickCount: 0,
    lastUpdated: now,
    ...overrides,
  };
}

/**
 * Create a test price history fixture with sensible defaults
 *
 * Uses timezone-safe dates (noon local time) to avoid date boundary issues.
 * NOTE: Does NOT include `id` field - database will auto-generate it.
 *
 * @param overrides - Partial price history data to override defaults
 * @returns Price history insert data (without id)
 *
 * @example
 * ```typescript
 * const yesterday = new Date();
 * yesterday.setDate(yesterday.getDate() - 1);
 * yesterday.setHours(12, 0, 0, 0);
 *
 * const history = createTestPriceHistory({
 *   productId: 1,
 *   retailerId: 1,
 *   price: '89.99',
 *   recordedAt: yesterday
 * });
 * await db.insert(priceHistory).values(history);
 * ```
 */
export function createTestPriceHistory(
  overrides?: Partial<PriceHistory>
): Omit<PriceHistory, 'id'> {
  const now = new Date();
  now.setHours(12, 0, 0, 0); // Noon local time (timezone-safe)

  return {
    productOfferId: 1,
    productId: 1,
    retailerId: 1,
    price: '99.99',
    originalPrice: null,
    availability: null,
    rating: null,
    reviewCount: null,
    source: 'scraper',
    confidence: '1.00',
    metadata: null,
    recordedAt: now,
    aggregatedAt: null,
    createdAt: now,
    ...overrides,
  };
}

/**
 * Setup a test transaction for integration tests
 *
 * Creates a transaction context for tests that need to verify
 * transactional behavior or rollback on errors.
 *
 * @param db - Database instance
 * @returns Transaction context for test operations
 *
 * @example
 * ```typescript
 * const tx = setupTestTransaction(db);
 * await tx.insert(products).values(testProduct);
 * // Use TRUNCATE CASCADE in beforeEach for isolation instead of rollback
 * ```
 */
export function setupTestTransaction<TSchema extends Record<string, unknown>>(
  db: NodePgDatabase<TSchema> | NeonDatabase<TSchema>
): NodePgDatabase<TSchema> | NeonDatabase<TSchema> {
  // Return the database instance for transaction testing
  // In a real implementation, this would start a transaction and return the tx context
  // For now, return the database directly as tests use TRUNCATE CASCADE for isolation
  return db;
}

/**
 * Clean up test data from specified tables using TRUNCATE CASCADE
 *
 * TRUNCATE CASCADE automatically cleans child tables (prevents foreign key violations)
 * and resets auto-increment sequences. Use in beforeEach/afterEach hooks.
 *
 * @param db - Database instance
 * @param tables - Array of table names to truncate
 *
 * @example
 * ```typescript
 * beforeEach(async () => {
 *   await cleanupTestData(db, [
 *     'price_aggregates_daily',
 *     'price_history',
 *     'product_offers',
 *     'products',
 *     'retailers'
 *   ]);
 * });
 * ```
 *
 * @see docs/08_TESTING_PATTERNS.md - TRUNCATE CASCADE pattern
 * @see docs/02_DATABASE_PATTERNS.md - Section 8.1
 */
export async function cleanupTestData(db: Database, tables: string[]): Promise<void> {
  for (const table of tables) {
    await db.execute(sql.raw(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`));
  }
}

/**
 * Create multiple test products with sequential names
 *
 * NOTE: Does NOT include `id` fields - database will auto-generate them.
 *
 * @param count - Number of products to create
 * @param overrides - Base overrides to apply to all products
 * @returns Array of product insert data (without ids)
 *
 * @example
 * ```typescript
 * const products = createTestProducts(5, { category: 'Laptops' });
 * await db.insert(products).values(products);
 * ```
 */
export function createTestProducts(
  count: number,
  overrides?: Partial<Product>
): Array<Omit<Product, 'id'>> {
  return Array.from({ length: count }, (_, i) =>
    createTestProduct({
      name: `Test Product ${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create multiple test price history records with sequential timestamps
 *
 * NOTE: Does NOT include `id` fields - database will auto-generate them.
 *
 * @param count - Number of price history records to create
 * @param baseDate - Starting date (defaults to 7 days ago at noon)
 * @param overrides - Base overrides to apply to all records
 * @returns Array of price history insert data (without ids)
 *
 * @example
 * ```typescript
 * const baseDate = new Date();
 * baseDate.setDate(baseDate.getDate() - 7);
 * baseDate.setHours(12, 0, 0, 0);
 *
 * const history = createTestPriceHistoryBatch(7, baseDate, {
 *   productId: 1,
 *   retailerId: 1
 * });
 * await db.insert(priceHistory).values(history);
 * ```
 */
export function createTestPriceHistoryBatch(
  count: number,
  baseDate?: Date,
  overrides?: Partial<PriceHistory>
): Array<Omit<PriceHistory, 'id'>> {
  const start = baseDate || new Date();
  start.setHours(12, 0, 0, 0); // Noon local time (timezone-safe)

  return Array.from({ length: count }, (_, i) => {
    const recordedAt = new Date(start);
    recordedAt.setDate(start.getDate() + i); // One day increments

    return createTestPriceHistory({
      price: (100 + i * 5).toFixed(2), // Incrementing prices
      recordedAt,
      ...overrides,
    });
  });
}

/**
 * Create a timezone-safe date for testing
 *
 * Returns a date at noon local time with optional day offset.
 * Use this for consistent date handling across timezones.
 *
 * @param daysOffset - Days to offset from today (negative = past, positive = future)
 * @returns Date at noon local time
 *
 * @example
 * ```typescript
 * const yesterday = createTestDate(-1);
 * const tomorrow = createTestDate(1);
 * const today = createTestDate(0);
 * ```
 *
 * @see docs/08_TESTING_PATTERNS.md - Timezone-safe dates
 */
export function createTestDate(daysOffset = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(12, 0, 0, 0); // Noon local time
  return date;
}

/**
 * Create an ISO timestamp string for testing
 *
 * Returns an ISO 8601 timestamp at noon UTC with optional day offset.
 * Use this for API requests and database inserts requiring string dates.
 *
 * @param daysOffset - Days to offset from today (negative = past, positive = future)
 * @returns ISO 8601 timestamp string (e.g., "2025-01-15T12:00:00.000Z")
 *
 * @example
 * ```typescript
 * const yesterday = createTestTimestamp(-1);
 * const tomorrow = createTestTimestamp(1);
 * const today = createTestTimestamp(0);
 * ```
 */
export function createTestTimestamp(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setUTCHours(12, 0, 0, 0); // Noon UTC
  return date.toISOString();
}
