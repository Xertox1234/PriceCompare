# Testing Patterns

**Version:** 1.4
**Last Updated:** 2025-12-09
**Related Patterns:**
- docs/01_TYPESCRIPT_PATTERNS.md (type safety in tests)
- docs/05_FRONTEND_PATTERNS.md (component testing)
- docs/04_SECURITY_PATTERNS.md (security testing)
- docs/LEARNINGS_TODO_004_PRICE_AGGREGATION_REAL_DB_TESTS.md (real database test migration)
- docs/LEARNINGS_TODO_175_DATABASE_CONNECTION_TESTS.md (environment configuration)
- docs/LEARNINGS_TODO_176_TIMEZONE_DATE_TESTS.md (frontend date testing)
- docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md (server-side UTC handling - NEW)

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
4. [Test Infrastructure](#test-infrastructure)
   - [Required Mocks for Route Tests](#required-mocks-for-route-tests)
   - [Redis Mock Pattern](#redis-mock-pattern)
   - [Logger Mock Pattern (NEW)](#logger-mock-pattern-new)
   - [CSRF Middleware Testing (NEW)](#csrf-middleware-testing-new)
5. [Date and Time Testing](#date-and-time-testing)
   - [Timezone-Safe Date Assertions](#timezone-safe-date-assertions)
   - [Date Formatting in Tests](#date-formatting-in-tests)
   - [Server-Side UTC Date Handling (NEW)](#server-side-utc-date-handling-new---2025-12-09)
6. [Component Testing Patterns](#component-testing-patterns)
   - [Testing Filtered UI Elements](#testing-filtered-ui-elements)
   - [Recharts Testing](#recharts-testing)
7. [Route Testing Patterns](#route-testing-patterns)
   - [Testing Missing Route Parameters](#testing-missing-route-parameters)
   - [Express Route Not Found Behavior](#express-route-not-found-behavior)
8. [Avoiding Skipped Tests](#avoiding-skipped-tests)
9. [Checklist](#testing-checklist)

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

- **[TEST_OVERVIEW.md](../TEST_OVERVIEW.md)** - Test suite organization
- **[LEARNINGS_TODO_001_WATCHLIST_TEST_FIX.md](LEARNINGS_TODO_001_WATCHLIST_TEST_FIX.md)** - Redis mock discovery
- **[vitest.config.ts](../vitest.config.ts)** - Test configuration

---

**Last Updated:** 2025-12-09
**Maintained By:** PriceCompare Development Team
