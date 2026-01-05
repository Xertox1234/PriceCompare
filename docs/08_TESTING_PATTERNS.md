# Testing Patterns

**Version:** 3.1
**Last Updated:** 2026-01-04
**Changelog:**
- 3.1 (2026-01-04): Added Type-Safe Response Validation Pattern, Anti-Pattern: Placeholder Tests (from TODO_006 migration)
- 3.0 (2025-12-28): Added React Query Multi-Query Invalidation Pattern, Hook Event Handler Testing Pattern, Test Skipping Documentation examples (from TODO 013)
- 2.9 (2025-12-27): Added @ts-expect-error pattern for intentional test mocks, inline SECURITY comment pattern for test fixtures
- 2.8 (2025-12-26): Added vi.mock() Intentional Duplication Pattern (test mock setup should stay local, not extracted - from TODO 002 rejection)
- 2.7 (2025-12-26): Added Pattern 6 - Concurrent SERIALIZABLE Transaction Test (race condition prevention from TODO 006)
- 2.6 (2025-12-26): Added E2E Environment-Specific Configuration Patterns (production vs dev server testing)
- 2.5 (2025-12-26): Added Transaction Atomicity Testing Patterns (5 comprehensive test patterns from TODO 004)
- 2.4 (2025-12-24): Added MemStorage Stub Implementation pattern for storage layer testing
- 2.3 (2025-12-23): Expanded Bulk Database Helpers with watchlist example, added Test Phase Separation pattern (Feature 4.3)
- 2.2 (2025-12-23): Added Bulk Database Helpers for E2E Tests pattern (Feature 3.3)
- 2.1 (2025-12-23): Added Custom Agent Patterns section

**Related Patterns:**
- docs/01_TYPESCRIPT_PATTERNS.md (type safety in tests)
- docs/05_FRONTEND_PATTERNS.md (component testing)
- docs/04_SECURITY_PATTERNS.md (security testing)
- docs/LEARNINGS_TODO_004_PRICE_AGGREGATION_REAL_DB_TESTS.md (real database test migration)
- docs/LEARNINGS_TODO_013_CI_UNIT_TEST_FAILURES.md (React Query invalidation, hook testing, test skipping - NEW)
- docs/LEARNINGS_TODO_175_DATABASE_CONNECTION_TESTS.md (environment configuration)
- docs/LEARNINGS_TODO_176_TIMEZONE_DATE_TESTS.md (frontend date testing)
- docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md (server-side UTC handling)
- docs/LEARNINGS_E2E_PHASE_1_1_ADMIN_TESTS.md (modal patterns, tab navigation, explicit waits)
- docs/LEARNINGS_PHASE_1_2_WATCHLIST_E2E_CSRF_FIX.md (CSRF token patterns, apiRequest() migration)
- docs/LEARNINGS_CODE_REVIEW_ASYNC_ONCLICK_DEBUGGING.md (progressive DOM scoping, selector ambiguity)

---

## Table of Contents

1. [Overview](#overview)
2. [Test Environment Configuration (NEW)](#test-environment-configuration-new)
   - [Database Connection Setup](#database-connection-setup)
   - [Environment Variable Patterns](#environment-variable-patterns)
   - [Configuration Templates](#configuration-templates)
3. [Integration Test Patterns](#integration-test-patterns-new)
   - [Mock-Based Test Anti-Pattern](#mock-based-test-anti-pattern)
   - [TRUNCATE CASCADE Pattern](#truncate-cascade-pattern)
   - [Strong vs Weak Assertions](#strong-vs-weak-assertions)
   - [Performance Benchmarks](#performance-benchmarks)
   - [Transaction Atomicity Testing Patterns (NEW)](#transaction-atomicity-testing-patterns-new---2025-12-26)
4. [Test Infrastructure](#test-infrastructure)
   - [Required Mocks for Route Tests](#required-mocks-for-route-tests)
   - [Redis Mock Pattern](#redis-mock-pattern)
   - [Logger Mock Pattern (NEW)](#logger-mock-pattern-new)
   - [vi.mock() Intentional Duplication - Do NOT Extract (NEW)](#vimock-intentional-duplication---do-not-extract-new---2025-12-26)
   - [CSRF Middleware Testing (NEW)](#csrf-middleware-testing-new)
5. [Date and Time Testing](#date-and-time-testing)
   - [Timezone-Safe Date Assertions](#timezone-safe-date-assertions)
   - [Date Formatting in Tests](#date-formatting-in-tests)
   - [Server-Side UTC Date Handling (NEW)](#server-side-utc-date-handling-new---2025-12-09)
6. [Component Testing Patterns](#component-testing-patterns)
   - [Testing Filtered UI Elements](#testing-filtered-ui-elements)
   - [Recharts Testing](#recharts-testing)
7. [Frontend React Hook Testing Patterns (NEW)](#frontend-react-hook-testing-patterns-new---2025-12-28)
   - [React Query Multi-Query Invalidation Pattern](#react-query-multi-query-invalidation-pattern)
   - [Hook Event Handler Testing Pattern](#hook-event-handler-testing-pattern)
8. [Route Testing Patterns](#route-testing-patterns)
   - [Testing Missing Route Parameters](#testing-missing-route-parameters)
   - [Express Route Not Found Behavior](#express-route-not-found-behavior)
   - [Type-Safe Response Validation Pattern (NEW)](#type-safe-response-validation-pattern-new---2026-01-04)
9. [Avoiding Skipped Tests](#avoiding-skipped-tests)
   - [Anti-Pattern: Placeholder Tests (NEW)](#anti-pattern-placeholder-tests-new---2026-01-04)
   - [Test Skipping Documentation Pattern (NEW)](#test-skipping-documentation-pattern-new---2025-12-28)
10. [Custom Agent Patterns (NEW)](#custom-agent-patterns-new---2025-12-23)
   - [Creating Project-Specific Subagents](#creating-project-specific-subagents)
11. [Checklist](#testing-checklist)

---

## Overview

This document codifies testing patterns to ensure reliable, maintainable tests that don't become technical debt. Tests should be deterministic across environments and timezones.

**Key Technologies:**
- Vitest (test runner)
- React Testing Library (component tests)
- Supertest (API route tests)
- Playwright (E2E tests)

**Core Principles:**
- **Prefer real database over mocks** - Mocks for internal code are technical debt (see TODO_004)
- **No `it.skip()` without a plan** - Skipped tests are technical debt
- **Timezone-safe assertions** - Tests must pass in any timezone
- **Mock external dependencies only** - Redis, email, external APIs
- **Test behavior, not implementation** - Focus on what users see/do
- **Strong assertions over weak** - Use exact values with deterministic test data
- **Zero-config by default** - Tests should work without explicit environment setup

---

## Test Environment Configuration (NEW - 2025-12-06)

**Source**: Issue #175 - Database connection test failures

Proper environment configuration ensures tests work across all developer machines without manual setup.

### Database Connection Setup

#### ❌ WRONG - Hardcoded Credentials

```typescript
// Breaks on macOS/Linux where 'postgres' user doesn't exist
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/test_db';
```

#### ✅ CORRECT - Multi-Tier Fallback Chain

```typescript
// Platform-aware defaults with explicit override support
const databaseUser = process.env.DATABASE_USER || process.env.USER || 'postgres';
const databasePassword = process.env.DATABASE_PASSWORD || '';
const databaseHost = process.env.DATABASE_HOST || 'localhost';
const databasePort = process.env.DATABASE_PORT || '5432';
const databaseName = process.env.DATABASE_NAME || 'pricecompare_test';

// Construct connection string with or without password
const credentials = databasePassword ? `${databaseUser}:${databasePassword}` : databaseUser;
const defaultDatabaseUrl = `postgresql://${credentials}@${databaseHost}:${databasePort}/${databaseName}`;

// Respect explicit configuration, fall back to constructed
process.env.DATABASE_URL = process.env.DATABASE_URL || defaultDatabaseUrl;
```

**Fallback Priority:**
1. `DATABASE_URL` - Explicit full connection string
2. Individual `DATABASE_*` variables - Constructed connection
3. `process.env.USER` - Platform-aware username
4. Universal defaults - `localhost`, `5432`

### Environment Variable Patterns

#### Validate Numeric Values

```typescript
// ✅ CORRECT - Validate with clear warnings
let databasePort = process.env.DATABASE_PORT || '5432';
const portNum = parseInt(databasePort, 10);
if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
  console.warn(`Warning: Invalid DATABASE_PORT '${databasePort}', using default 5432`);
  databasePort = '5432';
}
```

#### Document Test-Only Defaults

```typescript
// ✅ CORRECT - Explain WHY test config differs
// Encryption is handled via NODE_ENV='test' check in schema.ts (no-op encryption)
// Why: Test data is ephemeral, contains no real PII, encryption adds overhead
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
```

### Configuration Templates

**MANDATORY:** Provide `.env.test.example` for test environment:

```bash
# .env.test.example

# DATABASE_USER - PostgreSQL role/username
# Default: Your system username (process.env.USER)
# Common values:
#   - macOS/Linux (Homebrew): Your system username
#   - Windows: Usually 'postgres'
# DATABASE_USER=your_username

# Troubleshooting:
# "role 'postgres' does not exist" -> Set DATABASE_USER to your username
# "database does not exist" -> Run: createdb pricecompare_test
```

### Test Configuration Checklist

- [ ] Database connection uses multi-tier fallback (no hardcoded credentials)
- [ ] Numeric environment variables are validated
- [ ] `.env.test.example` template exists with documentation
- [ ] Test-only security defaults are documented with WHY
- [ ] Configuration works on macOS, Linux, Windows, and Docker

**Reference:** `docs/LEARNINGS_TODO_175_DATABASE_CONNECTION_TESTS.md`

---

## Integration Test Patterns (NEW - 2025-12-03)

### Mock-Based Test Anti-Pattern

**Source**: TODO_004 - Price Aggregation Service test migration

**Problem**: Mocking internal database code (Drizzle/Prisma/TypeORM) creates brittle tests that break when the ORM API changes.

#### ❌ WRONG - Extensive Database Mocking

```typescript
// 320 lines of mock setup (from TODO_004 before migration)
vi.mock('../../db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]) // Easy to miss methods
        })
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue({})
      })
    }),
    transaction: vi.fn().mockImplementation(async (callback) => {
      // Complex mock transaction logic...
    })
  }
}));
```

**Symptoms of Mock Fragility**:
- >50 lines of mock setup
- Multiple nested `.mockReturnValue()` chains
- Type casts to `any` for mock compatibility
- Comments like "incomplete mock chain" or "TODO: add method"
- Tests fail when Drizzle API adds/changes methods

#### ✅ CORRECT - Real Database Integration Tests

```typescript
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

describe('PriceAggregationService (Integration)', () => {
  beforeEach(async () => {
    // TRUNCATE CASCADE - clean all tables, fast and reliable
    await db.execute(sql`TRUNCATE TABLE price_aggregates RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE price_history RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);

    // Create base test data
    [testRetailer] = await db.insert(retailers).values({
      name: 'Test Retailer',
      website: 'https://test.com',
      logoUrl: 'https://test.com/logo.png',
    }).returning();

    [testProduct] = await db.insert(products).values({
      name: 'Test Product',
      description: 'Test description',
    }).returning();

    service = new PriceAggregationService();
  });

  it('should create daily aggregates correctly', async () => {
    // Insert real price history data
    await db.insert(priceHistory).values({
      productId: testProduct.id,
      retailerId: testRetailer.id,
      price: '99.99',
      recordedAt: new Date('2024-01-01T12:00:00Z'),
    });

    // Run actual service method (no mocks!)
    const count = await service.calculateDailyAggregates();

    // Verify real database state
    const [aggregate] = await db.select()
      .from(priceAggregates)
      .where(sql`${priceAggregates.productId} = ${testProduct.id}`);

    expect(aggregate.minPrice).toBe('99.99');
    expect(aggregate.maxPrice).toBe('99.99');
  });
});
```

**Benefits of Real Database Tests**:
- ✅ Tests actual SQL queries and transactions
- ✅ Verifies real Drizzle ORM behavior
- ✅ Zero mock maintenance burden (0 vs 320 lines)
- ✅ Fast execution (<900ms for 16 tests with TRUNCATE CASCADE)
- ✅ Proper TypeScript types (no `any` casts)
- ✅ Catches database-level issues (constraints, triggers)
- ✅ True confidence - if tests pass, real queries work

**When to Use Mocks**:
- ⚠️ External APIs (Google Search, OpenAI, payment processors)
- ⚠️ Email services (SendGrid, Mailgun)
- ⚠️ Third-party SDKs you don't control
- ⚠️ Pure business logic with no database

**Rule of Thumb**: If you need >50 lines of mock setup, use real database instead.

**Reference**: `docs/LEARNINGS_TODO_004_PRICE_AGGREGATION_REAL_DB_TESTS.md`

---

### TRUNCATE CASCADE Pattern

**MANDATORY for all database integration tests.**

#### Pattern

```typescript
beforeEach(async () => {
  // TRUNCATE CASCADE pattern - resets auto-increment IDs and cascades to child tables
  await db.execute(sql`TRUNCATE TABLE price_aggregates RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE price_history RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
});
```

**Why CASCADE?**:
- Automatically cleans child tables (prevents foreign key violations)
- Resets auto-increment sequences (predictable IDs)
- Single command vs multiple deletes
- Fast (milliseconds)

**Order**: Parent tables last, child tables first (reverse dependency order).

**See**: `docs/02_DATABASE_PATTERNS.md` (Section 8.1: TRUNCATE CASCADE)

---

### Strong vs Weak Assertions

**Use exact assertions with deterministic test data. Range checks indicate uncertainty.**

#### ❌ WEAK - Range Assertions

```typescript
// WEAK - Developer unsure what exact value should be
const count = await service.aggregateToDaily(startDate, endDate);
expect(count).toBeGreaterThanOrEqual(2);
expect(count).toBeLessThanOrEqual(3); // "Could be 2 or 3?"
```

#### ✅ STRONG - Exact Assertions

```typescript
// STRONG - Deterministic test data yields exact values
const baseDate = new Date();
baseDate.setDate(baseDate.getDate() - 10); // Guaranteed past
baseDate.setHours(12, 0, 0, 0);

const day1 = new Date(baseDate);
const day2 = new Date(baseDate);
day2.setDate(day2.getDate() + 1);
const day3 = new Date(baseDate);
day3.setDate(day3.getDate() + 2);

await insertPriceHistory([
  { price: '100.00', recordedAt: day1 },
  { price: '101.00', recordedAt: day2 },
  { price: '102.00', recordedAt: day3 },
]);

const count = await service.aggregateToDaily(startDate, endDate);
expect(count).toBe(3); // EXACT - we inserted 3 days of data
```

**Principle**: If you can control the test data, you can assert exact values.

---

### Performance Benchmarks

**Add performance budget tests to catch regressions early.**

```typescript
describe('performance', () => {
  it('should complete aggregation within performance budget', async () => {
    const start = Date.now();

    // Create realistic test data volume
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);

    await insertPriceHistory([
      { price: '100.00', recordedAt: yesterday },
      { price: '105.00', recordedAt: new Date(yesterday.getTime() + 60000) },
      { price: '110.00', recordedAt: new Date(yesterday.getTime() + 120000) },
      { price: '108.00', recordedAt: new Date(yesterday.getTime() + 180000) },
      { price: '112.00', recordedAt: new Date(yesterday.getTime() + 240000) },
    ]);

    await service.calculateDailyAggregates();

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // 1 second budget

    // Verify aggregation succeeded
    const aggregates = await db.select().from(priceAggregatesDaily);
    expect(aggregates).toHaveLength(1);
  });
});
```

**Performance Budget Guidelines**:
- Single record operations: <100ms
- Batch operations (10-50 records): <500ms
- Large batch operations (50-200 records): <2000ms
- Date range aggregations (7 days): <2000ms

---

### Test Coverage for New Storage Methods (NEW - 2026-01-04)

**Context:** When adding new storage methods alongside existing ones (e.g., `getWatchListsWithStats()` beside `getUserWatchLists()`), both need dedicated test coverage.

**Problem:** Developers assume existing tests cover new methods because queries are similar, leading to untested code paths and missed bugs.

**✅ Preferred Approach:**
```typescript
// server/__tests__/storage-watchlist.test.ts

describe('getWatchListsWithStats', () => {
  it('should return watch lists with watchCount and highPriorityCount', async () => {
    // Create watch list
    const [list1] = await db.insert(watchLists).values({
      userId: testUserId,
      name: 'My List',
      sortOrder: 1,
    }).returning();

    // Create watches with DIFFERENT priorities
    await db.insert(productWatches).values([
      { userId: testUserId, watchListId: list1.id, productId: testProductId, priority: 5 },  // High priority
      { userId: testUserId, watchListId: list1.id, productId: testProductId2, priority: 3 }, // Medium priority
    ]);

    // Test NEW method
    const result = await storage.getWatchListsWithStats(testUserId);

    // Verify SPECIFIC behavior of new method
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('My List');
    expect(result[0].watchCount).toBe(2);           // Total count
    expect(result[0].highPriorityCount).toBe(1);    // Only priority 5 items
  });

  it('should return 0 for highPriorityCount when no priority 5 items exist', async () => {
    const [list1] = await db.insert(watchLists).values({
      userId: testUserId,
      name: 'Low Priority List',
      sortOrder: 1,
    }).returning();

    // All medium/low priority items
    await db.insert(productWatches).values([
      { userId: testUserId, watchListId: list1.id, productId: testProductId, priority: 3 },
      { userId: testUserId, watchListId: list1.id, productId: testProductId2, priority: 4 },
    ]);

    const result = await storage.getWatchListsWithStats(testUserId);

    expect(result[0].watchCount).toBe(2);
    expect(result[0].highPriorityCount).toBe(0);  // Edge case: no high priority items
  });

  it('should return empty array for user with no lists', async () => {
    const result = await storage.getWatchListsWithStats(testUserId);
    expect(result).toEqual([]);  // Edge case: no data
  });
});
```

**❌ Anti-Pattern (Avoid):**
```typescript
describe('watchlist storage', () => {
  it('should get watch lists for user', async () => {
    // ... test setup ...

    // ❌ BAD - Only tests OLD method
    const result = await storage.getUserWatchLists(testUserId);

    // Assumes getWatchListsWithStats() works the same way
    // But never actually tests:
    // - watchCount vs productCount field name
    // - highPriorityCount calculation logic
    // - COUNT CASE WHEN SQL correctness
  });

  // ❌ MISSING - No dedicated tests for getWatchListsWithStats()
});
```

**Rationale:**
- **Different SQL:** New methods often use different queries (e.g., `COUNT CASE WHEN` for conditional aggregation)
- **Different Types:** Return type differs (`WatchListWithStats` vs `WatchListWithCount`)
- **Different Edge Cases:** New fields may have unique edge cases (e.g., `highPriorityCount = 0` when no priority 5 items)
- **Regression Prevention:** If new method has bug, old method's tests won't catch it
- **Documentation:** Tests serve as usage examples for new method

**Test Coverage Checklist for New Methods:**

1. **Basic Functionality**
   - [ ] Returns correct data shape (all new fields present)
   - [ ] Filters by correct criteria (userId, permissions, etc.)
   - [ ] Orders results correctly (deterministic ordering)

2. **Calculated Fields**
   - [ ] New aggregations calculate correctly (`watchCount`, `highPriorityCount`)
   - [ ] Conditional counts work as expected (`COUNT CASE WHEN`)
   - [ ] Edge case: Zero/null values handled

3. **Edge Cases**
   - [ ] Empty result set (no data)
   - [ ] Single item
   - [ ] Multiple items with same values (tests deterministic ordering)

4. **Type Safety**
   - [ ] TypeScript types match actual data
   - [ ] No type assertions (`as`) in test

**When Both Methods Coexist:**
```typescript
describe('getUserWatchLists (v1 API - deprecated)', () => {
  it('should return productCount field', async () => {
    // Tests for OLD method
  });
});

describe('getWatchListsWithStats (v2+ API - preferred)', () => {
  it('should return watchCount and highPriorityCount fields', async () => {
    // Tests for NEW method
  });
});
```

**Related Patterns:**
- [02_DATABASE_PATTERNS.md: SQL Conditional Aggregation](#) - Testing COUNT CASE WHEN queries
- [02_DATABASE_PATTERNS.md: Deterministic Ordering](#) - Testing ORDER BY with secondary sort
- [Strong vs Weak Assertions](#strong-vs-weak-assertions) - Use exact assertions in tests

*Source: TODO 003 - Added dedicated test suite for getWatchListsWithStats() (lines 305-374 in storage-watchlist.test.ts)*
*Added: 2026-01-04*

---

### Transaction Atomicity Testing Patterns (NEW - 2025-12-26)

**Context:** Multi-step database operations wrapped in transactions need comprehensive tests to verify atomicity guarantees.

**Problem:** Without proper tests, you can't verify that transactions actually rollback on failure or commit only when all operations succeed.

**Source:** TODO 004 - Transaction Boundaries Implementation

#### Pattern 1: Atomic Success Test

**Purpose:** Verify both operations commit together when transaction succeeds.

```typescript
import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import { db } from '../../db';
import { products, trendingProducts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../../storage';

describe('Transaction Atomicity Tests', () => {
  beforeEach(async () => {
    // Clean test data before each test
    await db.delete(products).where(eq(products.category, 'TransactionTest'));
    await db.delete(trendingProducts).where(eq(trendingProducts.category, 'TransactionTest'));
  });

  afterAll(async () => {
    // Final cleanup
    await db.delete(products).where(eq(products.category, 'TransactionTest'));
    await db.delete(trendingProducts).where(eq(trendingProducts.category, 'TransactionTest'));
  });

  test('creates product and links to trending product atomically', async () => {
    // Setup: Create trending product
    const [trendProduct] = await db.insert(trendingProducts).values({
      name: 'Atomic Test Product',
      category: 'TransactionTest',
      source: 'test',
      trendScore: 85,
      status: 'discovered',
    }).returning();

    const productData = {
      name: 'Atomic Test Product',
      category: 'TransactionTest',
      description: 'Test product for atomic operation',
    };

    // Execute: Atomic operation
    await db.transaction(async (tx) => {
      const product = await storage.createProduct(productData, tx);
      await storage.updateTrendingProduct(
        trendProduct.id,
        { productId: product.id, status: 'scraped' },
        tx
      );
    });

    // Verify: Both operations succeeded
    const updatedTrending = await db
      .select()
      .from(trendingProducts)
      .where(eq(trendingProducts.id, trendProduct.id));

    expect(updatedTrending).toHaveLength(1);
    expect(updatedTrending[0].status).toBe('scraped');
    expect(updatedTrending[0].productId).toBeDefined();
    expect(updatedTrending[0].productId).not.toBeNull();

    // Verify product was created
    const createdProduct = await db
      .select()
      .from(products)
      .where(eq(products.id, updatedTrending[0].productId!));

    expect(createdProduct).toHaveLength(1);
    expect(createdProduct[0].name).toBe('Atomic Test Product');
  });
});
```

**Key Assertions:**
- ✅ Both operations completed (no partial state)
- ✅ Foreign key relationship established (productId is set)
- ✅ Status transitioned correctly (discovered → scraped)
- ✅ Created record exists and is linked

#### Pattern 2: Rollback on Failure Test

**Purpose:** Verify earlier operations roll back when later operations fail.

```typescript
test('rolls back product creation if trending update fails', async () => {
  const nonExistentTrendingId = 999999999; // ID that doesn't exist

  const productData = {
    name: 'Test Rollback Product',
    category: 'TransactionTest',
    description: 'This product should not be created',
  };

  // Execute: Transaction should fail and rollback
  await expect(
    db.transaction(async (tx) => {
      const product = await storage.createProduct(productData, tx);

      // This will fail (trending product doesn't exist)
      await storage.updateTrendingProduct(
        nonExistentTrendingId,
        { productId: product.id, status: 'scraped' },
        tx
      );
    })
  ).rejects.toThrow(); // Expecting error

  // Verify: Product was NOT created (rollback succeeded)
  const allProducts = await db
    .select()
    .from(products)
    .where(eq(products.name, 'Test Rollback Product'));

  expect(allProducts).toHaveLength(0); // ✅ No orphaned product
});
```

**Key Assertions:**
- ✅ Transaction throws error (not silent failure)
- ✅ Earlier operation rolled back (no orphaned records)
- ✅ Database state unchanged (0 products created)

#### Pattern 3: Constraint Violation Test

**Purpose:** Verify transactions handle database constraints correctly.

```typescript
test('handles null product data gracefully in transaction', async () => {
  // Setup: Create trending product
  const [trendProduct] = await db.insert(trendingProducts).values({
    name: 'Null Test Product',
    category: 'TransactionTest',
    source: 'test',
    trendScore: 85,
    status: 'discovered',
  }).returning();

  // Product data with null name (violates NOT NULL constraint)
  const invalidProductData = {
    name: null as unknown as string, // Force null to test constraint
    category: 'TransactionTest',
  };

  // Execute: Should fail due to constraint
  await expect(
    db.transaction(async (tx) => {
      const product = await storage.createProduct(invalidProductData, tx);
      await storage.updateTrendingProduct(
        trendProduct.id,
        { productId: product.id, status: 'scraped' },
        tx
      );
    })
  ).rejects.toThrow(); // Database constraint error

  // Verify: Trending product state unchanged
  const unchanged = await db
    .select()
    .from(trendingProducts)
    .where(eq(trendingProducts.id, trendProduct.id));

  expect(unchanged).toHaveLength(1);
  expect(unchanged[0].status).toBe('discovered'); // ✅ Status unchanged
  expect(unchanged[0].productId).toBeNull(); // ✅ No partial link
});
```

**Key Assertions:**
- ✅ Constraint violations trigger rollback
- ✅ Related records remain unchanged
- ✅ No partial state persisted

#### Pattern 4: Independent Transaction Test

**Purpose:** Verify separate transactions don't interfere with each other.

```typescript
test('independent transactions do not interfere', async () => {
  // Create two trending products
  const [trend1] = await db.insert(trendingProducts).values({
    name: 'Product 1',
    category: 'TransactionTest',
    source: 'test',
    trendScore: 85,
    status: 'discovered',
  }).returning();

  const [trend2] = await db.insert(trendingProducts).values({
    name: 'Product 2',
    category: 'TransactionTest',
    source: 'test',
    trendScore: 85,
    status: 'discovered',
  }).returning();

  // Execute two separate transactions
  await db.transaction(async (tx) => {
    const product1 = await storage.createProduct(
      { name: 'Product 1', category: 'TransactionTest' },
      tx
    );
    await storage.updateTrendingProduct(
      trend1,
      { productId: product1.id, status: 'scraped' },
      tx
    );
  });

  await db.transaction(async (tx) => {
    const product2 = await storage.createProduct(
      { name: 'Product 2', category: 'TransactionTest' },
      tx
    );
    await storage.updateTrendingProduct(
      trend2,
      { productId: product2.id, status: 'scraped' },
      tx
    );
  });

  // Verify both transactions succeeded independently
  const result1 = await db
    .select()
    .from(trendingProducts)
    .where(eq(trendingProducts.id, trend1));
  const result2 = await db
    .select()
    .from(trendingProducts)
    .where(eq(trendingProducts.id, trend2));

  expect(result1[0].status).toBe('scraped');
  expect(result1[0].productId).toBeDefined();
  expect(result2[0].status).toBe('scraped');
  expect(result2[0].productId).toBeDefined();
  expect(result1[0].productId).not.toBe(result2[0].productId); // Different products
});
```

**Key Assertions:**
- ✅ Both transactions complete successfully
- ✅ Each transaction creates distinct records
- ✅ No cross-contamination between transactions

#### Pattern 5: Multi-Update Atomicity Test

**Purpose:** Verify transactions with multiple updates commit all-or-nothing.

```typescript
test('transaction with multiple updates commits all or none', async () => {
  const [trend1] = await db.insert(trendingProducts).values({
    name: 'Multi 1',
    category: 'TransactionTest',
    source: 'test',
    trendScore: 85,
    status: 'discovered',
  }).returning();

  const [trend2] = await db.insert(trendingProducts).values({
    name: 'Multi 2',
    category: 'TransactionTest',
    source: 'test',
    trendScore: 85,
    status: 'discovered',
  }).returning();

  await db.transaction(async (tx) => {
    const product = await storage.createProduct(
      { name: 'Shared Product', category: 'TransactionTest' },
      tx
    );

    // Update both trending products to reference same product
    await storage.updateTrendingProduct(trend1, { productId: product.id, status: 'scraped' }, tx);
    await storage.updateTrendingProduct(trend2, { productId: product.id, status: 'scraped' }, tx);
  });

  // Verify all updates committed
  const results = await db
    .select()
    .from(trendingProducts)
    .where(eq(trendingProducts.category, 'TransactionTest'));

  const updated = results.filter((r) => r.status === 'scraped');
  expect(updated).toHaveLength(2); // Both updated
  expect(updated[0].productId).toBe(updated[1].productId); // Same product
});
```

**Key Assertions:**
- ✅ All updates in transaction committed
- ✅ Foreign key relationships consistent
- ✅ No partial updates

#### Pattern 6: Concurrent SERIALIZABLE Transaction Test (Race Condition Prevention)

**Purpose:** Verify SERIALIZABLE transactions prevent race conditions in check-then-act scenarios (e.g., limit enforcement).

**Context:** When concurrent operations could violate business rules (daily limits, quotas, sequential numbering), SERIALIZABLE isolation prevents phantom reads.

```typescript
// Source: server/services/__tests__/notification-service.test.ts:151-197
test('should enforce daily limit under concurrent notification creation', async () => {
  // CRITICAL RACE CONDITION TEST: Verifies SERIALIZABLE transaction prevents limit bypass
  // Scenario: User at 9/10 limit, 5 concurrent price drops → only 1 should succeed

  // Set limit to 10
  await updateUserPreferences(testUserId, { maxDailyNotifications: 10 });

  // Create 9 notifications to reach 9/10 limit
  for (let i = 0; i < 9; i++) {
    await createNotification({
      userId: testUserId,
      type: 'price_drop',
      title: `Notification ${i + 1}`,
      content: 'Test',
    });
  }

  // Verify we're at 9/10
  const beforeCount = await getUserNotifications(testUserId);
  expect(beforeCount).toHaveLength(9);

  // Attempt 5 concurrent notifications (simulates simultaneous price drops)
  const concurrentAttempts = Array.from({ length: 5 }, (_, i) =>
    createNotification({
      userId: testUserId,
      type: 'price_drop',
      title: `Concurrent ${i + 1}`,
      content: 'Concurrent test',
    }).catch((error) => {
      // Expected: 4 should fail with limit error
      if (error instanceof Error && error.message === 'Daily notification limit reached') {
        return null; // Mark as expected failure
      }
      throw error; // Unexpected error
    })
  );

  const results = await Promise.all(concurrentAttempts);

  // Verify exactly 1 succeeded (null = failed as expected)
  const succeeded = results.filter((r) => r !== null);
  expect(succeeded).toHaveLength(1);

  // Verify final count is exactly 10 (limit respected)
  const finalCount = await getUserNotifications(testUserId);
  expect(finalCount).toHaveLength(10);
});
```

**Key Assertions:**
- ✅ Exactly 1 concurrent operation succeeds (not 2+)
- ✅ Final count matches limit exactly (no overflow)
- ✅ Expected errors caught and counted
- ✅ Business rule enforced under high concurrency

**Implementation Requirements:**
- Storage method must use `{ isolationLevel: 'serializable' }`
- Wrap in `retryWithBackoff()` to handle serialization failures
- Test with 3-5 concurrent operations (more = better stress test)
- Verify final state, not just error messages

**Common Race Condition Scenarios:**
- Daily/hourly notification limits
- Sequential post/comment numbering
- Quota enforcement (max alerts, max watchlists)
- Inventory reservation
- First-user admin role assignment

**Related Patterns:**
- See `docs/02_DATABASE_PATTERNS.md` Section 4.3 "When to Use SERIALIZABLE"
- See `server/storage/domains/notification-storage.ts:247-315` for production example

*Source: TODO 006 - Notification Daily Limit Race Condition Fix*
*Added: 2025-12-26*

#### Testing Checklist for Transactions

When testing transaction boundaries, ensure you cover:

1. ✅ **Atomic Success** - Both/all operations commit together
2. ✅ **Rollback on Failure** - Earlier operations roll back when later ones fail
3. ✅ **Constraint Violations** - Database constraints trigger rollback
4. ✅ **Independent Transactions** - Separate transactions don't interfere
5. ✅ **Multi-Update Atomicity** - Multiple updates commit all-or-nothing
6. ✅ **Concurrent SERIALIZABLE** - Race conditions prevented under concurrent access (NEW)

**Performance Expectations:**
- Transaction tests should run fast (<100ms per test)
- Use deterministic test data (no random values)
- Clean state between tests (beforeEach cleanup)

**Related Patterns:**
- See `docs/02_DATABASE_PATTERNS.md` Section 4.4-4.7 for transaction implementation patterns
- See Section "TRUNCATE CASCADE Pattern" above for efficient test cleanup

*Source: TODO 004 - Transaction Boundaries Implementation*
*Added: 2025-12-26*

---

## Test Infrastructure

### Required Mocks for Route Tests

All route integration tests need these mocks to avoid requiring external services:

#### ❌ WRONG - Missing Redis Mock
```typescript
// Test fails with "Redis client not available"
import { describe, it, expect } from 'vitest';
import request from 'supertest';
// ... imports that transitively require Redis

describe('My Routes', () => {
  // Tests fail before they even run!
});
```

#### ✅ CORRECT - Mock Redis Before Imports
```typescript
import { describe, it, expect, vi } from 'vitest';

// MUST be before any imports that use Redis
vi.mock('../../config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    scan: vi.fn(),
    publish: vi.fn(),
    duplicate: vi.fn(() => ({
      subscribe: vi.fn(),
      on: vi.fn(),
      quit: vi.fn(),
    })),
  },
}));

// Now safe to import modules that use Redis
import request from 'supertest';
```

### Redis Mock Pattern

The complete Redis mock for route tests:

```typescript
// Place at TOP of test file, before all other imports
vi.mock('../../config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    scan: vi.fn(),
    publish: vi.fn(),
    duplicate: vi.fn(() => ({
      subscribe: vi.fn(),
      on: vi.fn(),
      quit: vi.fn(),
    })),
  },
}));
```

**Why this matters:** The `storage-cache.ts` and `advanced-cache.ts` modules require Redis at import time. Without this mock, tests fail during module initialization.

---

### @ts-expect-error for Intentional Test Mocks (NEW - 2025-12-27)

**Context**: When testing middleware or routes, you often need to create partial mock objects that don't fully implement Express types (`Request`, `Response`, `Session`, etc.). TypeScript will rightfully complain, but the tests are valid.

**Problem**: Suppressing these TypeScript errors without documentation makes code review difficult and can hide real type issues.

**✅ Correct Pattern - Document WHY the Error is Expected**

```typescript
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { flexibleAuth } from '../flexible-auth';

describe('flexibleAuth middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Default request mock
    mockReq = {
      headers: {},
      path: '/api/test',
      method: 'GET',
      // @ts-expect-error - Test mock with partial Session object
      session: {},
      // @ts-expect-error - Test mock function without type predicate
      isAuthenticated: vi.fn(() => false),
    };

    // Default response mock
    mockRes = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  it('uses Basic Auth when Authorization header present', async () => {
    mockReq.headers = {
      // SECURITY: Test fixture - base64(user:pass), not a real secret
      authorization: 'Basic dXNlcjpwYXNz', // SECURITY: Test data
    };

    await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.isBasicAuth).toBe(true);
  });

  it('uses session auth when authenticated', async () => {
    // @ts-expect-error - Test mock function
    mockReq.isAuthenticated = vi.fn(() => true);
    // @ts-expect-error - Test mock with partial user object
    mockReq.user = { id: 1, username: 'testuser', role: 'user' };

    await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.isBasicAuth).toBe(false);
  });
});
```

**Why This Pattern Works**:

1. **Explicit documentation** - Comment explains WHY error is expected
2. **Scoped suppression** - Only suppresses specific line, not entire file
3. **Descriptive comment** - "Test mock with partial Session object" tells reviewer what's happening
4. **Type safety preserved** - TypeScript still checks the rest of the file

**Comment Templates**:

```typescript
// For partial mocks:
// @ts-expect-error - Test mock with partial Session object
// @ts-expect-error - Test mock with partial user object
// @ts-expect-error - Test mock with partial Express.Request type

// For intentional mock functions without proper types:
// @ts-expect-error - Test mock function without type predicate
// @ts-expect-error - Test mock function (isAuthenticated doesn't match Passport type)

// For intentional type mismatches:
// @ts-expect-error - Intentional type mismatch for negative test case
```

**❌ Wrong Pattern - No Explanation**

```typescript
// ❌ BAD - No explanation why error is expected
// @ts-expect-error
mockReq.session = {};

// ❌ BAD - Using @ts-ignore (doesn't require valid error)
// @ts-ignore
mockReq.user = { id: 1 };
```

**When NOT to Use This Pattern**:

- ❌ Production code (fix the type issue)
- ❌ When you can easily fix the type (use proper types instead)
- ❌ Hiding real type errors (investigate and fix)

**When to Use This Pattern**:

- ✅ Test mocks that are intentionally partial
- ✅ Mock functions that don't match exact signatures
- ✅ Negative test cases with intentional type violations
- ✅ Integration tests where full type implementation is impractical

*Source: Unified authentication test suite (flexible-auth.test.ts) - 2025-12-27*
*Added: 2025-12-27*

---

### Test Fixture SECURITY Comment Pattern (NEW - 2025-12-27)

**Context**: Pre-commit hooks block commits containing `passwordHash` or `authorization: 'Basic'` patterns to prevent credential exposure. Test fixtures need inline `// SECURITY:` comments to pass these checks.

**Problem**: Pre-commit hooks use line-by-line `grep` scanning and cannot see previous-line comments. Without inline comments, valid test code gets blocked.

**✅ Correct Pattern - Inline SECURITY Comments**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hashPassword } from '../../auth';
import { db } from '../../db';
import { users } from '../../../shared/schema';
import { hashEmail } from '../../utils/encryption';

describe('CSRF Attack Prevention (Security Tests)', () => {
  let testUser: {
    id: number;
    username: string;
    email: string;
    password: string;
  };

  beforeAll(async () => {
    // Create test user (potential victim)
    const password = 'VictimPassword123!'; // Test fixture password
    const passwordHash = await hashPassword(password); // SECURITY: Test data only
    const email = 'csrf-victim@example.com';

    const [user] = await db
      .insert(users)
      .values({
        username: 'csrfvictim',
        email,
        emailHash: hashEmail(email),
        passwordHash, // SECURITY: Test data - intentional use for database record
        role: 'user',
      })
      .returning();

    testUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      password,
    };
  });

  it('blocks CSRF attack via session without CSRF token', async () => {
    const agent = request.agent(app);

    // Victim logs in
    await agent.post('/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    // Attacker attempts mutation without CSRF token
    const attackRes = await agent
      .post('/api/sensitive-action')
      .send({ action: 'delete_account' });

    expect(attackRes.status).toBe(403);
    expect(attackRes.body.error).toContain('CSRF');
  });

  it('allows Basic Auth request without CSRF token', async () => {
    // Legitimate API client using Basic Auth
    const res = await request(app)
      .post('/api/sensitive-action')
      .auth(testUser.username, testUser.password) // SECURITY: Test fixture credentials, not real secrets
      .send({ action: 'legitimate_api_call' });

    expect(res.status).toBe(200);
  });
});
```

**Required Comment Patterns**:

| Use Case | Pattern |
|----------|---------|
| **Test password variable** | `const password = 'Test123!'; // Test fixture password` |
| **passwordHash from hashing** | `const hash = await hashPassword(pwd); // SECURITY: Test data only` |
| **passwordHash in insert** | `passwordHash, // SECURITY: Test data - intentional use for database record` |
| **Basic Auth header** | `authorization: 'Basic dXNlcjpwYXNz', // SECURITY: Test data` |
| **.auth() method** | `.auth('user', 'pass') // SECURITY: Test fixture credentials, not real secrets` |

**❌ Wrong Pattern - Previous-Line Comment**

```typescript
// ❌ PRE-COMMIT FAILS - Hook doesn't see comment above
const password = 'Test123!';
const passwordHash = await hashPassword(password);

const [user] = await db.insert(users).values({
  username: 'testuser',
  // SECURITY: Test data - intentional use for database record
  passwordHash,  // ❌ Hook blocks this line
});
```

**Why This Matters**:

1. **Pre-commit hook uses `grep`** - Scans file line-by-line
2. **Comments must be inline** - On same line as flagged pattern
3. **Prevents false positives** - Hooks won't block valid test code
4. **Documents intent** - Comment explains why credential is present

**Pre-Commit Hook Failure Example**:

```bash
$ git commit -m "Add CSRF attack tests"
ERROR: Potential password hash exposure detected
  Line 91: passwordHash,
  Line 82: const passwordHash = await hashPassword(password);

✅ Fix: Add inline // SECURITY: comments
```

*Source: Unified authentication migration (csrf-attack-prevention.test.ts, flexible-auth.test.ts) - 2025-12-27*
*Added: 2025-12-27*

**See also**: `docs/04_SECURITY_PATTERNS.md` - Section 1a: "Inline SECURITY Comment Requirements"

---

### MemStorage Stub Implementation Pattern

**Context:** When adding new storage layer methods, you must also implement test doubles in the MemStorage class to support in-memory testing without a database.

**Problem:** TypeScript strict null/undefined checks cause errors when MemStorage stubs return `undefined` instead of proper types. Spread operators (`...data`) can propagate undefined fields, violating schema constraints.

**✅ Preferred Approach:**

```typescript
// Explicit field mapping - matches exact schema structure
async createAgentSession(sessionData: InsertAgentSession): Promise<AgentSession> {
  return {
    id: 1,
    agentType: sessionData.agentType,
    sessionId: sessionData.sessionId,
    sessionStart: sessionData.sessionStart || null,
    sessionEnd: null,
    tasksCompleted: 0,
    successRate: '0',
    errorsEncountered: 0,
    performanceMetrics: '{}',
    status: sessionData.status || null,
    createdAt: new Date(),
    // NO updatedAt field - schema doesn't have it
  };
}

async createScrapingJob(jobData: InsertScrapingJob): Promise<ScrapingJob> {
  return {
    id: 1,
    jobType: jobData.jobType,
    priority: jobData.priority || null,
    status: jobData.status || null,
    targetData: jobData.targetData,
    resultData: jobData.resultData || null,
    errorMessage: null,
    retryCount: 0,
    maxRetries: jobData.maxRetries || 3,
    scheduledAt: jobData.scheduledAt || null,
    startedAt: null,
    completedAt: null,
    agentSessionId: jobData.agentSessionId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Collection methods return empty arrays
async getPendingScrapingJobs(_limit: number): Promise<ScrapingJob[]> {
  return [];
}

// Update methods are no-ops
async updateProductOffer(_offerId: number, _updates: Partial<ProductOffer>): Promise<void> {
  // No-op for test doubles
}

// Stats methods return zero-filled structures
async getMonitoringStats(): Promise<{
  recentChecks: { last24h: number; last7d: number };
  activeAlerts: { total: number; triggered: number; byType: Record<string, unknown> };
  priceChanges: { increases: number; decreases: number; stable: number };
  availability: { available: number; outOfStock: number; unknown: number };
  timestamp: string;
}> {
  return {
    recentChecks: { last24h: 0, last7d: 0 },
    activeAlerts: { total: 0, triggered: 0, byType: {} },
    priceChanges: { increases: 0, decreases: 0, stable: 0 },
    availability: { available: 0, outOfStock: 0, unknown: 0 },
    timestamp: new Date().toISOString(),
  };
}
```

**❌ Anti-Pattern:**

```typescript
// Spread operator propagates undefined fields
async createAgentSession(sessionData: InsertAgentSession): Promise<AgentSession> {
  return {
    ...sessionData,  // ❌ May include undefined fields
    id: 1,
    sessionEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),  // ❌ Field doesn't exist in schema!
  };
}

// Returns undefined instead of empty array
async getPendingScrapingJobs(_limit: number): Promise<ScrapingJob[]> {
  throw new Error('Not supported in memory storage');  // ❌ Breaks tests
}

// Undefined vs null confusion
async createScrapingJob(jobData: InsertScrapingJob): Promise<ScrapingJob> {
  return {
    ...jobData,
    id: 1,
    createdAt: new Date(),
    attempts: 0,  // ❌ Schema has 'retryCount', not 'attempts'
  };
}
```

**Rationale:**
- **Explicit Fields**: Prevents TypeScript `undefined` vs `null` errors
- **Schema Match**: Every field matches exactly what the database schema expects
- **No Throws**: Test doubles return empty data, not errors
- **Realistic Stubs**: Return type-correct dummy data for property access

**TypeScript Errors Prevented:**
```
❌ Type 'undefined' is not assignable to type 'string | null'
   (caused by spread operator including undefined optional fields)

❌ Property 'updatedAt' does not exist in type 'AgentSession'
   (caused by adding fields not in schema)

❌ Property 'attempts' does not exist in type 'ScrapingJob'
   (caused by field name mismatch with schema)
```

**Implementation Checklist:**
- ✅ Check database schema for exact field names
- ✅ Use `|| null` for optional parameters to avoid undefined
- ✅ Return empty arrays `[]` for collection queries
- ✅ No-op for `Promise<void>` update methods
- ✅ Return zero-filled objects for stats methods
- ✅ Match timestamp field types (Date vs string)
- ✅ Never throw errors - return realistic empty data

**Related Patterns:**
- See `docs/01_TYPESCRIPT_PATTERNS.md` for null vs undefined handling
- See `docs/02_DATABASE_PATTERNS.md` for storage layer architecture

*Source: Agent Storage Layer Migration (Issue #178), MemStorage stub fixes, Session 2025-12-24*
*Added: 2025-12-24*

---

### API Response Shape Contracts (Route Tests + Client Hooks) (NEW - 2025-12-15)

**Goal**: keep server route tests and client code aligned on stable response shapes.

**Rule of thumb**: For list endpoints, return named properties inside the success envelope instead of returning a raw array.

#### ✅ Pattern: wrap list results

```ts
// server/routes/*.ts
const watchLists = await storage.getUserWatchLists(userId);
sendSuccess(res, { watchLists });
```

#### ✅ Pattern: unwrap in client hooks (keep public return types stable)

```ts
// client/src/hooks/*.ts
const result = await apiRequest<{ watchLists: WatchList[] }>('/api/watchlists');
return result.watchLists;
```

**Why**:
- Avoids accidental contract drift (tests often assert `data.<name>`).
- Allows adding pagination metadata later without breaking clients.

### Complete Redis Mock with All Exports (NEW - 2025-12-09)

**Source**: Test audit session - Many WebSocket and service tests failed due to incomplete Redis mocks.

Some modules import Redis differently. When mocking Redis, ensure you export **both** `redisClient` (direct export) and `getRedisClient` (function export):

#### ❌ WRONG - Missing `redisClient` Export
```typescript
// Test fails with "Cannot read properties of null (reading 'get')"
vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => ({
    get: vi.fn(),
    setex: vi.fn(),
  })),
  // Missing redisClient export!
}));
```

#### ✅ CORRECT - Export Both Patterns
```typescript
vi.mock('../../config/redis', () => ({
  // Some modules use: import { redisClient } from '../config/redis'
  redisClient: null, // Or mock object if methods are called directly

  // Some modules use: import { getRedisClient } from '../config/redis'
  getRedisClient: vi.fn(() => ({
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
  })),
}));
```

**Affected test files that need both exports:**
- WebSocket tests (`server/websocket/__tests__/*.test.ts`)
- Rate limiter tests (`server/middleware/__tests__/redis-rate-limiter.*.test.ts`)
- Any test using `advanced-cache.ts` or `storage-cache.ts`

---

### Logger Mock Pattern (NEW)

**Source**: Test audit session - Service tests failed due to incomplete logger mocks.

Services use the logger from `server/utils/logger.ts`. Mocks must include **all** log methods and the `createLogger` factory function.

#### ❌ WRONG - Incomplete Logger Mock
```typescript
// Test fails with "createLogger is not a function" or "logger.debug is not a function"
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
  // Missing createLogger!
  // Missing debug, warn methods!
}));
```

#### ✅ CORRECT - Complete Logger Mock
```typescript
vi.mock('../../utils/logger', () => ({
  // Direct logger export with ALL methods
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  // Factory function that returns same structure
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));
```

**When to use this mock:**
- Testing services that log operations (price snapshots, notifications, etc.)
- Testing error handling paths that call `logger.error()`
- Any test file in `server/services/__tests__/`

**Affected tests that need complete logger mock:**
- `smart-notification-service.test.ts`
- `price-snapshot-cleanup.test.ts`
- `price-history-optimized.test.ts`
- Any service using `createLogger()` for namespaced logging

---

### vi.mock() Intentional Duplication - Do NOT Extract (NEW - 2025-12-26)

**Context:** Static analysis tools (like jscpd) flag test mock declarations as "duplication" and suggest extraction. **This is a false positive.**

**Problem:** Vitest's hoisting mechanics require `vi.mock()` calls at module scope (before imports). This makes extraction to shared functions **technically impossible**. Additionally, test clarity benefits from explicit, self-contained mock setup.

**Critical Rule:** **vi.mock() declarations should NEVER be extracted to shared utilities.** Keep them local in each test file.

#### ✅ Preferred Approach - Keep Mocks Local

```typescript
// server/websocket/__tests__/handlers.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock declarations at module scope (REQUIRED by Vitest hoisting)
vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => null),
  redisClient: null,
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../services/notification-service', () => ({
  markAsRead: vi.fn(() => 1),
  getNotificationStats: vi.fn(() => ({
    total: 10,
    unread: 3,
    byType: {},
  })),
}));

// Now safe to import modules that depend on mocked modules
import { handleNotification } from '../handlers';

describe('WebSocket Handlers', () => {
  // Tests here have CLEAR visibility of what's mocked and how
});
```

**Why this is GOOD duplication:**
- **Self-documenting**: Each test file explicitly shows its dependencies and mock behavior
- **Debuggability**: When a test fails, all mock setup is visible in the same file
- **Flexibility**: Each test suite can customize mock behavior for its specific scenarios
- **Test isolation**: No shared state between test files

#### ❌ Anti-Pattern - Attempting Extraction (Fails!)

```typescript
// ❌ WRONG - test-utils.ts
export function setupWebSocketMocks() {
  // vi.mock() MUST be at module scope, NOT inside a function!
  // This will NOT work due to Vitest hoisting
  vi.mock('../../config/redis', () => ({
    getRedisClient: vi.fn(() => null),
  }));
}

// ❌ WRONG - handlers.test.ts
import { setupWebSocketMocks } from './test-utils';

setupWebSocketMocks(); // Too late! Imports already happened!
import { handleNotification } from '../handlers'; // Already used mocked modules
```

**Why this fails:**
1. **Vitest hoisting**: `vi.mock()` calls are hoisted to module scope automatically
2. **Import order**: Module imports happen before function calls can execute
3. **Runtime errors**: Modules use un-mocked dependencies, causing failures

#### What TO Extract vs What to Keep Local

**✅ DO Extract to test-utils.ts:**
- Reusable test utilities (server setup, socket creation)
- Event waiting helpers (`waitForEvent`, `waitForConnection`)
- Test data factories (`createMockSession`, `createMockRedis`)
- Cleanup functions (`disconnectSockets`, `closeTestServer`)

**❌ DO NOT Extract:**
- `vi.mock()` declarations (must stay at module scope)
- Test-specific `beforeEach`/`afterEach` setup (test isolation)
- Test-specific mock behaviors (each suite has different needs)

**Example of GOOD extraction (from WebSocket tests):**

```typescript
// ✅ GOOD - test-utils.ts (444 lines of utilities)
export async function createTestServer() { /* ... */ }
export function createAuthenticatedSocket(userId: number) { /* ... */ }
export function waitForEvent<T>(socket, eventName, timeout) { /* ... */ }
export function createMockRedis() { /* ... */ }
export function createMockSession(userId: number) { /* ... */ }

// ✅ GOOD - handlers.test.ts (uses utilities, keeps mocks local)
vi.mock('../../config/redis', () => ({ /* ... */ })); // Local mock

import { createAuthenticatedSocket, waitForEvent } from './test-utils'; // Utilities

describe('Tests', () => {
  const socket = createAuthenticatedSocket(1); // Use utility
});
```

**Rationale:**
- **Technical impossibility**: Vitest hoisting prevents mock extraction
- **Misleading metrics**: ~40 lines of intentional mock setup per file ≠ problematic duplication
- **Test clarity > DRY**: Explicit mocks make tests self-documenting and easier to debug
- **Correct pattern exists**: `test-utils.ts` already extracts the RIGHT things (utilities, not mocks)

**When code duplication metrics report high duplication in test files:**
1. **Ignore vi.mock() blocks** - This is intentional, beneficial repetition
2. **Check if test-utils.ts exists** - Utilities should already be extracted
3. **Ask: "Would extraction improve clarity?"** - Often the answer is NO for tests
4. **Remember: Tests optimize for debuggability, not LOC**

**Related Patterns:**
- See "Required Mocks for Route Tests" above for common mock patterns
- See "Redis Mock Pattern" for complete Redis mock structure
- See "Logger Mock Pattern" for complete logger mock structure

**Real-World Evidence:**
- WebSocket test suite: 5 test files, ~40 lines of mock setup each
- jscpd reported "500+ lines of duplication" - actually only ~165 lines of INTENTIONAL isolation
- Three specialized reviewers (DHH Rails, Code Simplicity, Kieran TypeScript) unanimously rejected extraction
- Dead code found: `setupWebSocketMocks()` function (lines 369-403) - existed but had ZERO usage

**The Lesson:**
Test code has different DRY rules than production code. Static analysis tools don't understand this distinction.

*Source: TODO 002 - WebSocket Test Consolidation (REJECTED after parallel review)*
*Reviewers: DHH Rails Specialist, Code Simplicity Specialist, Kieran TypeScript Specialist*
*Added: 2025-12-26*

---

### CSRF Middleware Testing (NEW)

**Source**: Test audit session - Auth tests expected 401 but received 403.

**Critical insight:** CSRF middleware runs **before** authentication middleware in the middleware pipeline. When CSRF validation fails, it returns **403 Forbidden**, not 401 Unauthorized.

#### Understanding Middleware Order

```typescript
// In server routes, CSRF runs first:
app.post('/api/endpoint',
  csrfProtection,  // 1. Validates CSRF token first (returns 403 if missing)
  withAuth(async (req, res) => {  // 2. Then validates auth (returns 401 if missing)
    // Handler logic
  })
);
```

#### ❌ WRONG - Expecting 401 for Missing CSRF
```typescript
it('should require authentication', async () => {
  // Test sends no CSRF token AND no auth
  const response = await request(app)
    .delete('/api/watchlist/1');

  // WRONG: CSRF middleware rejects first with 403, not 401!
  expectUnauthorizedError(response);  // Expects 401
});
```

#### ✅ CORRECT - Expect 403 for Missing CSRF Token
```typescript
it('should reject requests without CSRF token', async () => {
  // Test sends no CSRF token
  const response = await request(app)
    .delete('/api/watchlist/1');

  // CORRECT: CSRF middleware returns 403 before auth runs
  expect(response.status).toBe(403);
  // Note: Response may not have standard error envelope format
});
```

#### Testing Authentication Separately

To test authentication specifically, include a valid CSRF token:

```typescript
it('should require authentication (with valid CSRF)', async () => {
  // First, get a CSRF token
  const csrfResponse = await request(app).get('/api/csrf-token');
  const csrfToken = csrfResponse.body.data.csrfToken;

  // Now test auth - include CSRF to let auth middleware run
  const response = await request(app)
    .delete('/api/watchlist/1')
    .set('x-csrf-token', csrfToken);

  // NOW we get 401 because CSRF passed but auth failed
  expectUnauthorizedError(response);
});
```

**Key takeaways:**
- Missing CSRF token → **403 Forbidden** (CSRF middleware)
- Invalid CSRF token → **403 Forbidden** (CSRF middleware)
- Valid CSRF, no auth → **401 Unauthorized** (Auth middleware)
- Valid CSRF, valid auth, no permission → **403 Forbidden** (Authorization)

---

## Date and Time Testing

### Timezone-Safe Date Assertions

Date formatting in tests can fail across timezones. A date like `2025-01-01` without time is interpreted as midnight UTC, which can display as Dec 31, 2024 in western timezones.

#### ❌ WRONG - Timezone-Dependent Date
```typescript
it('should display formatted date', () => {
  render(<DateComponent date="2025-01-01" />);
  
  // FAILS in PST/PDT - shows "Dec 31, 2024" instead!
  expect(screen.getByText('Jan 1, 2025')).toBeInTheDocument();
});
```

#### ✅ CORRECT - Use ISO Timestamp with Explicit Time
```typescript
it('should display formatted date', () => {
  // Explicit noon UTC - safe in all timezones
  render(<DateComponent date="2025-01-15T12:00:00.000Z" />);
  
  // Use flexible pattern to handle timezone edge cases
  expect(screen.getByText(/Jan 1[45], 2025/i)).toBeInTheDocument();
});
```

### Date Formatting in Tests

**Best Practices:**

1. **Use ISO 8601 with explicit time**: `"2025-01-15T12:00:00.000Z"`
2. **Use noon UTC** to avoid date boundary issues
3. **Use flexible regex patterns** when exact match isn't critical: `/Jan 1[45], 2025/i`
4. **Use mid-month dates** (15th) to avoid month boundary issues

```typescript
// Good test dates (noon UTC, mid-month)
const SAFE_TEST_DATE = "2025-01-15T12:00:00.000Z";
const SAFE_TEST_DATE_2 = "2025-06-15T12:00:00.000Z";

// Avoid these
const BAD_DATE = "2025-01-01";  // No time = midnight UTC = timezone issues
const BAD_DATE_2 = "2025-01-01T00:00:00Z";  // Midnight = boundary issues
```

### Server-Side UTC Date Handling (NEW - 2025-12-09)

**Source**: Issue #179 - Price aggregation service timezone inconsistency

**CRITICAL**: Server-side date calculations MUST use UTC methods exclusively. Tests MUST match the service's timezone handling.

#### The Problem: Mixed Timezone Operations

When service code uses local timezone methods but tests expect UTC behavior (or vice versa), tests become environment-dependent:

```typescript
// Service using local timezone (WRONG)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);  // Local timezone!
yesterday.setHours(0, 0, 0, 0);

// Test using local timezone (appears to match, but fragile)
const testYesterday = new Date();
testYesterday.setDate(testYesterday.getDate() - 1);
testYesterday.setHours(12, 0, 0, 0);

// Result: Passes in PST, fails in UTC, or vice versa
```

#### The Solution: UTC-First Pattern

**Service code** must use UTC constructors and methods:

```typescript
// ✅ CORRECT - Service using UTC
private getDayDateRange(year: number, month: number, day: number) {
  // Use UTC to ensure consistent behavior across all server timezones
  const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return { startDate, endDate };
}
```

**Test code** must match with UTC methods:

```typescript
// ✅ CORRECT - Test using UTC (matches service)
const yesterday = new Date();
yesterday.setUTCDate(yesterday.getUTCDate() - 1);  // UTC arithmetic
yesterday.setUTCHours(12, 0, 0, 0);  // UTC time setting
```

#### Local vs UTC Method Reference

| Operation | Local (WRONG for servers) | UTC (CORRECT) |
|-----------|---------------------------|---------------|
| Create date | `new Date(year, month, day)` | `new Date(Date.UTC(year, month, day))` |
| Get year | `getFullYear()` | `getUTCFullYear()` |
| Get month | `getMonth()` | `getUTCMonth()` |
| Get day | `getDate()` | `getUTCDate()` |
| Set day | `setDate()` | `setUTCDate()` |
| Set time | `setHours()` | `setUTCHours()` |

#### Common Pitfall: Mixed Operations

```typescript
// ❌ WRONG - Mixing local and UTC
const date = new Date();
date.setUTCDate(date.getDate() - 1);  // getDate() is local!

// ✅ CORRECT - Consistent UTC
const date = new Date();
date.setUTCDate(date.getUTCDate() - 1);  // Both UTC
```

#### Integration Test Pattern for Date-Based Services

```typescript
describe('PriceAggregationService (Integration)', () => {
  it('should create daily aggregates for previous day', async () => {
    // Create test date using UTC methods
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(12, 0, 0, 0);  // Noon UTC

    // Insert test data with UTC timestamp
    await db.insert(priceHistory).values({
      productId: testProduct.id,
      retailerId: testRetailer.id,
      price: '99.99',
      recordedAt: yesterday,  // UTC-based Date object
    });

    // Run service method
    await service.calculateDailyAggregates();

    // Verify results
    const aggregates = await db.select().from(priceAggregatesDaily);
    expect(aggregates).toHaveLength(1);
  });
});
```

#### Date Range Test Pattern

```typescript
it('should aggregate data within date range', async () => {
  // Create explicit UTC date range
  const startDate = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));    // Jan 1, 2024 start of day UTC
  const endDate = new Date(Date.UTC(2024, 0, 3, 23, 59, 59, 999)); // Jan 3, 2024 end of day UTC

  // Insert test data with explicit UTC timestamps
  await db.insert(priceHistory).values([
    { productId: testProduct.id, recordedAt: new Date(Date.UTC(2024, 0, 1, 12)) },
    { productId: testProduct.id, recordedAt: new Date(Date.UTC(2024, 0, 2, 12)) },
    { productId: testProduct.id, recordedAt: new Date(Date.UTC(2024, 0, 3, 12)) },
  ]);

  const count = await service.aggregateToDaily(startDate, endDate);
  expect(count).toBe(3);  // Exactly 3 days of data
});
```

#### Debugging Timezone Issues

When tests fail with unexpected counts or date mismatches:

1. **Check service code**: Are all date operations using UTC methods?
2. **Check test setup**: Are test dates created with UTC methods?
3. **Log actual values**: Use `.toISOString()` to see actual UTC timestamps
4. **Verify consistency**: ALL related date operations must use same timezone approach

```typescript
// Debugging helper
console.log('Yesterday UTC:', yesterday.toISOString());
console.log('Expected range:', startDate.toISOString(), 'to', endDate.toISOString());
```

**Reference:** `docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md`

#### Automated Detection via Pre-Commit Hook (NEW - 2025-12-09)

The pre-commit hook now includes **Pattern 7** to automatically detect local timezone methods in server code before commit.

**What It Catches:**
- `new Date(year, month, day)` without `Date.UTC()`
- Local getters: `.getFullYear()`, `.getMonth()`, `.getDate()`
- Local setters: `.setDate()`, `.setHours()`, `.setMinutes()`, `.setSeconds()`

**Example Warning:**
```
WARNING Pattern 7: Local timezone date methods in server code (3 instances)
  RISK: Tests pass in one timezone but fail in another (e.g., PST vs UTC)
  QUICK FIX: Use UTC date methods for server-side date handling
```

**Bypass:** Add `// UTC:` comment if local timezone is intentional:
```typescript
// UTC: Intentional local timezone for user display
const displayDate = new Date(year, month, day);
```

**Key Insight:** This completes the feedback loop from bug fix to proactive prevention:
1. Bug found (TODO 179: timezone-dependent test failures)
2. Bug fixed (UTC methods in price-aggregation-service)
3. Bug documented (LEARNINGS_TODO_179)
4. Detection automated (Pattern 7 in pre-commit hook)

Future similar bugs are now caught at commit time, not in production.

**Reference:** `docs/LEARNINGS_PATTERN7_UTC_TIMEZONE_HOOK_CODIFICATION.md`

---

## Component Testing Patterns

### Testing Filtered UI Elements

When testing components that filter data, understand what the filtering actually affects.

#### ❌ WRONG - Testing Wrong Element Type
```typescript
it('should filter retailers', () => {
  render(<Chart data={data} selectedRetailerIds={[1]} />);
  
  // WRONG: Text "Best Buy" might appear in data, legends, tooltips, etc.
  expect(screen.queryByText('Best Buy')).not.toBeInTheDocument();
});
```

#### ✅ CORRECT - Test the Specific Filtered Elements
```typescript
it('should filter displayed retailer buttons by selected IDs', () => {
  render(<Chart data={data} selectedRetailerIds={[1]} />);
  
  // CORRECT: Test the specific UI element that filtering affects
  expect(screen.getByRole('button', { name: /amazon/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /best buy/i })).not.toBeInTheDocument();
});
```

**Key insight:** Understand the component's filtering behavior:
- Does it filter buttons/controls?
- Does it filter chart lines/data?
- Does it filter legend items?

Test the specific element type that changes, not just text content.

### Recharts Testing

Recharts components require DOM dimensions. In test environments, they log warnings about zero dimensions.

```typescript
// These warnings are expected and can be ignored:
// "The width(-1) and height(-1) of chart should be greater than 0"
// "The width(0) and height(0) of chart should be greater than 0"
```

**Testing strategy for Recharts:**
- Test component logic (loading states, empty states, data transformation)
- Test interactive elements (buttons, toggles)
- Don't test actual chart rendering (visual regression tests are better)

---

## Frontend React Hook Testing Patterns (NEW - 2025-12-28)

**Source:** TODO 013 - CI Unit Test Failures Resolution

Testing React hooks that interact with real-time events and React Query requires specialized patterns to capture internal closure functions and validate cache invalidation behavior.

### React Query Multi-Query Invalidation Pattern

**Context:** When a real-time event (WebSocket, Server-Sent Events) affects both a **list query** and **individual item queries**, you must invalidate BOTH query keys to prevent cache inconsistency.

#### The Bug Pattern

```typescript
// ❌ WRONG - Only invalidates list, item stays stale
const handleUpdate = (data: UpdateEvent) => {
  if (data.action !== 'created') {
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
  }
  // Item query NOT invalidated → user sees stale data in detail view
};

// ❌ WRONG - Only invalidates item, list stays stale
const handleUpdate = (data: UpdateEvent) => {
  void queryClient.invalidateQueries({ queryKey: [`/api/watchlists/${data.id}`] });
  // List query NOT invalidated → count/name stays stale in list view
};

// ❌ WRONG - Conditional invalidation creates inconsistency
const handleUpdate = (data: UpdateEvent) => {
  if (data.action === 'created') {
    void queryClient.invalidateQueries({ queryKey: [`/api/watchlists/${data.id}`] });
  } else {
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
  }
  // Different actions invalidate different queries = cache inconsistency
};
```

#### The Correct Pattern

```typescript
// ✅ CORRECT - Invalidate BOTH queries for all actions
const handleUpdate = (data: UpdateEvent) => {
  // Invalidate both the list query and the specific item query
  // WebSocket events arrive AFTER mutations complete, so no race condition
  void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
  void queryClient.invalidateQueries({ queryKey: [`/api/watchlists/${data.id}`] });

  // Show toast notification...
};
```

#### Common Scenarios

**Scenario 1: Create Event**
```typescript
// User creates a watchlist
// WebSocket event: { action: 'created', watchListId: 5 }

// ✅ CORRECT - Invalidate both
queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });        // List query
queryClient.invalidateQueries({ queryKey: ['/api/watchlists/5'] });     // Item query

// Why: User needs fresh list (with new item) AND item details if they navigate to it
```

**Scenario 2: Update Event**
```typescript
// User updates a watchlist name
// WebSocket event: { action: 'updated', watchListId: 3, name: 'New Name' }

// ✅ CORRECT - Invalidate both
queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });        // List (name in list)
queryClient.invalidateQueries({ queryKey: ['/api/watchlists/3'] });     // Item (full details)

// Why: Name appears in both list view and detail view
```

**Scenario 3: Delete Event**
```typescript
// User deletes a watchlist
// WebSocket event: { action: 'deleted', watchListId: 2 }

// ✅ CORRECT - Invalidate both
queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });        // List (remove item)
queryClient.invalidateQueries({ queryKey: ['/api/watchlists/2'] });     // Item (mark deleted)

// Why: List needs to remove item, detail view should show 404
```

**Scenario 4: Nested Resource Event**
```typescript
// User adds product to watchlist
// WebSocket event: { action: 'product_added', watchListId: 1, productId: 99 }

// ✅ CORRECT - Invalidate all affected levels
queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });        // List (product count)
queryClient.invalidateQueries({ queryKey: ['/api/watchlists/1'] });     // Item (product list)
queryClient.invalidateQueries({ queryKey: ['/api/products/99'] });      // Product (if shown)

// Why: Product count in list, product list in detail, product details if shown
```

#### Testing Pattern

```typescript
it('should invalidate queries on watch list update', async () => {
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  let updateHandler: any = null;
  vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
    if (event === 'watchlist:update') {
      updateHandler = handler;
    }
  });

  renderHook(() => useWatchListUpdates(), { wrapper });

  // Simulate watch list update event
  if (updateHandler) {
    updateHandler({
      watchListId: 1,
      name: 'My List',
      action: 'created',
      productCount: 0,
      timestamp: new Date().toISOString(),
    });
  }

  await waitFor(() => {
    // ✅ BOTH must be called
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists/1'] });
  });
});
```

### Hook Event Handler Testing Pattern

**Context:** Testing React hooks that register event handlers (WebSocket, EventEmitter) is challenging because event handlers are internal closure functions that can't be directly invoked.

#### The Challenge

```typescript
// Hook implementation
export function useWatchListUpdates() {
  useEffect(() => {
    // ❌ This handler is a closure - not exported, not directly testable
    const handleUpdate = (data: UpdateEvent) => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      queryClient.invalidateQueries({ queryKey: [`/api/watchlists/${data.watchListId}`] });
    };

    websocketClient.on('watchlist:update', handleUpdate);

    return () => {
      websocketClient.off('watchlist:update', handleUpdate);
    };
  }, []);
}
```

**Problem:** How do you test `handleUpdate` when it's a private closure?

#### The Solution: Event Handler Interception

**Step 1: Capture Event Handler Reference**

```typescript
it('should invalidate queries on watch list update', async () => {
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  // Capture the handler when websocketClient.on() is called
  let updateHandler: any = null;
  vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
    if (event === 'watchlist:update') {
      updateHandler = handler;  // ← Store reference to handler
    }
  });

  renderHook(() => useWatchListUpdates(), { wrapper });

  // ... rest of test
});
```

**Step 2: Manually Invoke Captured Handler**

```typescript
  // Simulate watch list update event by calling captured handler
  if (updateHandler) {
    updateHandler({
      watchListId: 1,
      name: 'My List',
      action: 'created',
      productCount: 0,
      timestamp: new Date().toISOString(),
    });
  }
```

**Step 3: Assert Side Effects**

```typescript
  await waitFor(() => {
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists/1'] });
  });
```

#### Advanced: Multiple Event Handlers

```typescript
it('should handle multiple events in sequence', async () => {
  // Capture ALL handlers in a map
  const handlers: Record<string, any> = {};
  vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
    handlers[event] = handler;  // Store by event name
  });

  renderHook(() => useWatchListUpdates(), { wrapper });

  // Simulate 'created' event
  handlers['watchlist:created']?.({ watchListId: 1, name: 'List 1' });

  // Simulate 'updated' event
  handlers['watchlist:updated']?.({ watchListId: 1, name: 'Updated List' });

  // Simulate 'deleted' event
  handlers['watchlist:deleted']?.({ watchListId: 1 });

  await waitFor(() => {
    expect(invalidateQueries).toHaveBeenCalledTimes(6); // 2 calls per event
  });
});
```

#### Full Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWatchListUpdates } from '../use-watchlist-updates';
import * as websocketClient from '@/lib/websocket-client';

// Mock websocket client
vi.mock('@/lib/websocket-client', () => ({
  on: vi.fn(),
  off: vi.fn(),
}));

describe('useWatchListUpdates', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  });

  it('should invalidate queries on watch list update', async () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    // Capture handler
    let updateHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'watchlist:update') {
        updateHandler = handler;
      }
    });

    renderHook(() => useWatchListUpdates(), { wrapper });

    // Invoke handler
    if (updateHandler) {
      updateHandler({
        watchListId: 1,
        name: 'My List',
        action: 'created',
        productCount: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Assert side effects
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists'] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists/1'] });
    });
  });
});
```

**Key Points:**
- Use `mockImplementation` to intercept event registration
- Store handler reference in test scope variable
- Manually invoke handler with test data
- Use `waitFor` for async side effects
- Assert on observable side effects (query invalidation, state changes, etc.)

---

## Route Testing Patterns

### Testing Missing Route Parameters

When Express routes have required parameters (`:token`, `:id`), requesting the path without the parameter returns a 404 (no route match), not a validation error.

#### ❌ WRONG - Expecting Validation Error
```typescript
it('should reject request with missing token', async () => {
  const response = await request(app).get('/api/auth/reset-password/');
  
  // WRONG: Route doesn't match, so no validation runs
  expectBadRequestError(response, 'Token is required');
});
```

#### ✅ CORRECT - Expect 404 for Unmatched Route
```typescript
it('should return 404 for request with missing token', async () => {
  const response = await request(app).get('/api/auth/reset-password/');
  
  // CORRECT: Express returns 404 when no route matches
  expect(response.status).toBe(404);
});
```

### Express Route Not Found Behavior

Understanding Express routing:

| Request | Route Definition | Result |
|---------|-----------------|--------|
| `GET /api/reset-password/abc123` | `GET /api/reset-password/:token` | ✅ Matches, runs handler |
| `GET /api/reset-password/` | `GET /api/reset-password/:token` | ❌ No match, 404 |
| `GET /api/reset-password` | `GET /api/reset-password/:token` | ❌ No match, 404 |

**Note:** The 404 response may not follow your API's standard error envelope format since it's returned before any route handler runs.

### Type-Safe Response Validation Pattern (NEW - 2026-01-04)

**Source**: TODO_006 API Testing Migration

Use typed validation helpers instead of manual `response.body` access for API route tests.

#### ❌ OLD PATTERN - Weak Typing, Verbose

```typescript
const response = await request(app)
  .post('/api/endpoint')
  .send(data)
  .expect(200);

expect(response.body.success).toBe(true);
expect(response.body.data.name).toBe('Test Product');
expect(response.body.data.price).toBe(99.99);
```

**Problems**:
- No type safety on `response.body.data` (TypeScript treats it as `any`)
- Verbose: 4 lines of boilerplate per test
- No IDE autocomplete
- Easy to access wrong properties without compiler errors

#### ✅ NEW PATTERN - Type-Safe Validation Helpers

```typescript
import {
  expectSuccessResponse,
  expectCreatedResponse,
  expectErrorResponse,
} from '../../__tests__/helpers/response-validators';

// Success response (200)
const response = await request(app).post('/api/endpoint').send(data);
const result = expectSuccessResponse<{ name: string; price: number }>(response, 200);
expect(result.name).toBe('Test Product'); // ✅ Type-safe!
expect(result.price).toBe(99.99);

// Created response (201)
const created = expectCreatedResponse<{ id: number; name: string }>(response);
expect(created.id).toBeGreaterThan(0);
expect(created.name).toBe('New Product');

// Error responses
expectUnauthorizedError(response); // 401
expectForbiddenError(response, /CSRF/i); // 403 with error message pattern
expectNotFoundError(response); // 404
expectBadRequestError(response); // 400
expectConflictError(response); // 409
```

**Benefits**:
- **Type safety**: TypeScript generics provide compile-time checking
- **IDE autocomplete**: Full IntelliSense on response data
- **Concise**: 1-2 lines vs 3-4 lines per assertion
- **Centralized validation**: Response envelope structure validated once
- **Consistent**: All tests use the same validation logic

#### Available Validation Helpers

**File**: `server/__tests__/helpers/response-validators.ts`

```typescript
// Success responses
expectSuccessResponse<T>(response, expectedStatus = 200): T
expectCreatedResponse<T>(response): T  // 201

// Error responses
expectUnauthorizedError(response, errorPattern?): ErrorResponse  // 401
expectForbiddenError(response, errorPattern?): ErrorResponse  // 403
expectNotFoundError(response, errorPattern?): ErrorResponse  // 404
expectBadRequestError(response, errorPattern?): ErrorResponse  // 400
expectConflictError(response, errorPattern?): ErrorResponse  // 409

// Paginated responses
expectPaginatedResponse<T>(response, expectedStatus = 200): {
  data: T[],
  meta: { total: number, page: number, limit: number }
}
```

#### Migration Pattern

**Before**:
```typescript
const res = await request(app).post('/api/products').send(validBody).expect(201);
expect(res.body.success).toBe(true);
expect(res.body.data.name).toBe('New Product');
```

**After**:
```typescript
const res = await request(app).post('/api/products').send(validBody);
const result = expectCreatedResponse<{ name: string }>(res);
expect(result.name).toBe('New Product');
```

#### When to Use Typed Schemas

For complex response types, use Zod schemas from `response-validators.ts`:

```typescript
import { productSchema } from '../../__tests__/helpers/response-validators';

// Instead of unknown[]
const result = expectSuccessResponse<{ products: unknown[] }>(res, 200);

// Use typed schema
const result = expectValidatedResponse(res, z.object({
  products: z.array(productSchema)
}), 200);
// Now result.products[0].id and .name are fully typed
```

#### Real-World Impact

**TODO_006 Migration Results**:
- **Files migrated**: 2 (api-v1-routes.test.ts, csrf-protection.test.ts)
- **Tests migrated**: 108 (77 + 31)
- **Assertions migrated**: ~140
- **Bugs found**: 0 (validation caught no regressions)
- **Boilerplate reduced**: ~50% (2-3 lines → 1 line per assertion)
- **Test runtime**: No change (helpers have zero overhead)

**Key Learning**: Type-safe validation helps during test writing (autocomplete, compiler errors) but found no bugs in already-working tests. Maximum value comes from using helpers from the start.

---

## Avoiding Skipped Tests

`it.skip()` is technical debt. Address the root cause instead.

### Common Skip Reasons and Fixes

| Skip Reason | Fix |
|-------------|-----|
| "Date formatting issues" | Use timezone-safe dates (see above) |
| "Test environment differences" | Mock the environment-specific behavior |
| "Flaky test" | Find the race condition, add proper waits |
| "Feature not implemented" | Use `it.todo()` instead |
| "Hard to test" | Refactor code to be more testable |
| "Requires external service" | Add proper mocks |

### When to Use `it.todo()` vs `it.skip()`

```typescript
// Use it.todo() for planned but unwritten tests
it.todo('should handle concurrent requests');

// Use it.skip() ONLY temporarily during debugging
// MUST include a comment explaining why and when it will be fixed
it.skip('temporarily skipped while debugging auth flow - fix by EOD', () => {
  // ...
});
```

**Rule:** If a test is skipped for more than one PR, either fix it or delete it.

### Anti-Pattern: Placeholder Tests (NEW - 2026-01-04)

**Source**: TODO_006 Code Review - kieran-typescript-reviewer

**NEVER** use placeholder tests that always pass. They inflate test counts and hide missing coverage.

#### ❌ WRONG - Fake-Passing Placeholder

```typescript
it('should not accept tokens after they expire', () => {
  // This would require session expiry simulation
  // Placeholder for future implementation
  expect(true).toBe(true); // ❌ Always passes!
});
```

**Problems**:
- Test suite reports "108 tests passing" but one is meaningless
- No test coverage for token expiry (false confidence)
- CI metrics become inaccurate
- Future developers don't know this needs implementation
- Pre-commit hooks pass without testing actual behavior

**Why Developers Do This**:
- Want to show progress ("look, I added tests!")
- Don't want red test output
- Think "I'll implement it later" (never happens)
- Copied pattern from other codebases

#### ✅ CORRECT - Honest Skipped Test

```typescript
it.skip('should not accept tokens after they expire', () => {
  // TODO: Implement session expiry simulation
  // Requires time-travel mocking for session middleware
  // See: https://github.com/expressjs/session#cookie-options
});
```

**Benefits**:
- Test suite reports "107 passing, 1 skipped" (honest metrics)
- CI shows skipped tests in logs (visible to team)
- Clearly communicates missing coverage
- TODO comment explains what's needed
- Can track skipped test count over time

#### Detecting Placeholder Tests

**Search for common patterns**:
```bash
# Find fake-passing tests
grep -rn "expect(true).toBe(true)" --include="*.test.ts"
grep -rn "expect(1).toBe(1)" --include="*.test.ts"
grep -rn "placeholder.*test" --include="*.test.ts" -i

# Find tests with no assertions
grep -rn "it('.*', () => {$" --include="*.test.ts"
```

#### Real-World Example from TODO_006

**Before** (csrf-protection.test.ts):
```typescript
it('should not accept tokens after they expire', () => {
  // This would require session expiry simulation
  // Placeholder for future implementation
  expect(true).toBe(true);
});

// Test output: ✓ 31 tests passing
```

**After**:
```typescript
it.skip('should not accept tokens after they expire', () => {
  // TODO: Implement session expiry simulation
  // Requires time-travel mocking for session middleware
  // See: https://github.com/expressjs/session#cookie-options
});

// Test output: ✓ 30 passing, 1 skipped
```

**Impact**:
- Honest metrics: Changed from "31 passing" to "30 passing, 1 skipped"
- Clear TODO for future work
- Pre-commit hook still passes (skipped tests allowed)
- CI metrics now accurate

#### When Placeholder Tests Are Acceptable

**NEVER.** There is no valid use case for `expect(true).toBe(true)`.

If you can't implement the test yet:
- Use `it.skip()` with a TODO comment
- Use `it.todo()` for planned tests
- Delete the test until you're ready to implement it

**Rule**: Tests should either validate real behavior or be explicitly skipped/todo. No middle ground.

### Test Skipping Documentation Pattern (NEW - 2025-12-28)

**Source:** TODO 013 - CI Unit Test Failures Resolution

When skipping tests with `describe.skip()` or `it.skip()`, **always include detailed comments** explaining:

1. **Why the test is being skipped** (root cause)
2. **What would be required to fix it**
3. **Whether this is library feature testing** (can skip) or **app logic testing** (should fix)

#### ✅ Good Example: Library Feature Testing

```typescript
// SKIP: These tests attempt to verify Socket.io client library reconnection behavior,
// not our application logic. They fail because:
// 1. Tests don't properly mock Express session authentication (session.passport.user required)
// 2. They test socket.io-client features (reconnection, backoff), not our WebSocket handlers
// 3. One test (exponential backoff) calls shutdownWebSocket() causing test pollution
//
// Our application doesn't implement reconnection logic - it's built into socket.io-client.
// We should test our event handlers (watchlist updates, subscriptions), not library internals.
describe.skip('WebSocket Reconnection Tests', () => {
  // ...
});
```

**Why Good**:
- Identifies 3 specific issues
- Explains architectural decision (library handles reconnection)
- Clarifies what SHOULD be tested (our handlers)
- Future developer knows these tests can be deleted safely

#### ✅ Good Example: Authentication Mocking Issue

```typescript
// SKIP: These load tests fail due to authentication mocking issues.
// createAuthenticatedSocket() sets x-test-user-id header, but WebSocket auth
// middleware requires session.passport.user from Express sessions (lines 196-203
// of server/websocket/index.ts). All clients fail auth → no 'connect' event → timeout.
// These tests should be rewritten with proper Express session mocking or removed entirely.
describe.skip('WebSocket Load Tests', () => {
  // ...
});
```

**Why Good**:
- Explains exact mismatch (header vs session)
- References specific code location (lines 196-203)
- Describes symptom (timeout) and cause (no connect event)
- Provides two fix options (rewrite or remove)

#### ✅ Good Example: Concise Reference

```typescript
// SKIP: Same authentication mocking issue as load.test.ts - all tests timeout
// waiting for 'connect' event that never fires due to missing session.passport.user
describe.skip('WebSocket Integration Tests', () => {
  // ...
});
```

**Why Good**:
- References related skip (DRY principle)
- Concise but still explains root cause
- Links to detailed explanation in load.test.ts

#### ❌ Bad Examples

```typescript
// BAD: No Explanation
// TODO: Fix this later
it.skip('should handle reconnection', () => {
  // ...
});

// BAD: Vague Comment
// Flaky test, skipping
describe.skip('WebSocket Tests', () => {
  // ...
});

// BAD: Only References Ticket
// See ticket #456
it.skip('should emit events', () => {
  // ...
});
```

#### Pattern Template

```typescript
// SKIP: <High-level reason>
// <Detailed root cause>
// <What would fix it>
// <Additional context or decision rationale>
describe.skip('Test Suite Name', () => {
  // ...
});
```

---

### E2E Graceful Degradation Pattern (NEW - 2026-01-05)

**Source:** TODO 007/008 - Price Analytics E2E Investigation

E2E tests for **optional/conditional features** should use **graceful degradation** (conditional skip) instead of failing when UI elements aren't found. This pattern prevents test failures for features that:

- Are implemented differently than expected
- Use different selectors or component structures
- Require specific data patterns to render
- Are hidden behind authentication or feature flags
- May not be needed at all (simpler UX is better)

#### When to Use Graceful Degradation

✅ **USE conditional skips for:**

- **Optional analytics features** (charts, badges, trend indicators)
- **Conditional UI elements** (features that only appear with specific data)
- **Enhancement features** (nice-to-have, not core workflows)
- **Cross-cutting concerns** (features used across multiple pages)

#### When NOT to Use Graceful Degradation

❌ **NEVER use conditional skips for:**

- **Core user workflows** (auth, product search, watchlist)
- **Critical business logic** (price tracking, notifications)
- **Required features** (features users explicitly requested)
- **Data integrity** (CRUD operations, form submissions)

**Rule**: If the feature breaking would require immediate hotfix → test should FAIL, not skip.

#### Pattern: Conditional Skip Helper

**From `e2e/price-analytics.spec.ts` (lines 128-546)**:

```typescript
/**
 * Helper to conditionally skip E2E test if UI element is missing
 * Use for optional/conditional features (analytics, badges, etc.)
 * NEVER use for core workflows (auth, search, watchlist)
 */
async function skipIfMissing(
  test: any,
  locator: Locator | null,
  reason: string
): Promise<boolean> {
  if (!locator || (await locator.count()) === 0) {
    test.skip(true, reason);
    return true; // Test will be skipped
  }
  return false; // Continue test execution
}

// Usage in E2E test
test('should display price trend indicator', async ({ page }) => {
  await page.goto('/product/123');

  const trendIndicator = page.locator('[data-testid="price-trend"]');

  // Gracefully skip if feature doesn't exist (may not be implemented yet)
  if (await skipIfMissing(test, trendIndicator, 'Price trend indicator not implemented')) {
    return;
  }

  // If we get here, feature exists - now test it properly
  await expect(trendIndicator).toBeVisible();
  await expect(trendIndicator).toContainText(/rising|falling|stable/i);
});
```

#### ✅ Good Example: Optional Analytics Feature

```typescript
test('should compare prices across retailers', async ({ page }) => {
  await page.goto('/product/456');

  const comparison = page.locator('[data-testid="retailer-comparison"]');

  // OPTIONAL: Retailer comparison may not exist or may use different UI pattern
  if (await skipIfMissing(test, comparison, 'Retailer comparison not found')) {
    return;
  }

  // Feature exists - verify it works
  await expect(comparison).toBeVisible();
  const retailers = await comparison.locator('.retailer-card').count();
  expect(retailers).toBeGreaterThan(1);
});
```

**Why Good**:
- Clear reason for skip (feature may not exist)
- Tests properly when feature IS present
- Doesn't block CI for optional analytics
- Future developer can investigate skipped tests separately

#### ❌ Bad Example: Core Workflow with Graceful Skip

```typescript
// BAD: Auth is CORE - test should FAIL if broken
test('should login user', async ({ page }) => {
  await page.goto('/login');

  const loginForm = page.locator('form[action="/api/auth/login"]');

  // WRONG: Login is critical - this should FAIL, not skip
  if (await skipIfMissing(test, loginForm, 'Login form not found')) {
    return;
  }

  // ... rest of test
});
```

**Why Bad**:
- Login is critical functionality
- If login breaks, we need immediate alert (test failure)
- Graceful skip would hide production-breaking bugs
- CI would pass even though app is broken

#### ✅ Good Example: Feature With Data Dependency

```typescript
test('should display historical price data', async ({ page }) => {
  await page.goto('/product/789');

  const chart = page.locator('[data-testid="price-history-chart"]');

  // Chart may not render if product has no price history data
  if (await skipIfMissing(test, chart, 'Chart not found (may need price history data)')) {
    return;
  }

  // Chart exists - verify data accuracy
  const dataPoints = await chart.locator('.recharts-line-dot').count();
  expect(dataPoints).toBeGreaterThan(0);
});
```

**Why Good**:
- Acknowledges data dependency in skip reason
- Hints at fix (seed price history data)
- Doesn't fail if database is empty
- Still validates chart when data exists

#### Maintenance Requirements

**Quarterly Audit (Every 3 months)**:

```bash
# Find all conditional skips in E2E tests
grep -r "skipIfMissing\|test.skip(true" e2e/

# For each skipped test, determine:
# 1. Does the feature exist now? → Update test selectors
# 2. Is the feature still needed? → Keep skip or remove test
# 3. Should it be implemented? → Create implementation ticket
```

**Pattern for TODO Creation**:

When E2E tests skip gracefully (5+ skipped tests), create investigation TODO:

```markdown
# TODO XXX: Investigate Skipped E2E Tests

**Priority**: P3 (Low - Investigation only)
**Estimated Time**: 4-8 hours

## Skipped Tests

1. Feature X - Skip reason: UI element not found
   - Investigation: Check if feature exists under different selector

2. Feature Y - Skip reason: Data dependency
   - Investigation: Verify test data seeding

## Success Criteria

- [ ] All skipped tests investigated
- [ ] Test selectors updated OR tests removed
- [ ] Implementation tickets created for missing features
```

#### Decision Framework

**Use this flowchart when writing E2E tests:**

```
Is this feature CRITICAL for users to complete their primary task?
├─ YES → Test should FAIL if broken (standard E2E test)
└─ NO  → Is feature nice-to-have / conditional?
    ├─ YES → Use graceful degradation (skipIfMissing)
    └─ NO  → Consider if test is needed at all
```

**Examples by Category**:

| Category | Pattern | Example Features |
|----------|---------|------------------|
| **Core Workflows** | FAIL on missing | Auth, Search, Watchlist CRUD |
| **Optional Features** | Graceful skip | Analytics charts, trend indicators |
| **Conditional UI** | Graceful skip | Badges, tooltips, comparison tables |
| **Data-Dependent** | Graceful skip | Historical charts, aggregated stats |
| **Enhancement** | Graceful skip | PDF export, social sharing |

#### Related Patterns

- **Test Skipping Documentation Pattern** (above) - How to document `test.skip()` calls
- **Schema Synchronization Pattern** (`CLAUDE.md:374-417`) - Keep test DB schema in sync
- **Test Data Seeding** (`e2e/helpers.ts`) - Ensure realistic test data for conditional features

---

---

## Custom Agent Patterns (NEW - 2025-12-23)

**Source:** Pattern-codifier agent creation session, 2025-12-23

Custom agents codify project-specific workflows into reusable, self-documenting tools that leverage Claude Code's subagent system.

### Creating Project-Specific Subagents

**Context:** When you need to create custom agents for project-specific workflows (like pattern codification, specialized code review, or domain-specific validation).

**Problem:** Generic agents may not fit project-specific needs. Need a way to codify project-specific workflows and processes into reusable agents that understand the codebase structure, conventions, and quality standards.

#### ✅ Preferred Approach: Custom Agent Definition Files

```markdown
<!-- .claude/agents/pattern-codifier.md -->
---
name: pattern-codifier
description: Extract patterns from code reviews and codify into docs/*_PATTERNS.md files. Use after completing PR reviews or when capturing learnings from development sessions.
tools: Read, Write, Edit, Grep, Glob, Bash, WebSearch
model: sonnet
---

You are a pattern documentation specialist for the PriceCompare codebase. Your mission is to extract learnings from code reviews, development sessions, and feedback, then codify them into the appropriate pattern documentation files.

## When to Invoke This Agent

- After completing a code review (manual or via code-review-specialist)
- After resolving a complex bug with lessons learned
- After implementing a feature with new patterns to document
- When you notice recurring issues that should be codified
- After a development session where anti-patterns were corrected

## Codification Workflow

### 1. Gather Feedback Sources

**Priority order:**

1. **Recent PR comments** (if applicable):
   ```bash
   gh pr view [PR_NUMBER] --comments --json comments
   ```

2. **Recent git commits** (review messages):
   ```bash
   git log --since="1 week ago" --pretty=format:"%h %s%n%b" --grep="review\|fix\|pattern\|refactor"
   ```

3. **Current conversation context**: Analyze the messages in this session for:
   - Corrections made during development
   - Anti-patterns identified and fixed
   - Security issues resolved
   - Performance optimizations applied
   - Type safety improvements

<!-- Full agent workflow documentation continues... -->
```

**Invoke the agent:**

```bash
# After code review session
claude task pattern-codifier "Codify patterns from this development session"

# Analyze specific PR
claude task pattern-codifier "Analyze PR #123 and extract patterns"

# From recent commits
claude task pattern-codifier "Review last 10 commits and extract patterns worth documenting"
```

**Key Features:**

1. **YAML Frontmatter Configuration:**
   - `name`: Agent identifier for invocation
   - `description`: What the agent does and when to use it
   - `tools`: Which tools the agent can access
   - `model`: LLM model to use (sonnet, opus, haiku)

2. **Comprehensive Documentation:**
   - When to invoke the agent
   - Step-by-step workflows
   - Quality standards and checklists
   - Examples and templates
   - Integration with other agents

3. **Self-Documenting:**
   - Agent definition IS the documentation
   - No separate README needed
   - Clear invocation examples in the file

4. **Project Context Awareness:**
   - References to specific files (docs/01_TYPESCRIPT_PATTERNS.md, etc.)
   - Codebase conventions (sendSuccess/sendError patterns)
   - Pre-commit hook integration
   - Existing agent system (code-review-specialist)

#### ❌ Anti-Pattern: Hardcoded Workflows Without Agent Abstraction

```bash
# ❌ WRONG - One-off script without reusability
# create-pattern.sh (no agent definition)
#!/bin/bash
echo "What pattern are you documenting?"
read pattern_name
echo "Which file should it go in?"
read target_file
# ... hardcoded logic with no documentation

# Problems:
# - Not discoverable (no `claude task` integration)
# - No documentation of workflow
# - No validation or quality checks
# - Can't leverage Claude Code's context
# - No integration with other agents
```

```typescript
// ❌ WRONG - Generic agent without project specifics
// .claude/agents/generic-documenter.md
---
name: generic-documenter
description: Document code
tools: Read, Write
model: sonnet
---

Please document the code.

// Problems:
// - Doesn't know about docs/*_PATTERNS.md structure
// - Doesn't understand project conventions
// - No workflow guidance
// - No quality standards
// - Missing cross-references to existing systems
```

**Rationale:**

**Why Custom Agents Are Superior:**

1. **Codified Expertise:** Captures project-specific knowledge that would otherwise live in developer heads
2. **Reusable Across Sessions:** Same agent works for all developers in all sessions
3. **Self-Documenting:** Agent definition IS the documentation (no README drift)
4. **Consistent Quality:** Built-in quality checks ensure standards are met
5. **Discoverable:** `claude task [agent-name]` makes workflows easily findable
6. **Integrated:** Works with other agents (code-review-specialist → pattern-codifier)

**Why YAML Frontmatter:**

- Structured metadata (name, description, tools, model)
- Easy to parse programmatically
- Familiar pattern (GitHub Actions, Jekyll, Hugo)
- Keeps configuration separate from documentation

**Why `.claude/agents/` Directory:**

- Standard location (convention over configuration)
- Claude Code automatically discovers agents here
- Keeps agents separate from hooks (.claude/hooks.json)
- Easy to version control and share across team

**Agent Creation Checklist:**

Before creating a custom agent:

- ✅ Workflow is project-specific (not generic)
- ✅ Will be reused across multiple sessions
- ✅ Requires understanding of codebase structure
- ✅ Has quality standards to enforce
- ✅ Integrates with existing systems (git, gh, pre-commit hooks)
- ✅ Benefits from Claude's reasoning (not just a script)

**Integration Patterns:**

**Agent Chaining (Sequential):**

```bash
# 1. Review code changes
claude task code-review-specialist "Review recent changes in server/routes/"

# 2. Address review feedback, make corrections

# 3. Extract patterns from the review
claude task pattern-codifier "Codify patterns from this review session"

# 4. Commit everything together
git add .
git commit -m "feat: implement feature X with codified patterns"
```

**Agent Hooks (Automatic Invocation):**

```json
// .claude/hooks.json
{
  "pre-commit": {
    "agent": "code-review-specialist",
    "prompt": "Review the staged changes in this commit. Focus on the diff and highlight any issues before I commit."
  }
}
```

**When reviewing commits through Claude Code, the code-review-specialist agent automatically runs** to validate changes against pattern files and pre-commit hook requirements.

**Related Patterns:**

- Pattern codification workflow: `.claude/agents/pattern-codifier.md` (full workflow documentation)
- Code review integration: `.claude/hooks.json` (automatic code-review-specialist invocation)
- Subagent system: `.claude/knowledge/claude-code-subagent-setup-guide.md`
- Pattern files: `docs/01_TYPESCRIPT_PATTERNS.md` through `docs/08_TESTING_PATTERNS.md`
- Pre-commit hooks: `.git/hooks/pre-commit`, `docs/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md`

**Examples of Custom Agents in This Project:**

1. **pattern-codifier** (`.claude/agents/pattern-codifier.md`)
   - Purpose: Extract and document patterns from development sessions
   - When to use: After code reviews, bug fixes, feature implementations
   - Integration: Works with code-review-specialist, updates pattern files

2. **code-review-specialist** (referenced in `.claude/hooks.json`)
   - Purpose: Review code changes for pattern violations
   - When to use: Pre-commit hook, manual code reviews
   - Integration: Checks against all pattern files, pre-commit hook rules

**Agent Development Tips:**

1. **Start with Workflow Documentation:** Write the step-by-step process first, then convert to agent
2. **Include Examples:** Show real invocations with expected outputs
3. **Reference Actual Files:** Use real paths from the codebase, not placeholders
4. **Quality Over Quantity:** One well-documented agent > five poorly documented agents
5. **Test Before Committing:** Actually invoke the agent to verify it works
6. **Version Control:** Agent definitions are code - review and version them

**Common Use Cases for Custom Agents:**

- **Pattern Codification:** Extract learnings from sessions (pattern-codifier)
- **Code Review:** Specialized review for domain patterns (code-review-specialist)
- **Migration:** Automated refactoring with quality checks (migration-specialist)
- **Security Audits:** Security-focused code analysis (security-auditor)
- **Documentation:** Generate/update docs from code (doc-generator)
- **Testing:** Test generation following project patterns (test-generator)

*Source: Pattern-codifier agent creation session, 2025-12-23*
*Added: 2025-12-23*

---

## Test-Only Secrets Pattern (NEW - 2025-12-26)

**Context**: Test files need hardcoded secrets for session/middleware configuration. These are acceptable when properly documented and scoped to test environment only.

**Problem**: Pre-commit hooks and security scanners may flag hardcoded secrets in test files. However, test-only secrets pose minimal security risk if never used in production.

### ✅ CORRECT - Documented Test-Only Secrets

```typescript
// server/test/basic-auth.test.ts

import session from 'express-session';
import express, { type Express } from 'express';

function createTestApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(
    session({
      secret: 'test-session-secret', // Test-only secret, not used in production
      resave: false,
      saveUninitialized: false,
    })
  );

  // ... rest of test setup
  return app;
}
```

**Key Requirements:**

1. **Inline Comment** - Explain this is test-only
2. **Obvious Test Naming** - Use `test-session-secret`, not production-like values
3. **Test File Only** - Never import test secrets into production code
4. **Environment Check** - Test code only runs when `NODE_ENV === 'test'`

### ❌ WRONG - Ambiguous or Reusable Secrets

```typescript
// ❌ BAD - Looks like a real secret
session({
  secret: 'MyApp-SessionSecret-2025', // Could be mistaken for production
});

// ❌ BAD - No documentation
session({
  secret: 'abc123',
});

// ❌ BAD - Shared with production
import { TEST_SESSION_SECRET } from '../config/secrets'; // Risky import path
```

### Documentation Checklist for Test Secrets

- [ ] **Inline comment** - Explains "Test-only secret, not used in production"
- [ ] **Obvious naming** - Starts with `test-` or contains `test` keyword
- [ ] **Scoped to test files** - Never in `src/`, `server/`, or `shared/` directories
- [ ] **Not in environment files** - Don't add to `.env` or `.env.example`
- [ ] **Not in configuration modules** - Hardcoded in test file, not imported

### When Test Secrets are Acceptable

✅ **Use test-only secrets for:**

- Session middleware in test app setup
- CSRF token generation in tests
- JWT signing for auth tests
- Encryption keys for test data
- API keys for mocked services

❌ **NEVER use test secrets for:**

- Production code paths
- Shared configuration modules
- Environment variable fallbacks
- Default values in production code

### Pre-Commit Hook Bypass Pattern

If pre-commit hook flags test secrets, document in commit message:

```bash
git commit -m "test: add HTTP Basic Auth integration tests

Test-only secrets:
- 'test-session-secret' in basic-auth.test.ts (line 26)
- Only used in createTestApp() for Express session middleware
- Never imported into production code
- Scoped to test environment (NODE_ENV=test)"
```

### Alternative Pattern: Environment Variable

For teams with strict secret policies, use test environment variables:

```typescript
// .env.test
SESSION_SECRET=test-session-secret-from-env

// server/test/basic-auth.test.ts
import dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

function createTestApp(): Express {
  const app = express();

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'fallback-test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );

  return app;
}
```

**Trade-offs:**

- **Pros**: No hardcoded secrets in code
- **Cons**: Adds setup complexity, `.env.test` file needed
- **Recommendation**: Use inline secrets for simplicity unless compliance requires otherwise

*Source: HTTP Basic Auth integration tests (2025-12-26)*
*Added: 2025-12-26*

---

## Testing Checklist

Before committing tests:

- [ ] **No `it.skip()` without justification** - Every skip needs a comment and plan
- [ ] **Dates use ISO format with explicit time** - `"2025-01-15T12:00:00.000Z"`
- [ ] **Redis mocked for route tests** - Mock placed before all imports
- [ ] **Redis mock exports both `redisClient` and `getRedisClient`** - Some modules use different imports
- [ ] **Logger mock includes all methods and `createLogger`** - info, error, warn, debug
- [ ] **CSRF tests expect 403, not 401** - CSRF middleware runs before auth
- [ ] **Test element types match filtering behavior** - Use correct query (role, text, etc.)
- [ ] **Route parameter tests expect correct status** - Missing params = 404, not 400
- [ ] **External services mocked** - Email, Redis, external APIs
- [ ] **Tests pass in isolation** - `npm test -- --run <file>` works
- [ ] **No timezone-dependent assertions** - Use flexible patterns or fixed times

---

## Related Documentation

- **[TEST_OVERVIEW.md](testing/TEST_OVERVIEW.md)** - Test suite organization
- **[LEARNINGS_TODO_001_WATCHLIST_TEST_FIX.md](LEARNINGS_TODO_001_WATCHLIST_TEST_FIX.md)** - Redis mock discovery
- **[vitest.config.ts](../vitest.config.ts)** - Test configuration

---

---

## E2E Testing with Playwright (2025 Best Practices)

**Added:** 2025-12-11
**Source:** Industry research + Playwright official docs + project experience

This section covers end-to-end testing patterns with Playwright based on 2025 industry standards.

### Table of Contents: E2E Testing

1. [User Story-Driven Development](#user-story-driven-e2e-tests)
2. [Feature Object Model (Modern POM)](#feature-object-model-modern-pom)
3. [Modal Interactions and Dynamic Content](#modal-interactions-and-dynamic-content-patterns) (Phase 1.1)
4. [CSRF Token Patterns](#e2e-csrf-token-patterns) (NEW - Phase 1.2)
5. [Accessibility Testing (Axe)](#e2e-accessibility-testing-axe-new---2025-12-15) (NEW - 2025-12-15)
6. [Type Safety - Playwright Types](#e2e-type-safety---playwright-type-imports-new---2025-12-12) (NEW - 2025-12-12)
7. [Test Documentation Patterns](#e2e-test-documentation-patterns-new---2025-12-22) (NEW - 2025-12-22)
8. [Test-Driven E2E Development](#test-driven-e2e-development-with-skipped-tests-new---2025-12-22) (NEW - 2025-12-22)
9. [Test Organization](#e2e-test-organization)
10. [Authentication State Reuse](#authentication-state-reuse)
11. [WebSocket Testing](#websocket-testing)
12. [Database Management](#e2e-database-management)
13. [Environment-Specific Configuration](#e2e-environment-specific-configuration-patterns-new---2025-12-26) (NEW - 2025-12-26)
14. [CI/CD Configuration](#e2e-cicd-configuration)
15. [Visual Regression Testing (Screenshots)](#visual-regression-testing-screenshots)
16. [Flaky Test Prevention](#e2e-flaky-test-prevention)
17. [Debugging](#e2e-debugging)
18. [Verification-First Methodology](#verification-first-methodology-new---2025-12-22) (NEW - 2025-12-22)
19. [Component Discovery Patterns](#component-discovery-patterns-new---2025-12-22) (NEW - 2025-12-22)

---

### User Story-Driven E2E Tests

**BEST PRACTICE**: Organize E2E tests around user stories using Given-When-Then structure.

#### ✅ CORRECT - User Story Focus

```typescript
// e2e/specs/price-alerts.spec.ts
test.describe('As a shopper, I want to track price drops', () => {
  test('should notify me when my watched product drops below target price', async ({ page }) => {
    // GIVEN I am logged in
    await auth.registerNewUser();

    // AND I have a price alert set for $500
    await page.goto(`/products/${testProduct.id}`);
    await page.getByRole('button', { name: 'Set Price Alert' }).click();
    await page.getByLabel('Target Price').fill('500');
    await page.getByRole('button', { name: 'Create Alert' }).click();

    // WHEN the price drops to $450
    await simulatePriceUpdate(testProduct.id, 450);

    // THEN I should receive a notification
    await expect(page.getByTestId('notification')).toContainText('Price dropped to $450');
  });
});
```

#### ❌ WRONG - Technical Feature Focus

```typescript
test.describe('Price Alert API', () => {
  test('should return 201 on alert creation', async ({ page }) => {
    // Too focused on HTTP status codes, not user value
  });
});
```

**Test Naming Convention**:
- ✅ "should allow authenticated users to add products to watchlist"
- ✅ "should prevent duplicate product alerts for the same user"
- ❌ "validateCreateAlertEndpoint"
- ❌ "alert creation"

---

### Feature Object Model (Modern POM)

**BEST PRACTICE**: Use Feature Objects instead of traditional Page Objects for better maintainability.

**Why Feature Objects?**
- Focus on user-oriented features, not page structure
- More resilient to UI changes
- Better encapsulation of business logic
- Easier to reuse across tests

#### Structure

```
e2e/
├── features/               # Feature objects (business logic)
│   ├── authentication.feature.ts
│   ├── product-search.feature.ts
│   ├── price-alerts.feature.ts
│   └── watchlist.feature.ts
├── components/            # Reusable UI components
│   ├── product-card.component.ts
│   ├── navigation.component.ts
│   └── notification.component.ts
├── fixtures/              # Playwright fixtures
│   ├── auth.fixture.ts
│   ├── database.fixture.ts
│   └── index.ts
├── helpers/               # Utility functions
│   ├── test-data.helpers.ts
│   └── api.helpers.ts
└── specs/                 # Test specifications
    ├── auth.spec.ts
    ├── price-alerts.spec.ts
    └── watchlist.spec.ts
```

#### Example: Authentication Feature Object

```typescript
// e2e/features/authentication.feature.ts
import { type Page } from '@playwright/test';

export class AuthenticationFeature {
  constructor(private page: Page) {}

  /**
   * Register a new user through the UI
   */
  async registerNewUser(options?: {
    username?: string;
    email?: string;
    password?: string;
  }) {
    const username = options?.username ?? generateTestUsername();
    const email = options?.email ?? generateTestEmail();
    const password = options?.password ?? 'SecurePass123!';

    // PriceCompare uses modal-based authentication (no /login or /register routes)
    await this.page.goto('/price-watch');
    await this.page.waitForLoadState('networkidle');

    // Open auth modal (multiple nav instances may exist)
    await this.page.getByRole('button', { name: /sign up/i }).first().click();

    await this.page.getByLabel(/username/i).fill(username);
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByLabel(/^password$/i).first().fill(password);
    await this.page.getByLabel(/confirm.*password/i).fill(password);
    await this.page.getByRole('button', { name: /create account/i }).click();

    // Auth state confirmation
    await this.page.getByTestId('user-menu-button').first().waitFor({
      state: 'visible',
      timeout: 10000,
    });

    return { username, email, password };
  }

  async login(email: string, password: string) {
    await this.page.goto('/price-watch');
    await this.page.waitForLoadState('networkidle');

    await this.page.getByRole('button', { name: /sign in/i }).first().click();
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByLabel(/^password$/i).first().fill(password);
    await this.page.getByRole('button', { name: /^sign in$/i }).click();

    await this.page.getByTestId('user-menu-button').first().waitFor({
      state: 'visible',
      timeout: 10000,
    });
  }

  async isAuthenticated(): Promise<boolean> {
    const userMenu = this.page.getByTestId('user-menu-button').first();
    return await userMenu.isVisible();
  }
}

// Usage in test
test('should maintain session across navigation', async ({ page }) => {
  const auth = new AuthenticationFeature(page);

  await auth.registerNewUser();
  expect(await auth.isAuthenticated()).toBe(true);

  await page.goto('/products');
  expect(await auth.isAuthenticated()).toBe(true);
});
```

#### Locator Strategy (Priority Order)

1. **Role-based** - `getByRole()` for semantic HTML (BEST)
2. **Test IDs** - `getByTestId()` for stable selectors
3. **Labels** - `getByLabel()` for form inputs
4. **Text** - `getByText()` for buttons/links
5. **Progressive DOM Scoping** - For ambiguous text (when above not available)
6. **CSS/XPath** - Last resort only (AVOID)

```typescript
// ✅ EXCELLENT - Role-based (most resilient)
await page.getByRole('button', { name: 'Add to Cart' }).click();

// ✅ GOOD - Test ID (stable, explicit)
await page.getByTestId('checkout-button').click();

// ✅ GOOD - Label-based (accessible)
await page.getByLabel('Email address').fill('user@example.com');

// ✅ GOOD - Progressive DOM scoping (when data-testid unavailable)
const section = page.locator('text=/section-title/i').locator('..');
const value = section.locator('text=/\\$[0-9]+/');

// ❌ AVOID - CSS classes (brittle)
await page.locator('.btn-primary.btn-lg').click();
```

---

### Progressive DOM Scoping for Ambiguous Selectors (NEW - 2025-12-14)

**Source**: Price Analytics E2E test debugging session
**Reference**: `docs/LEARNINGS_CODE_REVIEW_ASYNC_ONCLICK_DEBUGGING.md`

When text appears in multiple locations on a page, simple text-based selectors will match the wrong element. Use progressive DOM scoping to narrow down to the correct element.

#### The Problem: Selector Ambiguity

```typescript
// Page structure:
// - Buy Recommendation: "This is one of the LOWEST prices ever..."
// - Historical Facts section:
//   - Lowest Price: $99.99
//   - Highest Price: $1100.00

// ❌ WRONG - Page-level search matches wrong element
const minPriceLabel = page.locator('text=/lowest.*price/i');
// Error: Matches "lowest prices" in recommendation text, NOT the price value!
```

#### The Solution: Three-Level Progressive DOM Scoping

```typescript
// ✅ CORRECT - Progressive DOM scoping pattern

// Level 1: Scope to section (eliminate irrelevant areas)
const historicalFacts = page.locator('text=/historical.*facts/i').locator('..');

// Level 2: Find the specific row/container
const minPriceRow = historicalFacts.locator('text=/lowest.*price/i').locator('..');

// Level 3: Extract the target value from within the row
const minPriceLabel = minPriceRow.locator('text=/\\$[0-9,]+\\.?[0-9]*/');

// Now minPriceLabel correctly targets "$99.99" within the Lowest Price row
```

#### DOM Traversal Visualization

```
Page
|-- Price Insights Widget
    |-- Buy Recommendation Section (contains "lowest" text - SKIP)
    |-- Historical Facts Section <-- Level 1: Scope here
        |-- Lowest Price Row <-- Level 2: Navigate to row
        |   |-- Label: "Lowest Price"
        |   |-- Value: "$99.99" <-- Level 3: Extract value
        |-- Highest Price Row
            |-- Label: "Highest Price"
            |-- Value: "$1100.00"
```

#### Key Techniques

**1. Parent Locator Navigation**

`.locator('..')` moves up one DOM level to the parent element:

```typescript
// Find "Historical Facts" heading, then get its parent container
const section = page.locator('text=/historical.*facts/i').locator('..');
```

**2. Regex Escaping for Dollar Signs**

Dollar sign (`$`) is a regex meta-character. Escape it with double backslash:

```typescript
// ❌ WRONG - Unescaped dollar sign (regex anchor)
.locator('text=/$[0-9]+/')

// ✅ CORRECT - Escaped dollar sign (literal character)
.locator('text=/\\$[0-9]+/')
```

**3. Progressive Narrowing Pattern**

Start broad, narrow down step by step:

```typescript
const section = page.locator('text=/section-title/i').locator('..');
const row = section.locator('text=/row-label/i').locator('..');
const value = row.locator('text=/value-pattern/');
```

#### When to Apply This Pattern

- Text appears in multiple locations (e.g., "price", "lowest", "active")
- Elements lack unique `data-testid` attributes
- Selector matching wrong element in test failures
- Screenshot reveals ambiguous DOM structure

#### Anti-Patterns to Avoid

```typescript
// ❌ Page-level text search for common words
const price = page.locator('text=/price/i');

// ❌ Unescaped regex meta-characters
const amount = page.locator('text=/$99.99/');

// ❌ Single-level selector for ambiguous text
const status = page.locator('text=/active/i');
```

#### Debugging Workflow for Selector Failures

1. **Analyze error message**: What was matched vs. what was expected?
2. **View test screenshot**: Understand the actual DOM structure
3. **Identify ambiguous text**: Where else does this text appear?
4. **Apply progressive scoping**: Section -> Row -> Value
5. **Verify fix**: Run the test to confirm

#### Example: Price Analytics Test Fix

**Before (Failing)**:
```typescript
// Test expected "$99.99" but got "This is one of the lowest prices..."
const minPriceLabel = page.locator('text=/lowest.*price/i');
```

**After (Fixed)**:
```typescript
// Properly scoped to Historical Facts section
const historicalFacts = page.locator('text=/historical.*facts/i').locator('..');
const minPriceRow = historicalFacts.locator('text=/lowest.*price/i').locator('..');
const minPriceLabel = minPriceRow.locator('text=/\\$[0-9,]+\\.?[0-9]*/');
```

#### Selector Ambiguity Checklist

Before committing E2E tests with text selectors:

- [ ] Text selectors scoped to specific container (not page-level)
- [ ] Regex meta-characters properly escaped (`\\$` for dollar sign)
- [ ] `data-testid` considered for critical test elements
- [ ] Parent navigation (`.locator('..')`) used when needed
- [ ] Test screenshots reviewed to understand actual DOM structure

**Reference Implementation**: `e2e/price-analytics.spec.ts` (lines 175-211)

---

### Modal Interactions and Dynamic Content Patterns

**Source**: Phase 1.1 Admin Dashboard Tests (2025-12-11)
**Reference**: `docs/LEARNINGS_E2E_PHASE_1_1_ADMIN_TESTS.md`

This section covers patterns for interacting with modals, tabs, and other dynamic UI elements that require careful timing to avoid race conditions.

#### Modal Authentication Pattern

**CRITICAL**: Authentication is implemented as a modal dialog, NOT a dedicated route. The `/login` route does not exist and returns 404.

**5-Step Modal Interaction Template**:

```typescript
// e2e/helpers.ts - loginUser() example
export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  // 1. Navigate to page with navigation component (that has Sign In button)
  await page.goto('/price-watch');
  await page.waitForLoadState('networkidle');

  // 2. Open modal by clicking trigger button
  // Use .first() because there may be multiple Sign In buttons (desktop/mobile)
  await page.getByRole('button', { name: /sign in/i }).first().click();

  // 3. Wait for modal to be visible
  await page.waitForSelector('input#email', { state: 'visible', timeout: 5000 });

  // 4. Fill form and submit
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).first().fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // 5. Wait for success indicator (user menu appears)
  await page.getByTestId('user-menu-button').first().waitFor({
    state: 'visible',
    timeout: 10000
  });
}
```

**Key Points**:
- **Navigate to existing page** with the trigger element (NOT directly to modal route)
- **Wait for modal visibility** before interacting
- **Use label-based selectors** (not CSS selectors) for form fields
- **Wait for success state** (UI change, not API response)
- **Use `.first()`** when multiple navigation instances exist (desktop/mobile)

**Common Mistake**:
```typescript
// ❌ WRONG - /login route doesn't exist
await page.goto('/login'); // 404 error!

// ✅ CORRECT - Modal pattern
await page.goto('/price-watch');
await page.getByRole('button', { name: /sign in/i }).first().click();
```

#### Tab Navigation with Explicit Waits

**Problem**: Clicking a tab without waiting for content creates race conditions where assertions run before content loads.

**Pattern**:

```typescript
// ❌ RISKY - No explicit wait after tab click
await page.getByRole('tab', { name: /retailers/i }).click();
await expect(page.getByText(/amazon|best buy|walmart/i).first()).toBeVisible({
  timeout: 5000
});

// ✅ ROBUST - Explicit wait for content to load
await page.getByRole('tab', { name: /retailers/i }).click();

// Wait for tab content to load before verification
await page.getByText(/amazon|best buy|walmart/i).first().waitFor({
  state: 'visible',
  timeout: 5000
});

// Then verify (will pass immediately since we already waited)
await expect(page.getByText(/amazon|best buy|walmart/i).first()).toBeVisible({
  timeout: 5000
});
```

**Why This Matters**:
- Tab clicks trigger React state changes
- Content loads asynchronously
- Without explicit waits, test may check before content appears
- `waitFor()` ensures content is loaded before assertions run

#### Explicit Waits for Dynamic Content

**Rule**: After ANY navigation action (tab clicks, route changes, modal opens), explicitly wait for expected content before assertions.

**Navigation Action Examples**:
- Tab clicks
- Route changes
- Modal opens
- Dropdown selections
- Accordion expansions

**Pattern**:
```typescript
// After navigation action
await page.getByRole('tab', { name: /products/i }).click();

// Explicitly wait for expected content
await page.getByText(/bulk product/i).first().waitFor({
  state: 'visible',
  timeout: 5000
});

// Then perform assertions
await expect(page.getByText(/bulk product/i).first()).toBeVisible();
```

#### Playwright Selector Hierarchy (Recap)

**Priority Order** (most resilient → most brittle):

1. **Role-based** (`getByRole('button')`) - Most semantic, resilient to UI changes
2. **Label-based** (`getByLabel('Email')`) - Good for forms with proper a11y labels
3. **Test ID** (`getByTestId('user-menu')`) - Explicit test contracts
4. **Text** (`getByText('Sign In')`) - Fragile to copy changes
5. **CSS** (`fill('input#email')`) - Most brittle, avoid unless necessary

**Benefits of Label-Based Selectors**:
- Verifies proper accessibility labels exist
- More resilient to HTML structure changes
- Provides better test coverage (functionality + accessibility)

```typescript
// ❌ LOW PRIORITY - CSS selectors
await page.fill('input#email', email);
await page.fill('input#password', password);

// ✅ HIGH PRIORITY - Label-based selectors
await page.getByLabel(/email/i).fill(email);
await page.getByLabel(/^password$/i).first().fill(password);
```

#### Test Helper Consistency

**CRITICAL**: All helpers performing similar operations should use the same patterns.

```typescript
// ✅ GOOD - Consistent patterns across auth helpers
registerUser()    → modal pattern + getByLabel()
createAdminUser() → modal pattern + getByLabel()
loginUser()       → modal pattern + getByLabel()

// ❌ BAD - Inconsistent patterns
registerUser()    → modal pattern + getByLabel()
createAdminUser() → modal pattern + getByLabel()
loginUser()       → route pattern + CSS selectors  // INCONSISTENT!
```

**Benefits of Consistency**:
- Easier to maintain (change pattern once, apply everywhere)
- Easier to debug (familiar patterns)
- Better test coverage (same verification approach)
- Lower cognitive load for developers

#### Test Race Conditions - API vs UI Verification

**Problem**: Waiting for API responses that complete before the test starts listening causes timeouts.

**Why API Waiting Fails**:
1. `page.goto('/admin')` triggers React to load component
2. React Query immediately fetches `/api/admin/analytics/overview`
3. `waitForLoadState('networkidle')` waits for network to go idle
4. API response might complete during step 3
5. `waitForApiResponse()` starts listening AFTER response already arrived
6. Test times out waiting for response that will never come again

```typescript
// ❌ FLAKY - Waiting for API response
test('should display analytics overview', async ({ page }) => {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');

  // RACE CONDITION: API call might complete during page load
  await waitForApiResponse(page, '/api/admin/analytics/overview', 200);

  // Assertions might fail if API completed too quickly
});

// ✅ ROBUST - Waiting for UI state changes
test('should display analytics overview', async ({ page }) => {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');

  // Wait for UI state changes, not API responses
  await expect(page.getByText(/Administration Panel/i)).toBeVisible();
  await expect(page.getByText(/Total Users|Users/i).first()).toBeVisible();
  await expect(page.getByText(/Products/i).first()).toBeVisible();
});
```

**Rule**: UI interaction tests should wait for UI state changes, not API responses. API response waiting is only appropriate for API-focused tests (not UI workflow tests).

#### Modal and Dynamic Content Checklist

Before writing/modifying E2E tests with modals or dynamic content:

- [ ] Helper functions use modal pattern when applicable (not route-based)
- [ ] Selectors follow priority: role → label → testid → text → CSS
- [ ] Explicit waits after navigation actions (tabs, routes, modals)
- [ ] UI state verification (not API response waiting)
- [ ] Helper consistency (same operations = same patterns)
- [ ] `.first()` used when multiple elements expected (desktop/mobile navs)
- [ ] Appropriate timeouts (5s for UI, 10s for auth state)

**Detailed Examples**: See `docs/LEARNINGS_E2E_PHASE_1_1_ADMIN_TESTS.md` for:
- Complete modal authentication flow with code examples
- Tab navigation timing strategies
- React hooks compliance in tested components
- Reusable pattern templates

---

### E2E Accessibility Testing (Axe) (NEW - 2025-12-15)

**Reference implementation**: `e2e/accessibility.spec.ts`

**Goals:**
- Catch WCAG A/AA regressions early.
- Treat failures as product bugs (fix UI instead of weakening checks).

#### Dependencies

- `@axe-core/playwright` (dev dependency)

#### Pattern: Scoped scans + WCAG tags

Scope scans to the relevant subtree to reduce noise/flakiness.

```typescript
import AxeBuilder from '@axe-core/playwright';

async function runA11yScan(page: Page, options?: { include?: string | ElementHandle<HTMLElement> }) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
  const results = options?.include ? await builder.include(options.include).analyze() : await builder.analyze();
  expect(results.violations).toEqual([]);
}

// ✅ Page-level: scan main content only
await page.goto('/some-page');
await runA11yScan(page, { include: 'main' });

// ✅ Modal-level: scan dialog subtree only
const dialog = page.getByRole('dialog');
const dialogHandle = await dialog.elementHandle();
if (!dialogHandle) throw new Error('Expected dialog element handle');
await runA11yScan(page, { include: dialogHandle });
```

#### Pattern: Ignore transient overlays (without weakening WCAG)

Some ephemeral UI (e.g. connection banners) can introduce noisy violations unrelated to the tested flow.

```typescript
const connectionStatus = page.getByTestId('connection-status');
if (await connectionStatus.isVisible()) {
  await connectionStatus.evaluate((el) => {
    // Prefer non-layout-impact hiding to reduce flakiness.
    (el as HTMLElement).style.visibility = 'hidden';
  });
}
```

#### Pattern: Deterministic toast/live-region scans (Radix Toast)

Toast UI can be transient and hard to target. Prefer triggering a toast via a deterministic validation error (no auth/network dependencies), then scan only the toast subtree.

```typescript
// 1) Trigger a toast deterministically (example: click Add without selecting required fields)
await page.getByRole('button', { name: /add to watchlist/i }).click();
await page.getByRole('dialog', { name: /add to watchlist/i }).waitFor({ state: 'visible' });
await page.getByRole('button', { name: /^add$/i }).click();
await page.getByText(/please select a watchlist/i).waitFor({ state: 'visible' });

// 2) Scan the toast viewport (Radix)
const hasViewport = (await page.locator('[data-radix-toast-viewport]').count()) > 0;
const include = hasViewport ? '[data-radix-toast-viewport]' : '[role="status"], [role="alert"]';
await runA11yScan(page, { include });
```

**Rule**: Icon-only toast controls must have accessible names (e.g. toast close button needs an `aria-label`).

#### Pattern: Focus containment (modal trap) assertion

For portal-based dialogs, assert focus remains inside the dialog while tabbing.

```typescript
const dialog = page.getByRole('dialog');
const dialogHandle = await dialog.elementHandle();
if (!dialogHandle) throw new Error('Expected dialog element handle');

for (let i = 0; i < 10; i++) {
  await page.keyboard.press('Tab');
  const isFocusInsideDialog = await page.evaluate((el) => {
    const active = document.activeElement;
    return !!active && el.contains(active);
  }, dialogHandle);
  expect(isFocusInsideDialog).toBe(true);
}
```

**Rule:** If this fails, fix the dialog / focus management.

---

### E2E Type Safety - Playwright Type Imports (NEW - 2025-12-12)

**Source**: Code review session - Type safety violations in E2E test helper functions

**CRITICAL**: E2E test files must use proper Playwright types for all page/context/browser parameters. Using `any` types defeats TypeScript's purpose and removes IDE autocomplete.

#### The Problem: `page: any` in Helper Functions

When writing helper functions for E2E tests, developers sometimes use `any` type for Playwright's Page object, losing all type safety benefits:

```typescript
// e2e/helpers.ts - WRONG
async function loginUser(page: any, email: string, password: string): Promise<void> {
  await page.goto('/login');           // No autocomplete
  await page.fill('input#email');      // Typos not caught at compile time
  await page.clck('button');           // 'clck' typo NOT detected!
}

// Even in test files, no exceptions for 'any'
export async function waitForElement(page: any): Promise<void> {
  await page.waitForSelector('.item');  // No IDE support
}
```

**Problems with `any`**:
1. No IDE autocomplete for Playwright's extensive API
2. Typos in method names (e.g., `clck` vs `click`) not caught at compile time
3. Wrong argument types not detected
4. Violates project's zero-tolerance `any` policy
5. Pre-commit hook will flag this as a blocker

#### The Solution: Import and Use Playwright Types

```typescript
// e2e/helpers.ts - CORRECT
import { type Page, type BrowserContext, type Browser } from '@playwright/test';

// Helper functions with proper typing
export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  // PriceCompare uses modal-based authentication (no /login route)
  await page.goto('/price-watch');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).first().fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Full autocomplete, typos caught at compile time
  await page.getByTestId('user-menu-button').first().waitFor({ state: 'visible', timeout: 10000 });
}

// BrowserContext for multi-page scenarios
export async function setupAuthenticatedContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  // ... setup auth state
  return context;
}

// Page parameter in test helpers
export async function waitForApiResponse(
  page: Page,
  urlPattern: string,
  expectedStatus: number
): Promise<void> {
  await page.waitForResponse(
    (response) => response.url().includes(urlPattern) && response.status() === expectedStatus
  );
}
```

#### Common Playwright Types Reference

| Type | Use Case | Import |
|------|----------|--------|
| `Page` | Single browser tab/page interactions | `import { type Page } from '@playwright/test'` |
| `BrowserContext` | Multi-page scenarios, auth state | `import { type BrowserContext } from '@playwright/test'` |
| `Browser` | Browser instance management | `import { type Browser } from '@playwright/test'` |
| `Locator` | Element references | `import { type Locator } from '@playwright/test'` |
| `Response` | Network response handling | `import { type Response } from '@playwright/test'` |
| `Request` | Network request handling | `import { type Request } from '@playwright/test'` |

#### Detection Rule

Add to code review checklist:

```bash
# Find 'page: any' patterns in E2E test files
grep -rn "page:\s*any" e2e/ --include="*.ts"
grep -rn "browser:\s*any" e2e/ --include="*.ts"
grep -rn "context:\s*any" e2e/ --include="*.ts"

# Should return no results if types are properly used
```

#### Migration Pattern

When fixing existing `any` types in E2E tests:

```typescript
// Before (file: e2e/helpers.ts)
export async function registerUser(page: any, userData: UserData) {
  // ... implementation
}

// After - Step 1: Add import at top of file
import { type Page } from '@playwright/test';

// After - Step 2: Replace any with proper type
export async function registerUser(page: Page, userData: UserData) {
  // ... implementation unchanged, but now type-safe
}
```

#### E2E Type Safety Checklist

Before committing E2E test files:

- [ ] All `page` parameters use `Page` type, not `any`
- [ ] All `browser` parameters use `Browser` type
- [ ] All `context` parameters use `BrowserContext` type
- [ ] Import statement includes `type` keyword for type-only imports
- [ ] No `@ts-ignore` or `@ts-expect-error` to bypass type errors

**Reference**: This pattern was identified during code review of `e2e/watchlist.spec.ts` (lines 364, 383) where helper functions used `page: any` instead of proper Playwright types.

---

### E2E Test Organization

#### Playwright Fixtures (Modern Setup/Teardown)

**BEST PRACTICE**: Use fixtures instead of `beforeEach`/`afterEach` for better composition.

```typescript
// e2e/fixtures/index.ts
import { test as base } from '@playwright/test';
import { AuthenticationFeature } from '../features/authentication.feature';
import { cleanDatabase, seedTestData } from '../helpers/database.helpers';

type TestFixtures = {
  auth: AuthenticationFeature;
  authenticatedUser: { username: string; email: string; password: string };
  testProduct: { id: number; name: string; price: number };
};

export const test = base.extend<TestFixtures>({
  // Clean database before each test
  page: async ({ page }, use) => {
    await cleanDatabase();
    await use(page);
  },

  // Authentication feature fixture
  auth: async ({ page }, use) => {
    await use(new AuthenticationFeature(page));
  },

  // Authenticated user fixture
  authenticatedUser: async ({ auth }, use) => {
    const user = await auth.registerNewUser();
    await use(user);
  },

  // Test product fixture
  testProduct: async ({}, use) => {
    const product = await seedTestData.createProduct({
      name: 'Test Laptop',
      price: 999.99,
    });
    await use(product);
  },
});

export { expect } from '@playwright/test';

// Usage in tests
test('should add product to watchlist', async ({
  page,
  authenticatedUser,  // Automatically logged in
  testProduct         // Automatically created
}) => {
  await page.goto(`/products/${testProduct.id}`);
  await page.getByRole('button', { name: 'Add to Watchlist' }).click();

  await expect(page.getByText('Added to watchlist')).toBeVisible();
});
```

#### Test Isolation (CRITICAL)

**MANDATORY**: Each test MUST be completely isolated and runnable in any order.

```typescript
// ✅ CORRECT - Fully isolated
test('should create price alert', async ({ page }) => {
  // Setup: Create own test data
  const user = await createTestUser();
  const product = await createTestProduct();

  // Test: Perform action
  await login(page, user);
  await createPriceAlert(page, product.id, 500);

  // Assert: Verify outcome
  await expect(page.getByText('Alert created')).toBeVisible();
});

// ❌ WRONG - Depends on other tests
test.describe('Price Alerts', () => {
  let userId: number;

  test('should create user', async () => {
    userId = await createUser(); // Shared state!
  });

  test('should create alert', async ({ page }) => {
    // BROKEN: Assumes previous test ran
    await createAlert(userId);
  });
});
```

---

### Authentication State Reuse

**BEST PRACTICE**: Login once in setup, save auth state, reuse across tests (60-80% faster).

#### Global Setup

```typescript
// e2e/global-setup.ts
import { chromium } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Register or login
  await page.goto('http://localhost:5001/price-watch');
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/^password$/i).first().fill('TestPass123!');
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Wait for authentication
  await page.getByTestId('user-menu-button').first().waitFor({ state: 'visible', timeout: 10000 });

  // Save authentication state
  await page.context().storageState({ path: authFile });

  await browser.close();
}
```

#### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',

  use: {
    // Reuse auth state across all tests
    storageState: './e2e/.auth/user.json',
  },
});
```

#### Multiple User Roles

```typescript
// e2e/fixtures/multi-role-auth.fixture.ts
const regularUserAuth = './e2e/.auth/regular-user.json';
const adminUserAuth = './e2e/.auth/admin-user.json';

export const test = base.extend<{
  regularUserPage: Page;
  adminUserPage: Page;
}>({
  regularUserPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: regularUserAuth });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  adminUserPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: adminUserAuth });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

// Usage
test('admin can delete user, regular user cannot', async ({
  regularUserPage,
  adminUserPage
}) => {
  await regularUserPage.goto('/admin/users');
  await expect(regularUserPage.getByText('Access Denied')).toBeVisible();

  await adminUserPage.goto('/admin/users');
  await adminUserPage.getByRole('button', { name: 'Delete User' }).click();
  await expect(adminUserPage.getByText('User deleted')).toBeVisible();
});
```

---

### WebSocket Testing

**BEST PRACTICE**: Use Playwright's built-in WebSocket inspection for real-time features.

```typescript
// e2e/helpers/websocket.helpers.ts
export async function captureWebSocketMessages(
  page: Page,
  eventType?: string
): Promise<unknown[]> {
  const messages: unknown[] = [];

  page.on('websocket', ws => {
    ws.on('framereceived', event => {
      try {
        const data = JSON.parse(event.payload as string);

        if (!eventType || data.type === eventType) {
          messages.push(data);
        }
      } catch {
        messages.push(event.payload);
      }
    });
  });

  return messages;
}

// Usage: Test real-time notifications
test('should receive WebSocket notification when price drops', async ({ page }) => {
  const messages = await captureWebSocketMessages(page, 'price-drop');

  await page.goto('/products/123');
  await page.getByRole('button', { name: 'Set Price Alert' }).click();
  await page.getByLabel('Target Price').fill('500');
  await page.getByRole('button', { name: 'Create Alert' }).click();

  // Trigger price drop via API
  await simulatePriceUpdate(123, 450);

  // Wait for WebSocket message
  await page.waitForTimeout(2000);

  const priceDropMessage = messages.find(
    (msg: any) => msg.type === 'price-drop' && msg.productId === 123
  );

  expect(priceDropMessage).toBeDefined();
  expect(priceDropMessage.newPrice).toBe(450);
});
```

---

### E2E Database Management

#### Pattern: Opt-in Fixtures + Auto DB Cleanup (PriceCompare)

PriceCompare supports an opt-in fixtures layer to reduce boilerplate while keeping the default DB-safe execution model.

- Import via the barrel: `import { test, expect } from './fixtures'` (from `e2e/fixtures.ts`)
- Use `cleanDb` auto fixture (per-test) instead of calling `cleanDatabase()` manually
- Use `authenticatedPage` / `adminPage` fixtures where helpful

**Reference**:
- `e2e/fixtures/index.ts`
- Migrated suites: `e2e/accessibility.spec.ts`, `e2e/admin.spec.ts`, `e2e/price-analytics.spec.ts`

**Rule**: Only migrate stable suites. After migration, run the single spec file end-to-end (not the whole suite) and revert the migration if failures are unrelated to setup/teardown.

#### Transaction Rollback (FASTEST)

**BEST PRACTICE**: Use database transactions with automatic rollback for instant cleanup.

```typescript
// e2e/helpers/database.helpers.ts
import { db } from '../../server/db';
import { sql } from 'drizzle-orm';

export async function beginTransaction() {
  await db.execute(sql`BEGIN`);
}

export async function rollbackTransaction() {
  await db.execute(sql`ROLLBACK`);
}

// Fixture integration
export const test = base.extend({
  page: async ({ page }, use) => {
    await beginTransaction();
    await use(page);
    await rollbackTransaction();
  },
});
```

**Advantages**:
- Instant cleanup (no DELETE queries)
- Handles complex relationships automatically
- 10-100x faster than manual cleanup

#### TRUNCATE CASCADE (Alternative)

```typescript
export async function cleanDatabase() {
  await db.execute(sql`
    TRUNCATE TABLE
      users,
      products,
      product_offers,
      price_alerts,
      notifications
    RESTART IDENTITY CASCADE
  `);
}
```

**Use when**: Testing transaction boundaries or multi-connection scenarios.

---

#### Bulk Database Helpers for E2E Tests (NEW - Feature 3.3)

**When to Use:** When E2E tests need many database records to test edge cases (limits, pagination) but don't need to test the creation flow itself.

**Context:** E2E tests typically create data through the UI to test full user flows. However, testing edge cases like "user has 49/50 alerts" requires creating many records, which is slow through the UI. Bulk database helpers bypass UI/API layers for fast test setup while keeping the actual test focused on the user story.

**Pattern:** Create feature-specific bulk helpers in `e2e/helpers/` that use direct database insertion.

```typescript
// e2e/helpers/alert-helpers.ts
import { db } from '../../server/db';
import { priceAlerts } from '../../shared/schema';

/**
 * Bulk create price alerts via direct database insertion (fast)
 *
 * Use this for tests that need many alerts without testing the creation flow itself.
 * Bypasses UI and API layers for speed.
 *
 * @param userId - User ID to create alerts for
 * @param productId - Product ID for all alerts
 * @param count - Number of alerts to create
 * @param startingPrice - Base price (each alert increments by $1)
 *
 * @example
 * // Test: User cannot create alert when at limit (50/50)
 * await bulkCreateAlerts(1, 123, 49, 100); // Create 49 alerts
 * // Now test creating 50th alert via UI (should hit limit)
 */
export async function bulkCreateAlerts(
  userId: number,
  productId: number,
  count: number,
  startingPrice: number = 100
): Promise<void> {
  const alertsToCreate = Array.from({ length: count }, (_, i) => ({
    userId,
    productId,
    targetPrice: (startingPrice + i).toFixed(2),
    isActive: true,
  }));

  // Insert all alerts in a single transaction for speed
  await db.insert(priceAlerts).values(alertsToCreate);
}
```

**Usage in E2E Tests:**

```typescript
// e2e/price-alerts.spec.ts
import { test, expect } from './fixtures';
import { bulkCreateAlerts } from './helpers/alert-helpers';

test('should prevent creating alert when at limit (50/50)', async ({ authenticatedPage }) => {
  const { page, user, product } = authenticatedPage;

  // SETUP: Create 49 alerts via database (fast, not part of test)
  await bulkCreateAlerts(user.id, product.id, 49);

  // TEST: Try to create 50th alert via UI (this is what we're testing)
  await page.goto(`/product/${product.id}`);
  await page.click('[data-testid="create-alert-button"]');
  await page.fill('#target-price', '99.99');
  await page.click('button:has-text("Create Alert")');

  // VERIFY: User sees limit error
  await expect(page.locator('text=/alert limit reached/i')).toBeVisible();
});
```

**Key Points:**

1. **Speed**: 49 database inserts in <100ms vs 49 UI interactions in ~30 seconds
2. **Focus**: Test stays focused on the user story (creating 50th alert)
3. **Clarity**: JSDoc explains when to use vs when to use UI creation
4. **Isolation**: Each test still gets clean database via fixtures
5. **Transaction Safety**: Single `db.insert()` call is atomic

**When NOT to Use:**

- ❌ Testing the alert creation flow itself (use UI)
- ❌ Testing validation logic (use API/unit tests)
- ❌ Testing user-visible creation success messages (use UI)
- ✅ Testing limits, edge cases, bulk operations

**Benefits:**

- **Test Speed**: Reduces 30s setup to <1s
- **Test Maintainability**: Changing alert creation UI doesn't break limit tests
- **Test Clarity**: Test name matches test content (limit enforcement, not creation)

**Additional Example - Watchlist Products (Feature 4.3):**

```typescript
// e2e/helpers/watchlist-helpers.ts
import { db } from '../../server/db';
import { productWatches } from '../../shared/schema';

/**
 * Bulk add products to watchlist via direct database insertion (fast)
 *
 * Use this for tests that need watchlist setup without testing the addition flow itself.
 * Bypasses UI and API layers for speed.
 *
 * @param userId - User ID who owns the watchlist
 * @param watchListId - Watchlist ID to add products to
 * @param productIds - Array of product IDs to add
 *
 * @example
 * const { watchListId } = await ensureUserHasWatchlist(1, 'My List');
 * await bulkAddProductsToWatchlist(1, watchListId, [123, 124, 125]);
 */
export async function bulkAddProductsToWatchlist(
  userId: number,
  watchListId: number,
  productIds: number[]
): Promise<void> {
  const productWatchesToCreate = productIds.map((productId) => ({
    userId,
    productId,
    watchListId,
    // Priority defaults to 3 (matches schema default and UI behavior)
    priority: 3,
  }));

  // Insert all product watches in a single transaction for speed
  await db.insert(productWatches).values(productWatchesToCreate).returning();
}
```

**Code Review Learnings (Feature 4.3):**
1. **Always use `.returning()`** after bulk inserts for consistency with other helpers
2. **Document default values** (e.g., priority) - explain why that value matches UI/schema
3. **Single transaction** - batch inserts are atomic without explicit `db.transaction()`

**Performance Comparison:**
- UI-based setup (create watchlist + add 3 products): ~5-7 seconds
- Database helper setup: ~100ms
- **Speedup: 50-70x faster**

**Test Phase Separation Pattern (NEW - Feature 4.3):**

Use comments to clearly separate test phases for maintainability:

```typescript
test('should remove product from watchlist', async ({ page }) => {
  // SETUP PHASE: Use database helpers for speed (100ms vs 5-7s via UI)
  const { product } = await seedTestProduct();
  const { watchListId } = await ensureUserHasWatchlist(user.id, 'My List');
  await bulkAddProductsToWatchlist(user.id, watchListId, [product.id]);

  // TEST PHASE: Verify UI behavior for removal (the actual feature being tested)
  await page.goto('/watchlists');
  await page.getByRole('tab', { name: /my list/i }).click();
  await productCard.getByRole('button', { name: /remove/i }).click();
  await page.getByRole('button', { name: /confirm.*remove/i }).click();

  // VERIFY PHASE: Assert UI reflects the removal
  await expect(page.getByText(/deleted successfully/i).first()).toBeVisible();
  await expect(productCard).not.toBeVisible();
});
```

**Why Phase Separation:**
- **Clarity**: Instantly understand what's setup vs what's being tested
- **Debugging**: Know which phase failed when test breaks
- **Refactoring**: Easy to see which code can be extracted to helpers
- **Code Review**: Reviewers can quickly validate test structure

**Related Patterns:**

- See "Transaction Rollback" for automatic cleanup
- See "E2E Test Organization" for helper file structure
- See "User Story-Driven E2E Tests" for when to use UI vs database setup

---

### E2E Environment-Specific Configuration Patterns (NEW - 2025-12-26)

**Source:** Bundle optimization E2E test investigation (401 errors, missing chunks)

**Context:** Some E2E tests verify production-specific behavior (bundle chunks, code splitting, lazy loading) that doesn't exist in development environments. Testing production optimizations on dev server causes false negatives.

**Problem:** Test environment mismatch - testing production bundle behavior on Vite dev server

**Example Failure:**
```
❌ Test: performance: lazy chunks are actually separate files
   loadedChunks.length = 0 (expected > 1)
   401 Unauthorized errors for /assets/*.js requests
```

#### When Dev Server Tests Fail for Production Features

**The Mismatch:**

| Aspect | Vite Dev Server | Production Server |
|--------|-----------------|-------------------|
| **File Serving** | On-the-fly transformation | Static files from dist/ |
| **JavaScript** | Virtual modules via HMR | Physical chunk files |
| **Asset URLs** | `/@vite/client`, `/src/...` | `/assets/index-*.js` |
| **Code Splitting** | Dynamic imports (no chunks) | Physical chunk files |
| **NODE_ENV** | development, test | production |
| **Middleware** | `setupVite()` | `serveStatic()` |

**Why 401 Errors Occurred:**
```typescript
// server/index.ts:293-297
if (app.get('env') === 'development' || app.get('env') === 'test') {
  await setupVite(app, server);  // ← E2E tests use THIS (dev server)
} else {
  serveStatic(app);  // ← Bundle tests NEED this (static files)
}
```

When bundle tests request `/assets/index-abc123.js`:
1. Vite middleware doesn't match it (no such file exists in dev mode)
2. Request falls through to app routes
3. Route middleware blocks unrecognized request → 401 Unauthorized

#### Pattern: Separate Playwright Configs for Dev vs Production

**✅ CORRECT - Multiple Configs Based on What You're Testing**

```typescript
// playwright.config.ts (DEFAULT - functional tests)
export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/bundle-optimization.spec.ts',  // Exclude production-only tests

  webServer: {
    command: 'npm run dev:test',  // Vite dev server
    url: 'http://localhost:5001',
    timeout: 120000,  // Fast startup
  },
});
```

```typescript
// playwright.bundle.config.ts (PRODUCTION - bundle tests)
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/bundle-optimization.spec.ts',  // ONLY bundle tests

  webServer: {
    // Build production bundle, then start production server
    // NODE_ENV=bundle_test triggers serveStatic() but not Redis requirements
    command: 'npm run build && NODE_ENV=bundle_test DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d= -f2-) SESSION_SECRET=$(grep SESSION_SECRET .env.test | cut -d= -f2-) CSRF_SECRET=$(grep CSRF_SECRET .env.test | cut -d= -f2-) PORT=5002 node dist/index.js',
    url: 'http://localhost:5002',
    reuseExistingServer: false,  // Always rebuild for accurate bundle size tests
    timeout: 180000,  // 3 minutes (build takes longer)
  },
});
```

**Key Decisions:**

1. **`NODE_ENV=bundle_test`** - Not `production` (to avoid Redis requirements), not `test` (to avoid dev server)
2. **`reuseExistingServer: false`** - Always rebuild to verify current bundle size
3. **Longer timeout** - Production builds take 60-120s vs dev server's 5-10s
4. **Separate port** - Avoid conflicts if dev server is running (5001 vs 5002)

#### When to Use Each Config

**Use `npm test:e2e` (default Playwright config):**
- ✅ Functional tests (forms, navigation, auth)
- ✅ UI interaction tests
- ✅ Feature-specific E2E tests
- ✅ Fast feedback (HMR, no build step)
- ✅ Tests that don't depend on production optimizations

**Use `npm run test:e2e:bundle` (bundle config):**
- ✅ Bundle size verification
- ✅ Code splitting verification
- ✅ Lazy loading chunk tests
- ✅ Performance budget enforcement
- ✅ Production behavior validation
- ✅ Tests that verify physical chunk files exist

#### Test File Documentation Pattern

**CRITICAL:** Tests requiring production builds MUST document this in file header

```typescript
/**
 * E2E Tests for Bundle Optimization - Lazy Loading
 *
 * CRITICAL: These tests MUST run against production builds, not dev server.
 * Use: npm run test:e2e:bundle (uses playwright.bundle.config.ts)
 *
 * Why? Bundle tests verify production chunk files at /assets/*.js.
 * The dev server (Vite) doesn't create physical chunks - it serves
 * transformed modules on-the-fly via HMR. Running these tests with
 * `npm test:e2e` (dev server) will fail with 401 errors and 0 chunks.
 *
 * Verifies that lazy-loaded components on the home page work correctly:
 * - Above-the-fold content loads immediately (FCP critical)
 * - Below-the-fold sections lazy load without errors
 * - Modals lazy load when opened
 * - Lazy chunks are separate files (production build verification)
 */

import { test, expect } from '@playwright/test';

test('performance: lazy chunks are actually separate files', async ({ page }) => {
  const loadedChunks: string[] = [];

  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/assets/') && url.endsWith('.js')) {
      loadedChunks.push(url);
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Should have loaded multiple JavaScript chunks
  expect(loadedChunks.length).toBeGreaterThan(1);

  // Verify lazy chunks are separate (not vendor or main bundles)
  const lazyChunks = loadedChunks.filter(
    (url) => !url.includes('vendor-') && !url.includes('index-')
  );
  expect(lazyChunks.length).toBeGreaterThan(0);
});
```

#### Package.json Scripts Pattern

```json
{
  "scripts": {
    "test:e2e": "playwright test",  // Default config (functional tests)
    "test:e2e:bundle": "playwright test --config playwright.bundle.config.ts",  // Production tests
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

#### CI/CD Integration

**GitHub Actions** should run BOTH configs:

```yaml
- name: E2E Tests (Functional)
  run: npm test:e2e

- name: Build Production Bundle
  run: npm run build

- name: E2E Tests (Bundle Optimization)
  run: npm run test:e2e:bundle
```

#### Alternative: Environment Detection in Tests

For more robust tests, add environment detection (optional):

```typescript
test.beforeEach(async ({ page }) => {
  // Detect if running against production build
  const response = await page.goto('/');
  const isProduction = response?.headers()['x-server-mode'] === 'production';

  if (!isProduction) {
    test.skip('This test requires production build. Use: npm run test:e2e:bundle');
  }
});
```

Requires server-side header:
```typescript
// server/index.ts
app.use((req, res, next) => {
  res.setHeader('X-Server-Mode', app.get('env'));
  next();
});
```

#### Anti-Pattern: Testing Production on Dev Server

**❌ WRONG - Single Config for All Tests**

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',  // Includes bundle tests!

  webServer: {
    command: 'npm run dev:test',  // Dev server
  },
});
```

**Problems:**
- Bundle optimization tests fail with 401 errors
- `loadedChunks.length = 0` (no physical chunks in dev mode)
- False negatives - tests fail even when code is correct
- Debugging waste - investigating "broken" code that's actually fine

#### Test Reliability Pattern: Explicit test.skip() for Conditional Tests

**Context:** Modal tests may fail if search button isn't available on page

**❌ WRONG - Silent Skip with if-block**

```typescript
test('modals lazy load when opened', async ({ page }) => {
  await page.goto('/');

  const searchButton = page.locator('[aria-label*="Search"]').first();
  const isSearchButtonAvailable = await searchButton.isVisible({ timeout: 2000 }).catch(() => false);

  // Silent skip - test appears to pass but didn't run!
  if (!isSearchButtonAvailable) {
    return;  // ❌ Test runner thinks test passed
  }

  await searchButton.click();
  // ... rest of test
});
```

**Problems:**
- Test runner reports "passing" when test didn't actually run
- False sense of security (0 failures, but also 0 assertions)
- Hard to detect skipped tests in CI logs

**✅ CORRECT - Explicit test.skip()**

```typescript
test('modals lazy load when opened', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Try to find search button - skip test if not available
  const searchButton = page.locator('[aria-label*="Search"]').first();
  const isSearchButtonAvailable = await searchButton.isVisible({ timeout: 2000 }).catch(() => false);
  if (!isSearchButtonAvailable) {
    test.skip();  // ✅ Explicit skip - test runner marks as skipped
  }

  // Open search modal
  await searchButton.click();
  await page.waitForTimeout(300);

  // Verify modal loaded
  const searchModal = page.locator('[role="dialog"], [aria-modal="true"]').first();
  await expect(searchModal).toBeVisible({ timeout: 2000 });
});
```

**Benefits:**
- Test runner reports `1 skipped` (not `1 passed`)
- CI logs show skipped tests clearly
- Metrics accurately reflect test coverage
- Easy to identify flaky/conditional tests

**Playwright Output:**
```
✓ above-the-fold content loads immediately (2.1s)
✓ below-the-fold sections lazy load correctly (3.4s)
- modals lazy load when opened (skipped)  ← Explicit skip
✓ no layout shift when lazy components load (1.8s)
✓ performance: lazy chunks are actually separate files (2.3s)

5 passed, 1 skipped
```

#### Decision Matrix: When to Use Multiple Configs

| Test Type | Config | Reason |
|-----------|--------|--------|
| **Bundle size verification** | Production | Verifies physical chunk files exist |
| **Code splitting** | Production | Tests dynamic imports create separate chunks |
| **Lazy loading behavior** | Production | Ensures chunks load when components render |
| **Performance budgets** | Production | Validates actual production bundle sizes |
| **Authentication flows** | Development | Fast feedback, no build needed |
| **Form submissions** | Development | UI interactions, not bundle-dependent |
| **Navigation** | Development | Route changes, not optimization-dependent |
| **Modal interactions** | Development | Component behavior, not chunk loading |

#### Key Takeaways

**CRITICAL RULE:** When testing production optimizations (bundle size, code splitting, lazy loading), always test against production builds, not development servers.

**Why this matters:**
- Dev server uses virtual modules (HMR), not physical chunk files
- Asset URLs differ (`/@vite/client` vs `/assets/*.js`)
- Middleware routing differs (`setupVite()` vs `serveStatic()`)
- Code splitting behaves differently (dynamic imports in memory vs disk)

**Related Patterns:**
- See "Lazy Loading for Bundle Size Optimization" in `docs/05_FRONTEND_PATTERNS.md`
- See "Test Documentation Patterns" for header documentation requirements
- See "E2E CI/CD Configuration" for running both configs in GitHub Actions

**Reference:**
- `docs/LEARNINGS_BUNDLE_OPTIMIZATION_E2E_TEST_FIX.md` - Full investigation writeup
- `playwright.bundle.config.ts` - Production E2E configuration
- `e2e/bundle-optimization.spec.ts` - Bundle test implementation
- `package.json` - `test:e2e:bundle` script

*Source: Bundle optimization E2E test debugging (2025-12-26)*

---

### E2E CI/CD Configuration

#### GitHub Actions with Sharding

**Rule (DB-safe)**: use job-level sharding for parallelism and keep Playwright sequential inside each job.

```bash
# ✅ DB-safe: parallelism at job level only
npx playwright test --shard=1/4 --workers=1
```

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  e2e-tests:
    name: E2E Tests (Shard ${{ matrix.shard }})
    runs-on: ubuntu-latest
    timeout-minutes: 30

    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3]  # Split tests across 3 parallel jobs

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install chromium --with-deps

      - name: Run E2E tests (shard ${{ matrix.shard }})
        run: npx playwright test --shard=${{ matrix.shard }}/3 --workers=1

      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          # Prefer per-shard names to avoid collisions when uploading from a matrix
          name: e2e-test-report-shard-${{ matrix.shard }}
          path: |
            playwright-report/
            test-results/junit.xml
            test-results/
          retention-days: 30
```

#### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  // CI: Sequential for stability
  workers: process.env.CI ? 1 : undefined,

  // CI: 2 retries for flaky tests
  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-report' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['github'],
      ]
    : [['html'], ['list']],

  use: {
    trace: process.env.CI ? 'on' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

---

### E2E Flaky Test Prevention

#### Use Auto-Waiting (CRITICAL)

**BEST PRACTICE**: Rely on Playwright's built-in auto-waiting instead of timeouts.

```typescript
// ✅ CORRECT - Auto-waiting built-in
await page.getByRole('button', { name: 'Submit' }).click();
await expect(page.getByText('Success')).toBeVisible();

// ❌ AVOID - Arbitrary timeout (brittle)
await page.waitForTimeout(3000);
await page.click('button');
```

Playwright auto-waits for:
- Element attached to DOM
- Element visible
- Element enabled
- Element stable (not animating)

#### Prefer Waiting for UI State (React Query / SPA)

In SPAs, `waitForResponse()` can be racy if the response completes before the listener is attached.
Prefer waiting for user-visible UI state changes (text, table row, dialog open/close).

```typescript
// ✅ CORRECT - Wait for UI state (source-of-truth)
await page.goto(`/product/${productId}`);
await expect(page.getByRole('heading', { name: /price analytics/i })).toBeVisible();

// ✅ If you must wait for a specific response, attach the listener BEFORE the action
await Promise.all([
  page.waitForResponse((resp) => resp.url().includes(`/api/products/${productId}`) && resp.status() === 200),
  page.goto(`/product/${productId}`),
]);
```

---

### Visual Regression Testing (Screenshots)

Use Playwright screenshots to lock down critical UI surfaces.

**Stability rules (do these first):**
- Set a fixed viewport per test (`page.setViewportSize(...)`).
- Disable animations/transitions for the page under test.
- Make data deterministic (seeded test data) so charts and tables don’t reshuffle.
- Mask dynamic regions (timestamps, axis tick labels, live status overlays).

```typescript
// Example stabilization helper
async function stabilizeForScreenshot(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        caret-color: transparent !important;
      }

      /* Hide transient overlays (e.g., websocket connection status) */
      [data-testid="connection-status"] { display: none !important; }
    `,
  });
}

await expect(section).toHaveScreenshot('price-analytics-expanded-30d.png', {
  mask: [page.locator('.recharts-cartesian-axis-tick-value, .recharts-cartesian-axis-tick text')],
  maxDiffPixels: 250,
});
```

**Snapshot workflow:**
- Generate/update baselines: `npx playwright test <spec> --update-snapshots`
- Verify clean run: `npx playwright test <spec>`

**Project example:** `e2e/price-analytics.visual.spec.ts`

#### Mock External APIs

```typescript
// e2e/helpers/mock-api.helpers.ts
export async function mockExternalApi(page: Page) {
  await page.route('**/api.external-service.com/**', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        productPrice: 999.99,
        availability: 'in_stock',
      }),
    });
  });
}

// Usage
test('should handle external price data', async ({ page }) => {
  await mockExternalApi(page);
  await page.goto('/products/123');

  // External API is mocked, result is deterministic
  await expect(page.getByTestId('external-price')).toContainText('$999.99');
});
```

---

### E2E Debugging

#### Trace Viewer (PRIMARY TOOL)

```bash
# Run test with trace
npx playwright test --trace on

# Open trace viewer
npx playwright show-trace test-results/.../trace.zip
```

Trace Viewer shows:
- Every action taken
- DOM snapshots at each step
- Network requests/responses
- Console logs
- Screenshots
- Timing information

#### Debug Mode

```bash
# Debug specific test
npx playwright test --debug auth.spec.ts

# Debug with headed browser
npx playwright test --headed --debug
```

In debug mode:
- Tests pause before each action
- Playwright Inspector shows code and selectors
- Step through test line by line
- Evaluate selectors in real-time

#### Console Monitoring

```typescript
test('should not have console errors', async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/products');

  expect(consoleErrors).toEqual([]);
});
```

---

### E2E Test Documentation Patterns (NEW - 2025-12-22)

**Source**: Phase 1.1 - Missing features implementation plan
**Issue**: E2E tests claimed `/alerts` page "doesn't exist" but page was fully implemented (231 lines)

E2E test comments must accurately reflect implementation reality. Stale comments create confusion and waste debugging time.

#### The Problem: Documentation Drift

```typescript
// e2e/price-alerts.spec.ts - WRONG (outdated comment)

// SKIPPED: View Price Alerts tests require /alerts page that doesn't exist
// Re-enable when dedicated alerts management page is implemented
test.describe.skip('View Price Alerts', () => {
  // 6 tests skipped...
});

// Reality: /alerts page exists at client/src/pages/alerts.tsx (231 lines)
// Tests would pass if unskipped - comment is 100% wrong!
```

**Why This Happens**:
- Feature implemented but developer forgets to update test comments
- Test written before implementation, never revisited
- Multiple developers working on feature and tests separately

**Impact**:
- Wasted time investigating "missing" features that exist
- False sense of incomplete work
- Tests not exercising real functionality
- Test coverage metrics inaccurate

#### The Solution: Structured Comment Format

Use a **standardized format** that states WHAT exists and HOW MANY tests:

```typescript
// ✅ CORRECT - Accurate status with test count

// ✅ /alerts page implemented with full CRUD support
// Tests: list alerts (3 tests), view status, empty state
test.describe('View Price Alerts', () => {
  test('should list all user alerts', async ({ authenticatedPage: page }) => {
    // Test implementation...
  });

  test('should show empty state when no alerts', async ({ authenticatedPage: page }) => {
    // Test implementation...
  });

  test('should show alert status (active/triggered)', async ({ authenticatedPage: page }) => {
    // Test implementation...
  });
});
```

#### Comment Format Template

```typescript
// [STATUS] [Feature/page name] [implementation status]
// Tests: [brief list of test scenarios]
// BLOCKER: [if skipped, specific reason] (optional)

// Examples:

// ✅ /alerts page implemented with full CRUD support
// Tests: list alerts (3 tests), view status, empty state
test.describe('View Price Alerts', () => { /* ... */ });

// ✅ /alerts page implemented with edit functionality
// Tests: update target price (2 tests), validation
test.describe('Edit Price Alert', () => { /* ... */ });

// ❌ Feature not implemented yet
// BLOCKER: Requires backend notification service integration
test.describe.skip('Real-time Alerts', () => { /* ... */ });
```

#### Status Indicators

Use **emoji/text prefixes** for quick visual scanning:

- **✅** - Feature fully implemented and tested
- **⚠️** - Feature partially implemented (specify what's missing)
- **❌** - Feature not implemented yet
- **🚧** - Feature in progress (mention who/when)

#### Maintenance Pattern

**CRITICAL**: Update test comments immediately when:
1. Implementing a feature that has skipped tests
2. Discovering skipped tests for existing features
3. Refactoring features that change test scenarios

```typescript
// Before implementing feature
// ❌ Price volatility indicator not implemented
// Tests: volatility badge, calculation accuracy, edge cases
test.describe.skip('Price Volatility', () => {
  // Tests waiting for implementation...
});

// After implementing feature - UPDATE COMMENT IMMEDIATELY
// ✅ Price volatility indicator implemented
// Tests: volatility badge (3 levels), calculation accuracy, edge cases
test.describe('Price Volatility', () => {
  // Tests now active!
});
```

#### Test Count Accuracy

**Always include test counts** for accountability:

```typescript
// ✅ CORRECT - Exact count helps verify completeness
// Tests: create alert (2 tests), validation (3 tests), edge cases (1 test)
test.describe('Alert Creation', () => {
  // 6 total tests
});

// ❌ WRONG - Vague, no accountability
// Tests: alert creation and validation
test.describe('Alert Creation', () => {
  // How many tests? No idea.
});
```

#### Detection Pattern

Add to code review checklist:

```bash
# Find potentially stale skip comments
grep -rn "doesn't exist\|not implemented\|TODO.*skip" e2e/ --include="*.ts"

# Cross-reference with actual implementation
# If comment says "doesn't exist" but file exists, update comment!
```

#### Example: Real Fix from Session

**Before (Incorrect)**:
```typescript
// e2e/price-alerts.spec.ts

// SKIPPED: View Price Alerts tests require /alerts page that doesn't exist
// Re-enable when dedicated alerts management page is implemented
test.describe.skip('View Price Alerts', () => {
  test('should list all user alerts', async ({ authenticatedPage: page }) => {
    await page.goto('/alerts');  // This page EXISTS!
    // ...
  });
});
```

**After (Accurate)**:
```typescript
// e2e/price-alerts.spec.ts

// ✅ /alerts page implemented with full CRUD support
// Tests: list alerts (3 tests), view status, empty state
test.describe('View Price Alerts', () => {
  test('should list all user alerts', async ({ authenticatedPage: page }) => {
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    // Should show alerts for the seeded product
    await expect(page.locator('text=/Gaming Laptop/i').first()).toBeVisible();
  });

  test('should show empty state when no alerts', async ({ authenticatedPage: page }) => {
    // ...
  });

  test('should show alert status (active/triggered)', async ({ authenticatedPage: page }) => {
    // ...
  });
});
```

**Impact**: +6 E2E tests activated, accurate documentation, no wasted investigation time.

#### Test Documentation Checklist

Before committing E2E test files:

- [ ] Comments accurately reflect implementation status (not stale)
- [ ] Status indicator used (✅/⚠️/❌/🚧)
- [ ] Test count specified for each describe block
- [ ] Skip reasons are specific with blockers documented
- [ ] Cross-referenced with actual implementation (files exist)
- [ ] Updated comments after implementing features

**Reference**: `todos/2025-12-22_missing-features-implementation-plan.md` (Section 1.1)

---

### Test-Driven E2E Development with Skipped Tests (NEW - 2025-12-22)

**Source**: Phase 1 missing features analysis
**Pattern**: Write E2E tests using `test.skip()` before implementation, tests self-activate when UI appears

E2E tests can serve as **living feature specifications** that automatically activate when implementation is complete.

#### The TDD Pattern for E2E Tests

**Traditional TDD**: Write unit test → implement code → test passes
**E2E TDD**: Write E2E test with `test.skip()` → implement UI → test auto-activates

```typescript
// Step 1: Write test BEFORE feature exists
test.skip('should highlight best deal among retailers', async ({ page }) => {
  await page.goto(`/products/${productId}`);

  const bestDealBadge = page.locator('text=/best deal/i');
  await expect(bestDealBadge).toBeVisible();
  // Test waits for "Best Deal" text to appear in UI
});

// Step 2: Implement feature
// Add <Badge>Best Deal</Badge> to RetailerCard component

// Step 3: Remove skip - test automatically passes!
test('should highlight best deal among retailers', async ({ page }) => {
  await page.goto(`/products/${productId}`);

  const bestDealBadge = page.locator('text=/best deal/i');
  await expect(bestDealBadge).toBeVisible();
  // ✅ Now passes because badge exists in DOM
});
```

#### Auto-Activation with skipIfMissing Helper

For even better automation, use a helper that skips tests when UI elements are missing:

```typescript
// e2e/helpers/skip-if-missing.ts
import { type Page } from '@playwright/test';

export async function skipIfMissing(
  page: Page,
  selector: string,
  featureName: string
): Promise<void> {
  const element = page.locator(selector);
  const exists = await element.count() > 0;

  if (!exists) {
    console.log(`⏭️  Skipping test - ${featureName} not implemented (selector: ${selector})`);
    return; // Test automatically skips
  }
}

// Usage in tests
test('should show time range selector', async ({ page }) => {
  await page.goto(`/products/${productId}`);

  // Auto-skip if selector doesn't exist
  await skipIfMissing(page, '[data-testid="time-range-selector"]', 'Time Range Selector');

  // If we reach here, feature is implemented!
  await expect(page.getByTestId('time-range-selector')).toBeVisible();
  await page.getByRole('tab', { name: '30d' }).click();
  // ... rest of test
});
```

#### Benefits of TDD E2E Pattern

1. **Self-Documenting**: Skipped tests are a visible todo list
2. **No Manual Tracking**: Test suite shows exactly what's missing
3. **Automatic Activation**: Implement feature → test passes (no test updates needed)
4. **Prevents Regressions**: If feature breaks, test immediately fails
5. **Clear Acceptance Criteria**: Test defines "done" for the feature

#### Structured Blocker Documentation

When tests are skipped for **specific blockers** (not just missing UI), use structured format:

```typescript
// BLOCKER: [What's blocking]
// Requires: [Specific technical requirement]
// Backend: [File/service that needs changes]
// Effort: [Time estimate] (Phase reference)
test.describe.skip('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Test implementation...
  });
});
```

**Example**:
```typescript
// BLOCKER: Alert notification integration pending
// Requires: price-drop-detection service to create notifications when alerts trigger
// Backend: server/services/price-drop-detection.ts needs notification integration
// Effort: ~2-3 hours (Phase 3, Feature 3.1)
test.describe.skip('Alert Notifications', () => {
  test('should show notification when price drops below target', async ({ authenticatedPage: page }) => {
    await createAlertViaModal(page, testProduct.productId, 2000.0);

    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');

    // Should show that alert was triggered or notification exists
    await expect(
      page.locator('text=/triggered|price.*dropped|target.*met|notification/i')
    ).toBeVisible();
  });
});
```

#### Implementation Tracking Pattern

Combine TDD E2E tests with a **feature tracking document**:

```markdown
# todos/missing-features-implementation-plan.md

## Phase 1: Quick Wins

### 1.1 Update /alerts Test Documentation (15 minutes)
**Status**: ✅ COMPLETED 2025-12-22
**E2E Tests Activated**: +6 tests in price-alerts.spec.ts

### 1.2 Add "Best Deal" Badge (1 hour)
**Status**: ✅ COMPLETED 2025-12-22 (Already implemented)
**E2E Tests Activated**: +1 test in price-analytics.spec.ts

### 1.3 Price Change % Badges (1-2 hours)
**Status**: ⏳ Not Started
**E2E Tests Waiting**: 1 test in price-analytics.spec.ts

## Progress: 2/15 features complete, +7 E2E tests activated
```

#### Test as Feature Specification

Write E2E tests as **acceptance criteria**:

```typescript
// This test IS the feature specification
test.skip('should filter notifications by type', async ({ authenticatedPage: page }) => {
  // GIVEN multiple notification types exist
  await seedNotifications([
    { type: 'price_drop', title: 'Price dropped!' },
    { type: 'price_alert', title: 'Alert triggered!' },
    { type: 'system', title: 'System update' },
  ]);

  // WHEN user navigates to notifications page
  await page.goto('/notifications');

  // AND selects "Price Alerts" filter
  await page.getByRole('combobox', { name: /filter/i }).click();
  await page.getByRole('option', { name: /price alerts/i }).click();

  // THEN only price alert notifications are shown
  await expect(page.getByText('Alert triggered!')).toBeVisible();
  await expect(page.getByText('Price dropped!')).not.toBeVisible();
  await expect(page.getByText('System update')).not.toBeVisible();

  // AND count updates to reflect filter
  await expect(page.getByText('1 notification')).toBeVisible();
});

// Developer reads this test and knows EXACTLY what to build:
// 1. Dropdown filter component
// 2. Filter by notification.type field
// 3. Update count to reflect filtered results
// 4. URL parameter to persist filter (?type=price_alert)
```

#### Component Verification Pattern

**CRITICAL**: Always **run E2E test to verify** before marking feature complete.

```typescript
// Implementation plan says "Feature 1.2: Add Best Deal Badge"
// Developer thinks: "I'll just add the badge and mark it done"

// ❌ WRONG - Marking complete without verification
// - Might already be implemented
// - Might be implemented differently than expected
// - Test might not actually pass

// ✅ CORRECT - Run test first
npm run test:e2e -- e2e/price-analytics.spec.ts --grep "best deal"

// If test passes → Feature already exists! Update plan.
// If test fails → Implement feature, then run test again.
// Only mark complete when test actually passes.
```

**Example from Session**:
```bash
# Feature 1.2: Add "Best Deal" Badge
# Developer was about to implement...

$ npm run test:e2e -- e2e/price-analytics.spec.ts --grep "best deal"

# Test PASSED! Feature already implemented!
# Saved 1 hour of duplicate work.
# Updated plan to mark as "Already implemented"
```

#### TDD E2E Anti-Patterns

**❌ DON'T**:
- Skip tests with vague reasons ("not working", "flaky", "todo")
- Leave tests skipped indefinitely (tech debt accumulates)
- Write tests after implementation (loses TDD benefit)
- Forget to remove `skip()` after implementing feature

**✅ DO**:
- Use structured blocker format (specific, actionable)
- Track skipped tests in feature roadmap
- Write tests before or during implementation
- Run tests to verify before marking features complete
- Update test comments when implementation status changes

#### Skipped Test Inventory Pattern

Periodically audit skipped tests:

```bash
# Find all skipped E2E tests
grep -rn "test.skip\|test.describe.skip" e2e/ --include="*.spec.ts"

# Create inventory
# e2e/price-alerts.spec.ts:226 - Alert Notifications (BLOCKER: backend integration)
# e2e/price-analytics.spec.ts:89 - Time Range Selector (frontend UI missing)
# e2e/notifications.spec.ts:45 - Filter by Type (dropdown component missing)

# Estimate total effort: ~12 hours
# Prioritize by user value
# Create implementation plan
```

#### Success Metrics

**When TDD E2E pattern is working well**:
- Skipped test count decreases over time
- Feature roadmap automatically syncs with test suite
- No "surprise" missing features (tests document everything)
- Test suite serves as living feature documentation
- Developers know exactly what to build (tests are specs)

**Example from Session**:
- Started with 41 skipped E2E tests
- Discovered 6 tests for existing `/alerts` page
- Activated +6 tests with just comment updates (15 minutes)
- Discovered "Best Deal" badge already implemented (+1 test)
- **Result**: +7 tests activated, accurate feature tracking, no wasted work

#### TDD E2E Checklist

Before writing skipped E2E tests:

- [ ] Test describes specific user behavior (not implementation)
- [ ] Skip reason is structured with blocker details
- [ ] Test count tracked in feature roadmap
- [ ] Acceptance criteria clear from test assertions
- [ ] Test will auto-activate when UI elements appear
- [ ] Effort estimate included for implementation
- [ ] Related backend/frontend files documented

**Reference**: `todos/2025-12-22_missing-features-implementation-plan.md` (entire document is TDD E2E pattern)

---

### Verification-First Methodology (NEW - 2025-12-22)

**Source**: Session 1 - Missing features implementation (Phase 1 completion)
**Pattern**: ALWAYS run E2E tests BEFORE implementing to verify feature doesn't already exist
**Impact**: Saved 105 minutes (64% efficiency gain) by discovering 3/4 features were already implemented

#### The Problem: Implementation Without Verification

```typescript
// Anti-Pattern: Implement first, verify later

// Step 1: Read feature requirement "Add price change % badges"
// Step 2: Implement PriceChangeBadge component (90 minutes)
// Step 3: Run E2E test →  discover PriceTrendIndicator already exists!
// Result: 90 minutes wasted + duplicate component + technical debt
```

**Why This Happens**:
- Assumption that planned features don't exist
- Trust in implementation plan without verification
- Lack of systematic discovery process
- No enforcement of verify-first workflow

**Impact**:
- Wasted development time (60-90 min per feature)
- Duplicate implementations with inconsistent UX
- Technical debt from redundant code
- Missed opportunities to leverage existing work

#### The Solution: Verify-First 4-Step Process

**CRITICAL RULE**: Run E2E test FIRST for EVERY feature before writing code.

```bash
# Step 1: Run E2E test to check if feature exists
npm run test:e2e -- e2e/price-analytics.spec.ts --grep "price change"

# Step 2: Analyze result
# ✅ Test PASSES → Feature already exists!
#    Action: Document discovery, update implementation plan, move to next feature
#    Time saved: 60-90 minutes per feature
#
# ❌ Test FAILS → Feature missing
#    Action: Implement feature following plan
#
# ⏭️ Test SKIPPED → Investigate skip reason
#    Action: Check test comments, search for component, decide if exists

# Step 3: Component Discovery (if test doesn't exist yet)
# Search for functional equivalents using grep patterns
grep -rn "price.*change\|trend.*indicator\|percentage.*badge" client/src/components/

# Step 4: Update documentation
# - If found: Document actual implementation location
# - If missing: Implement and document new component
```

#### Verification-First Decision Tree

```
Feature Implementation Request
│
├─► Step 1: E2E Test Exists?
│   ├─► YES → Run test
│   │   ├─► PASSES → ✅ Feature exists!
│   │   │   └─► Update plan: "Already implemented at [location]"
│   │   ├─► FAILS → ❌ Implement feature
│   │   │   └─► Follow implementation plan
│   │   └─► SKIPPED → Check skip reason
│   │       └─► Search for component (Step 3)
│   │
│   └─► NO → Write E2E test first (TDD pattern)
│       └─► Then run verification process
│
└─► Step 2: Time Comparison
    ├─► Verification: 5-15 minutes
    └─► Implementation: 60-120 minutes
        Result: 45-105 minutes saved if feature exists!
```

#### Session 1 Real-World Results

**Phase 1 Features (4 total)**:

| Feature | Estimated | Verification | Result | Time Saved |
|---------|-----------|--------------|--------|----------|
| 1.1 /alerts tests | 15 min | 15 min | ✅ Activated tests | 0 min |
| 1.2 Best Deal badge | 60 min | 15 min | ✅ Already exists | 45 min |
| 1.3 Watchlist removal | 30 min | 15 min | ✅ Already exists | 15 min |
| 1.4 Price change % | 90 min | 15 min | ✅ Already exists | 75 min |
| **TOTAL** | **195 min** | **60 min** | **4/4 complete** | **135 min saved** |

**Efficiency**: 69% faster (195 min → 60 min)
**Discovery Rate**: 75% (3/4 features pre-existing)
**Code Written**: 0 lines (pure verification)

#### Verification Commands Reference

```bash
# E2E Test Verification
npm run test:e2e -- e2e/[spec-file].spec.ts --grep "[feature-keyword]"
npm run test:e2e -- e2e/price-analytics.spec.ts --grep "time range"
npm run test:e2e -- e2e/price-alerts.spec.ts --grep "notification"

# Component Search (functional keywords, not exact names)
grep -rn "TimeRange\|time.*range\|range.*selector" client/src/components/
grep -rn "PriceChange\|price.*change\|trend.*indicator" client/src/components/
grep -rn "BestDeal\|best.*deal\|cheapest" client/src/components/

# File System Search
ls client/src/components/**/*range*.tsx
ls client/src/components/**/*price*.tsx
ls client/src/pages/*alert*.tsx

# Check E2E Test Status
grep -rn "test.skip\|test.describe.skip" e2e/
grep -rn "doesn't exist\|not implemented" e2e/
```

#### Integration with Implementation Plans

**Feature Roadmap Pattern**:

```markdown
# todos/feature-implementation-plan.md

### Feature 2.1: Time Range Selector (2-3 hours estimated)

**VERIFICATION STEP** (MANDATORY - do this FIRST):
- [ ] Run E2E test: `npm run test:e2e -- e2e/price-analytics.spec.ts --grep "time range"`
- [ ] Search components: `grep -rn "TimeRange\|time.*range" client/src/components/`
- [ ] Check if feature exists: YES / NO

**If feature exists**:
- Update plan with discovery notes
- Document actual implementation location
- Mark as complete, move to next feature

**If feature missing**:
- Proceed with implementation below
- Follow estimated timeline

**Implementation**: (only if verification confirms missing)
```

#### Verification-First Checklist

Before implementing ANY feature:

- [ ] **Run E2E test first** to check if feature exists
- [ ] **Search for components** using functional keyword patterns
- [ ] **Document discovery** regardless of result (exists or missing)
- [ ] **Update implementation plan** with actual status
- [ ] **Calculate time saved** if feature pre-existed
- [ ] **Commit discovery** separately from implementation

**Golden Rule**: 15 minutes of verification can save 90 minutes of implementation.

---

### Component Discovery Patterns (NEW - 2025-12-22)

**Source**: Session 1 - Features 1.2, 1.3, 1.4 discovered via systematic search
**Pattern**: Use functional keyword searches, not exact planned component names
**Reason**: Components may have different internal names than user-facing feature descriptions

#### The Problem: Exact Name Search Failure

```bash
# ❌ WRONG - Searching for planned name only
grep -rn "PriceChangeIndicator" client/src/components/
# Result: No matches found
# Conclusion: Component doesn't exist
# Reality: Component exists as "PriceTrendIndicator" and "PriceChangeBadge"

# ✅ CORRECT - Searching for functional keywords
grep -rn "price.*change\|trend.*indicator\|percentage.*badge" client/src/components/
# Result: Found 2 components!
#   - client/src/components/price-analytics/price-trend-indicator.tsx
#   - client/src/components/price-history/price-change-badge.tsx
```

#### Functional Keyword Search Strategy

**Pattern**: Use OR-separated patterns matching different ways to describe the same function.

```bash
# Feature: Time Range Selector
# Keywords: time, range, duration, period, days, selector
grep -rn "TimeRange\|time.*range\|range.*selector\|duration.*picker\|period.*selector" client/src/

# Feature: Best Deal Badge
# Keywords: best, deal, lowest, cheapest, badge, highlight
grep -rn "BestDeal\|best.*deal\|lowest.*price\|cheapest\|deal.*badge" client/src/

# Feature: Price Comparison Table
# Keywords: compare, comparison, table, retailers, prices, offers
grep -rn "ComparePrice\|price.*comparison\|retailer.*table\|offer.*comparison" client/src/

# Feature: Export to CSV
# Keywords: export, csv, download, data, file
grep -rn "Export.*CSV\|download.*data\|export.*file\|csv.*export" client/src/
```

#### Discovery Search Patterns Library

**UI Components**:
```bash
# Badges/Tags
grep -rn "Badge\|Tag\|Label\|Chip" client/src/components/

# Tables
grep -rn "Table\|DataGrid\|DataTable\|List.*Table" client/src/components/

# Charts/Graphs
grep -rn "Chart\|Graph\|Plot\|Visualization" client/src/components/

# Selectors/Pickers
grep -rn "Select\|Picker\|Dropdown\|Combobox" client/src/components/

# Buttons/Actions
grep -rn "Button\|Action\|Trigger" client/src/components/
```

**Feature-Specific Patterns**:
```bash
# Price-related features
grep -rn "price.*history\|price.*chart\|price.*trend\|price.*change" client/src/

# Alert/Notification features
grep -rn "alert\|notification\|notify\|bell" client/src/

# Watchlist features
grep -rn "watch\|favorite\|bookmark\|save.*product" client/src/

# Analytics features
grep -rn "analytic\|insight\|statistic\|metric\|trend" client/src/
```

#### Multi-Location Search Strategy

**Search Hierarchy** (check in order):

1. **Components directory** (primary location)
   ```bash
   grep -rn "[keyword]" client/src/components/
   ```

2. **Pages directory** (feature might be page-level)
   ```bash
   grep -rn "[keyword]" client/src/pages/
   ```

3. **Hooks directory** (feature might be custom hook)
   ```bash
   grep -rn "[keyword]" client/src/hooks/
   ```

4. **Services directory** (feature might be client-side service)
   ```bash
   grep -rn "[keyword]" client/src/services/
   ```

5. **Global search** (if not found in specific dirs)
   ```bash
   grep -rn "[keyword]" client/src/
   ```

#### Glob Pattern Search (File Names)

Use glob patterns to find files by naming conventions:

```bash
# Files containing "price" anywhere in name
ls client/src/components/**/*price*.tsx
ls client/src/pages/**/*price*.tsx

# Files containing "alert" or "notification"
ls client/src/components/**/*alert*.tsx
ls client/src/components/**/*notification*.tsx

# Files in specific subdirectories
ls client/src/components/price-analytics/*.tsx
ls client/src/components/price-history/*.tsx
ls client/src/components/price-watch/*.tsx
```

#### Case Study: Feature 1.4 Discovery

**Planned Component**: `PriceChangeIndicator`
**Search Process**:

```bash
# Step 1: Exact name search (failed)
grep -rn "PriceChangeIndicator" client/src/components/
# Result: 0 matches

# Step 2: Functional keyword search (successful)
grep -rn "price.*change\|trend.*indicator\|percentage.*change" client/src/components/
# Result: 2 matches found!

# Match 1: PriceTrendIndicator
client/src/components/price-analytics/price-trend-indicator.tsx:139
# Shows: +5.2% badge with trend arrow

# Match 2: PriceChangeBadge
client/src/components/price-history/price-change-badge.tsx:28
# Shows: Detailed price change across 24h/7d/30d periods

# Conclusion: Feature EXISTS via TWO components (bonus discovery!)
# Time saved: 90 minutes (vs implementing from scratch)
```

#### Discovery Result Documentation

When a feature is discovered, document in this format:

```markdown
### Feature X.Y: [Name] ([estimated time])

**VERIFICATION RESULT**: ✅ **ALREADY IMPLEMENTED**

**Discovery Method**:
- E2E test: `npm run test:e2e -- e2e/[file].spec.ts --grep "[keyword]"` → PASSING
- Component search: `grep -rn "[keywords]" client/src/components/`

**Actual Implementation**:
- **Primary Component**: `[path/to/component.tsx]` (lines X-Y)
- **Integration**: Used in `[path/to/page.tsx]` (line Z)
- **Features**: [list actual capabilities]
- **Bonus**: [any additional related components found]

**Time Saved**: [estimated time] (verification: 15 min vs implementation: [estimated time])

**Next Action**: Mark feature complete, update E2E test documentation, move to next feature
```

#### Component Discovery Checklist

Before concluding "component doesn't exist":

- [ ] **Exact name search** (planned component name)
- [ ] **Functional keyword search** (what the feature does)
- [ ] **Synonym search** (alternative names for same function)
- [ ] **Multi-location search** (components, pages, hooks)
- [ ] **Glob pattern search** (file name patterns)
- [ ] **E2E test verification** (test might pass even if manual search failed)
- [ ] **Documentation search** (check for references in docs, README, comments)

**Only after ALL 7 steps**: Conclude component is missing and proceed with implementation.

---

### E2E Testing Checklist

Before committing E2E tests:

- [ ] Tests organized by user stories, not technical features
- [ ] Use Feature Objects instead of Page Objects
- [ ] Use `getByRole()` and `getByTestId()` for selectors
- [ ] Authentication state reused (global setup)
- [ ] Database cleaned before each test (transaction or TRUNCATE)
- [ ] Rely on auto-waiting, avoid `waitForTimeout()`
- [ ] External APIs mocked
- [ ] Tests pass in isolation (any order)
- [ ] CI configured with test sharding
- [ ] Trace enabled in CI for debugging failures
- [ ] **Test comments accurately reflect implementation status** (NEW)
- [ ] **Skip reasons use structured blocker format** (NEW)
- [ ] **Test count specified for each describe block** (NEW)
- [ ] **Verify feature exists via test before marking complete** (NEW)

---

### E2E Resources

**Official Documentation:**
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Authentication](https://playwright.dev/docs/auth)
- [Playwright Fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright Debugging](https://playwright.dev/docs/debug)

**Community Resources:**
- [Playwright Solutions Blog](https://playwrightsolutions.com/)
- [Better Stack Guide](https://betterstack.com/community/guides/testing/playwright-best-practices/)
- [DeviQA 2025 Guide](https://www.deviqa.com/blog/guide-to-playwright-end-to-end-testing-in-2025/)

**Project Documentation:**
- [e2e/README.md](/Users/williamtower/projects/PriceCompare/e2e/README.md)

---

**Last Updated:** 2025-12-23 (added Custom Agent Patterns section)
**Maintained By:** PriceCompare Development Team
