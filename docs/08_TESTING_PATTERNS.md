# Testing Patterns

**Version:** 1.9
**Last Updated:** 2025-12-22
**Related Patterns:**
- docs/01_TYPESCRIPT_PATTERNS.md (type safety in tests)
- docs/05_FRONTEND_PATTERNS.md (component testing)
- docs/04_SECURITY_PATTERNS.md (security testing)
- docs/LEARNINGS_TODO_004_PRICE_AGGREGATION_REAL_DB_TESTS.md (real database test migration)
- docs/LEARNINGS_TODO_175_DATABASE_CONNECTION_TESTS.md (environment configuration)
- docs/LEARNINGS_TODO_176_TIMEZONE_DATE_TESTS.md (frontend date testing)
- docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md (server-side UTC handling)
- docs/LEARNINGS_E2E_PHASE_1_1_ADMIN_TESTS.md (modal patterns, tab navigation, explicit waits)
- docs/LEARNINGS_PHASE_1_2_WATCHLIST_E2E_CSRF_FIX.md (CSRF token patterns, apiRequest() migration)
- docs/LEARNINGS_CODE_REVIEW_ASYNC_ONCLICK_DEBUGGING.md (progressive DOM scoping, selector ambiguity - NEW)

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
13. [CI/CD Configuration](#e2e-cicd-configuration)
14. [Visual Regression Testing (Screenshots)](#visual-regression-testing-screenshots)
15. [Flaky Test Prevention](#e2e-flaky-test-prevention)
16. [Debugging](#e2e-debugging)

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

**Last Updated:** 2025-12-15
**Maintained By:** PriceCompare Development Team
