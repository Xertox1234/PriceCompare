# Testing Patterns

**Version:** 1.1
**Last Updated:** 2025-12-03
**Related Patterns:**
- docs/01_TYPESCRIPT_PATTERNS.md (type safety in tests)
- docs/05_FRONTEND_PATTERNS.md (component testing)
- docs/04_SECURITY_PATTERNS.md (security testing)
- docs/LEARNINGS_TODO_004_PRICE_AGGREGATION_REAL_DB_TESTS.md (real database test migration)

---

## Table of Contents

1. [Overview](#overview)
2. [Integration Test Patterns (NEW)](#integration-test-patterns-new)
   - [Mock-Based Test Anti-Pattern](#mock-based-test-anti-pattern)
   - [TRUNCATE CASCADE Pattern](#truncate-cascade-pattern)
   - [Strong vs Weak Assertions](#strong-vs-weak-assertions)
   - [Performance Benchmarks](#performance-benchmarks)
3. [Test Infrastructure](#test-infrastructure)
   - [Required Mocks for Route Tests](#required-mocks-for-route-tests)
   - [Redis Mock Pattern](#redis-mock-pattern)
4. [Date and Time Testing](#date-and-time-testing)
   - [Timezone-Safe Date Assertions](#timezone-safe-date-assertions)
   - [Date Formatting in Tests](#date-formatting-in-tests)
5. [Component Testing Patterns](#component-testing-patterns)
   - [Testing Filtered UI Elements](#testing-filtered-ui-elements)
   - [Recharts Testing](#recharts-testing)
6. [Route Testing Patterns](#route-testing-patterns)
   - [Testing Missing Route Parameters](#testing-missing-route-parameters)
   - [Express Route Not Found Behavior](#express-route-not-found-behavior)
7. [Avoiding Skipped Tests](#avoiding-skipped-tests)
8. [Checklist](#testing-checklist)

---

## Overview

This document codifies testing patterns to ensure reliable, maintainable tests that don't become technical debt. Tests should be deterministic across environments and timezones.

**Key Technologies:**
- Vitest (test runner)
- React Testing Library (component tests)
- Supertest (API route tests)
- Playwright (E2E tests - Chrome extension only)

**Core Principles:**
- **Prefer real database over mocks** - Mocks for internal code are technical debt (see TODO_004)
- **No `it.skip()` without a plan** - Skipped tests are technical debt
- **Timezone-safe assertions** - Tests must pass in any timezone
- **Mock external dependencies only** - Redis, email, external APIs
- **Test behavior, not implementation** - Focus on what users see/do
- **Strong assertions over weak** - Use exact values with deterministic test data

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

---

## Testing Checklist

Before committing tests:

- [ ] **No `it.skip()` without justification** - Every skip needs a comment and plan
- [ ] **Dates use ISO format with explicit time** - `"2025-01-15T12:00:00.000Z"`
- [ ] **Redis mocked for route tests** - Mock placed before all imports
- [ ] **Test element types match filtering behavior** - Use correct query (role, text, etc.)
- [ ] **Route parameter tests expect correct status** - Missing params = 404, not 400
- [ ] **External services mocked** - Email, Redis, external APIs
- [ ] **Tests pass in isolation** - `npm test -- --run <file>` works
- [ ] **No timezone-dependent assertions** - Use flexible patterns or fixed times

---

## Related Documentation

- **[TEST_OVERVIEW.md](../TEST_OVERVIEW.md)** - Test suite organization
- **[LEARNINGS_TODO_001_WATCHLIST_TEST_FIX.md](LEARNINGS_TODO_001_WATCHLIST_TEST_FIX.md)** - Redis mock discovery
- **[vitest.config.ts](../vitest.config.ts)** - Test configuration

---

**Last Updated:** 2025-12-02
**Maintained By:** PriceCompare Development Team
